"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { formatClock, useRemainingMs } from "@/components/Countdown";
import { PresenceNotice, StoreChip } from "@/components/Presence";
import { QrImage } from "@/components/QrImage";
import { Button, Header, Notice, Spinner } from "@/components/ui";
import { SYNC_ERROR_MESSAGES, type SyncErrorCode } from "@/lib/errors";
import { parseCounterTag } from "@/sync/NfcTagSyncProvider";
import {
  ApiError,
  createHostSession,
  joinSession,
  qrPayloadFor,
  syncProviders,
  SyncChannelError,
  watchPairing,
  type HostSession,
  type JoinCredential,
  type PresenceProof,
  type SyncMethod,
} from "@/sync";

type Mode = { kind: "choose" } | { kind: "host" } | { kind: "scan" } | { kind: "code"; nfc?: JoinCredential["nfc"] } | { kind: "nfc" } | { kind: "joining"; cred: JoinCredential };

export default function SyncPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <SyncFlow />
    </Suspense>
  );
}

function SyncFlow() {
  const params = useSearchParams();
  const { config, presence } = useApp();
  const [mode, setMode] = useState<Mode>(() => {
    // Opened from the QR via the phone's own camera app.
    const t = params.get("t");
    if (t) return { kind: "joining", cred: { token: t } };
    // Opened by tapping a counter NFC tag (works on iPhone too, via background tag reading).
    const nfc = parseCounterTag(typeof window !== "undefined" ? window.location.href : "");
    if (nfc) return { kind: "code", nfc };
    return { kind: "choose" };
  });

  const usesNfcProof = (mode.kind === "code" && mode.nfc) || (mode.kind === "joining" && mode.cred.nfc);
  const proof: PresenceProof | null = presence.kind === "ok" ? presence.proof : usesNfcProof ? {} : null;
  const back = mode.kind === "choose" ? "/" : undefined;

  return (
    <>
      <Header back={back} />
      <div className="mt-2 flex justify-center">
        <StoreChip />
      </div>
      <div className="mt-6 flex flex-1 flex-col gap-4">
        {!config ? (
          <Spinner label="Loading…" />
        ) : !proof ? (
          <PresenceNotice />
        ) : mode.kind === "choose" ? (
          <Choose onPick={setMode} />
        ) : mode.kind === "host" ? (
          <Host proof={proof} onCancel={() => setMode({ kind: "choose" })} />
        ) : mode.kind === "scan" ? (
          <Scan onCredential={(cred) => setMode({ kind: "joining", cred })} onTypeCode={() => setMode({ kind: "code" })} onCancel={() => setMode({ kind: "choose" })} />
        ) : mode.kind === "code" ? (
          <CodeEntry nfc={mode.nfc} onSubmit={(cred) => setMode({ kind: "joining", cred })} onCancel={() => setMode({ kind: "choose" })} />
        ) : mode.kind === "nfc" ? (
          <NfcTap onTag={(nfc) => setMode({ kind: "code", nfc })} onCancel={() => setMode({ kind: "choose" })} />
        ) : (
          <Joining proof={proof} cred={mode.cred} onRetry={() => setMode(mode.cred.nfc ? { kind: "code", nfc: mode.cred.nfc } : { kind: "choose" })} />
        )}
      </div>
    </>
  );
}

function Choose({ onPick }: { onPick: (m: Mode) => void }) {
  const [available, setAvailable] = useState<SyncMethod[]>([]);
  useEffect(() => {
    Promise.all(syncProviders.map(async (p) => ((await p.isAvailable()) ? p.id : null))).then((ids) => setAvailable(ids.filter(Boolean) as SyncMethod[]));
  }, []);

  return (
    <>
      <h1 className="text-center font-display text-3xl uppercase">Who&apos;s who?</h1>
      <p className="-mt-2 text-center text-cream/70">One of you shows a code, the other scans it.</p>
      <Button onClick={() => onPick({ kind: "host" })} className="min-h-24 text-2xl">
        📱 Show my code
      </Button>
      <Button variant="flame" onClick={() => onPick({ kind: "scan" })} className="min-h-24 text-2xl">
        📷 Scan twin&apos;s code
      </Button>
      {available.includes("nfc-tag") && (
        <Button variant="ghost" onClick={() => onPick({ kind: "nfc" })}>
          📶 Tap counter NFC tag
        </Button>
      )}
      <button onClick={() => onPick({ kind: "code" })} className="py-3 text-center text-sm text-cream/70 underline underline-offset-4">
        Type your twin&apos;s code instead
      </button>
    </>
  );
}

function errorCode(e: unknown): SyncErrorCode {
  return e instanceof ApiError && e.code in SYNC_ERROR_MESSAGES ? (e.code as SyncErrorCode) : "BAD_REQUEST";
}

function SyncErrorNotice({ code, action }: { code: SyncErrorCode; action: React.ReactNode }) {
  const msg = SYNC_ERROR_MESSAGES[code];
  const emoji = code === "TOKEN_EXPIRED" ? "⏰" : code === "DAILY_LIMIT" ? "🌙" : code === "SAME_DEVICE" ? "🪞" : "😬";
  return (
    <Notice emoji={emoji} title={msg.title} action={action}>
      {msg.body}
    </Notice>
  );
}

/* ---------------- Phone A ---------------- */

function Host({ proof, onCancel }: { proof: PresenceProof; onCancel: () => void }) {
  const router = useRouter();
  const [session, setSession] = useState<HostSession | null>(null);
  const [error, setError] = useState<SyncErrorCode | null>(null);
  const [expired, setExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) return; // React StrictMode double-run guard
    started.current = attempt;
    setSession(null);
    setExpired(false);
    setError(null);
    createHostSession(proof).then(setSession, (e) => setError(errorCode(e)));
  }, [attempt, proof]);

  useEffect(() => {
    if (!session) return;
    return watchPairing(session.sessionId, (u) => {
      if (u.status === "PAIRED" && u.voucherId) router.replace(`/voucher/${u.voucherId}?new=1`);
      else if (u.status === "EXPIRED" || u.status === "NOT_FOUND") setExpired(true);
    });
  }, [session, router]);

  if (error) return <SyncErrorNotice code={error} action={<Button variant="ghost" onClick={onCancel}>Back</Button>} />;
  if (!session) return <Spinner label="Making your code…" />;
  if (expired)
    return (
      <Notice emoji="⏰" title="Code expired" action={<Button onClick={() => setAttempt((a) => a + 1)}>Make a new code</Button>}>
        Codes last 60 seconds so they can&apos;t be shared around. Get your twin ready and try again.
      </Notice>
    );
  return <HostCode session={session} onExpire={() => setExpired(true)} onCancel={onCancel} />;
}

function HostCode({ session, onExpire, onCancel }: { session: HostSession; onExpire: () => void; onCancel: () => void }) {
  const left = useRemainingMs(session.expiresAt, session.serverNow);
  const total = new Date(session.expiresAt).getTime() - new Date(session.serverNow).getTime();
  useEffect(() => {
    if (left === 0) onExpire();
  }, [left, onExpire]);

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-center font-display text-3xl uppercase">Twin, scan me!</h1>
      <QrImage value={qrPayloadFor(session.token)} size={240} label="Twin Sync pairing code" />
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-cream/60">or type</div>
        <div className="font-mono text-4xl font-bold tracking-[0.3em] text-sun" aria-label={`Code ${session.shortCode.split("").join(" ")}`}>
          {session.shortCode}
        </div>
      </div>
      <div className="flex w-full items-center gap-3">
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-ash">
          <div className={`h-full rounded-full transition-[width] duration-300 ${left < 15_000 ? "bg-flame" : "bg-sun"}`} style={{ width: `${(left / total) * 100}%` }} />
        </div>
        <span className={`w-14 text-right font-display text-xl ${left < 15_000 ? "text-flame" : ""}`}>{formatClock(left)}</span>
      </div>
      <p className="flex items-center gap-2 text-cream/70">
        <span className="h-2 w-2 animate-ping rounded-full bg-sun" /> Waiting for your twin…
      </p>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/* ---------------- Phone B ---------------- */

function Scan({ onCredential, onTypeCode, onCancel }: { onCredential: (c: JoinCredential) => void; onTypeCode: () => void; onCancel: () => void }) {
  const [error, setError] = useState<SyncChannelError | null>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  // Start the camera once per mount (not on every parent re-render).
  useEffect(() => {
    const qr = syncProviders.find((p) => p.id === "qr")!;
    const ctrl = new AbortController();
    qr.acquire({ signal: ctrl.signal, elementId: "qr-reader" }).then(
      (cred) => onCredentialRef.current(cred),
      (e) => {
        if (!(e instanceof SyncChannelError && e.code === "ABORTED")) setError(e instanceof SyncChannelError ? e : new SyncChannelError("UNSUPPORTED"));
      },
    );
    return () => ctrl.abort();
  }, []);

  if (error) {
    const denied = error.code === "PERMISSION_DENIED";
    return (
      <Notice emoji="📷" title={denied ? "Camera is off" : "Can't open the camera"} action={<Button onClick={onTypeCode}>Type the code instead</Button>}>
        {denied
          ? "Allow camera access for this site in your browser settings to scan — or just type the 6-letter code on your twin's screen."
          : error.code === "NO_DEVICE"
            ? "We couldn't find a camera. Type the 6-letter code on your twin's screen instead."
            : "Your browser blocked the camera (it needs HTTPS). Type the 6-letter code on your twin's screen instead."}
      </Notice>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-center font-display text-3xl uppercase">Scan your twin</h1>
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border-4 border-sun bg-coal">
        <div id="qr-reader" className="h-full w-full" />
      </div>
      <p className="text-center text-cream/70">Point at the code on your twin&apos;s phone.</p>
      <Button variant="ghost" onClick={onTypeCode}>
        Type code instead
      </Button>
      <button onClick={onCancel} className="text-sm text-cream/60 underline">
        Cancel
      </button>
    </div>
  );
}

function CodeEntry({ nfc, onSubmit, onCancel }: { nfc?: JoinCredential["nfc"]; onSubmit: (c: JoinCredential) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 6) onSubmit({ shortCode: clean, nfc });
      }}
    >
      {nfc && <div className="rounded-2xl bg-coal p-3 text-center text-sm text-green-300">📶 Counter tag read — you&apos;re in the store.</div>}
      <h1 className="text-center font-display text-3xl uppercase">Enter twin&apos;s code</h1>
      <input
        autoFocus
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        aria-label="Six character code"
        value={clean}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABC123"
        className="rounded-2xl border-4 border-sun bg-coal py-5 text-center font-mono text-4xl font-bold tracking-[0.3em] text-sun placeholder:text-cream/20 focus:outline-none"
      />
      <Button type="submit" disabled={clean.length !== 6}>
        Sync!
      </Button>
      <button type="button" onClick={onCancel} className="text-sm text-cream/60 underline">
        Cancel
      </button>
    </form>
  );
}

function NfcTap({ onTag, onCancel }: { onTag: (nfc: JoinCredential["nfc"]) => void; onCancel: () => void }) {
  const [state, setState] = useState<"idle" | "scanning" | "denied" | "bad">("idle");
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  async function start() {
    // Web NFC requires a user gesture to start scanning.
    ctrl.current = new AbortController();
    setState("scanning");
    try {
      const { nfc } = await syncProviders.find((p) => p.id === "nfc-tag")!.acquire({ signal: ctrl.current.signal });
      onTag(nfc);
    } catch (e) {
      const code = e instanceof SyncChannelError ? e.code : "UNSUPPORTED";
      if (code !== "ABORTED") setState(code === "PERMISSION_DENIED" ? "denied" : "bad");
    }
  }

  if (state === "denied")
    return <Notice emoji="📶" title="NFC is blocked" action={<Button variant="ghost" onClick={onCancel}>Use QR instead</Button>}>Allow NFC for this site in Chrome settings, or scan your twin&apos;s QR code instead.</Notice>;
  if (state === "bad")
    return <Notice emoji="🤔" title="Unknown tag" action={<Button onClick={start}>Try again</Button>}>That isn&apos;t a Twin Sync counter tag. Look for the Twin Sync sticker at the counter.</Notice>;

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <h1 className="font-display text-3xl uppercase">Tap the counter tag</h1>
      <div className={`flex h-40 w-40 items-center justify-center rounded-full bg-sun text-6xl text-ink ${state === "scanning" ? "animate-pulse-ring" : ""}`}>📶</div>
      <p className="text-cream/70">{state === "scanning" ? "Hold the back of your phone on the Twin Sync sticker…" : "Then you'll type your twin's 6-letter code."}</p>
      {state === "idle" && <Button onClick={start}>Start NFC scan</Button>}
      <button onClick={onCancel} className="text-sm text-cream/60 underline">
        Cancel
      </button>
    </div>
  );
}

function Joining({ proof, cred, onRetry }: { proof: PresenceProof; cred: JoinCredential; onRetry: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<SyncErrorCode | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    joinSession(proof, cred).then(
      ({ voucherId }) => router.replace(`/voucher/${voucherId}?new=1`),
      (e) => setError(errorCode(e)),
    );
  }, [proof, cred, router]);

  if (error)
    return (
      <SyncErrorNotice
        code={error}
        action={
          error === "DAILY_LIMIT" ? (
            <Button variant="ghost" onClick={() => router.push("/")}>Home</Button>
          ) : (
            <Button onClick={onRetry}>Try again</Button>
          )
        }
      />
    );
  return <Spinner label="Syncing with your twin…" />;
}
