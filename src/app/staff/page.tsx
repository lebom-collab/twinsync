"use client";

import { useCallback, useEffect, useState } from "react";
import { CodeScanner } from "@/components/CodeScanner";
import { Button, Spinner, Wordmark } from "@/components/ui";
import type { RedeemStatus } from "@/lib/errors";
import { counterTagUrl, writeCounterTag } from "@/sync/NfcTagSyncProvider";

interface StaffStore {
  id: string;
  name: string;
  nfcTagSecret: string | null;
}
interface VoucherInfo {
  code: string;
  dealName: string;
  storeName: string;
  price: string;
  expiresAt: string;
  redeemedAt: string | null;
}
type Result = { status: RedeemStatus | "REDEEMED"; voucher: VoucherInfo | null };

const STORE_KEY = "twinsync.staffStore";

export default function StaffPage() {
  const [stores, setStores] = useState<StaffStore[] | null | "login">(null);

  const loadStores = useCallback(async () => {
    const res = await fetch("/api/staff/stores", { cache: "no-store" });
    setStores(res.ok ? (await res.json()).stores : "login");
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  if (stores === null) return <Spinner label="Loading…" />;
  if (stores === "login") return <PinLogin onSuccess={loadStores} />;
  return <Till stores={stores} onLogout={() => setStores("login")} />;
}

function PinLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/staff/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    if (res.ok) return onSuccess();
    const { error } = await res.json();
    setPin("");
    setError(error === "LOCKED" ? "Too many tries. Wait a minute." : "Wrong PIN");
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col justify-center gap-5">
      <Wordmark />
      <h1 className="font-display text-3xl uppercase">Staff till</h1>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        aria-label="Staff PIN"
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        className="rounded-2xl border-4 border-sun bg-coal py-5 text-center font-mono text-4xl tracking-[0.5em] text-sun placeholder:tracking-normal placeholder:text-cream/30 focus:outline-none"
      />
      {error && <p className="text-center font-bold text-flame" role="alert">{error}</p>}
      <Button type="submit" disabled={pin.length < 4}>
        Unlock
      </Button>
    </form>
  );
}

function Till({ stores, onLogout }: { stores: StaffStore[]; onLogout: () => void }) {
  const [storeId, setStoreId] = useState<string>("");
  const [mode, setMode] = useState<"idle" | "scan">("idle");
  const [typed, setTyped] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(STORE_KEY) ?? "";
    } catch {}
    setStoreId(stores.some((s) => s.id === saved) ? saved : "");
  }, [stores]);

  function pickStore(id: string) {
    setStoreId(id);
    setResult(null);
    try {
      localStorage.setItem(STORE_KEY, id);
    } catch {}
  }

  async function call(action: "verify" | "redeem", code: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/staff/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, storeId }) });
      if (res.status === 401) return onLogout();
      setResult(await res.json());
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setTyped("");
    setMode("idle");
    setCameraError(null);
  }

  async function logout() {
    await fetch("/api/staff/logout", { method: "POST" });
    onLogout();
  }

  const store = stores.find((s) => s.id === storeId);

  return (
    <div className="flex flex-1 flex-col gap-5 py-2">
      <header className="flex items-center justify-between">
        <Wordmark small />
        <button onClick={logout} className="rounded-full border-2 border-cream/30 px-4 py-2 text-sm font-bold">
          Lock
        </button>
      </header>

      <label className="block">
        <span className="mb-1 block text-sm font-bold uppercase tracking-wider text-cream/60">This till is at</span>
        <select value={storeId} onChange={(e) => pickStore(e.target.value)} className="w-full rounded-2xl bg-coal p-4 text-lg font-bold">
          <option value="">Select your store…</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {!store ? null : result ? (
        <ResultPanel result={result} storeName={store.name} busy={busy} onRedeem={() => call("redeem", result.voucher!.code)} onNext={reset} />
      ) : mode === "scan" ? (
        <>
          <CodeScanner
            onResult={(text) => {
              setMode("idle");
              call("verify", text);
            }}
            onError={(denied) => {
              setMode("idle");
              setCameraError(denied ? "Camera blocked. Allow camera for this site, or type the code." : "Camera unavailable here (needs HTTPS). Type the code instead.");
            }}
          />
          <Button variant="ghost" onClick={() => setMode("idle")}>
            Cancel scan
          </Button>
        </>
      ) : (
        <>
          <Button onClick={() => setMode("scan")} className="min-h-24 text-2xl">
            📷 Scan voucher
          </Button>
          {cameraError && <p className="text-center text-sm text-flame" role="alert">{cameraError}</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) call("verify", typed);
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              placeholder="Type code"
              aria-label="Voucher code"
              autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-2xl bg-coal px-4 font-mono text-2xl tracking-widest placeholder:text-cream/30"
            />
            <button type="submit" disabled={!typed.trim() || busy} className="rounded-2xl bg-flame px-5 font-display uppercase disabled:opacity-40">
              Check
            </button>
          </form>
          <NfcTagWriter store={store} />
        </>
      )}
    </div>
  );
}

const RESULT_STYLE: Record<Result["status"], { bg: string; title: string; emoji: string }> = {
  VALID: { bg: "bg-green-600", title: "Valid", emoji: "✅" },
  REDEEMED: { bg: "bg-green-700", title: "Redeemed", emoji: "🍗" },
  EXPIRED: { bg: "bg-flame", title: "Expired", emoji: "⏰" },
  WRONG_STORE: { bg: "bg-orange-600", title: "Wrong store", emoji: "📍" },
  ALREADY_REDEEMED: { bg: "bg-ash", title: "Already redeemed", emoji: "🚫" },
  NOT_FOUND: { bg: "bg-ash", title: "Not found", emoji: "❓" },
};

function ResultPanel({ result, storeName, busy, onRedeem, onNext }: { result: Result; storeName: string; busy: boolean; onRedeem: () => void; onNext: () => void }) {
  const style = RESULT_STYLE[result.status];
  const v = result.voucher;
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-4" role="status">
      <div className={`rounded-3xl p-6 text-center ${style.bg}`}>
        <div className="text-6xl">{style.emoji}</div>
        <h2 className="mt-2 font-display text-4xl uppercase">{style.title}</h2>
        {v && <p className="mt-2 font-mono text-2xl tracking-widest">{v.code}</p>}
        <p className="mt-2 text-cream/90">
          {result.status === "VALID" && `${v?.dealName} for ${v?.price}. Expires ${time(v!.expiresAt)}.`}
          {result.status === "REDEEMED" && `Ring up ${v?.dealName} at ${v?.price}.`}
          {result.status === "EXPIRED" && `This deal expired at ${time(v!.expiresAt)}. Do not honour.`}
          {result.status === "WRONG_STORE" && `Only valid at ${v?.storeName}, not ${storeName}.`}
          {result.status === "ALREADY_REDEEMED" && `Used at ${time(v!.redeemedAt!)}. Do not honour.`}
          {result.status === "NOT_FOUND" && "No voucher with that code. Check for typos."}
        </p>
      </div>
      {result.status === "VALID" && (
        <Button onClick={onRedeem} disabled={busy} className="min-h-24 text-2xl">
          Redeem now
        </Button>
      )}
      <Button variant="ghost" onClick={onNext}>
        Next customer
      </Button>
    </div>
  );
}

function NfcTagWriter({ store }: { store: StaffStore }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "waiting" | "done" | "error">("idle");
  useEffect(() => setSupported("NDEFReader" in window), []);
  if (!supported || !store.nfcTagSecret) return null;

  async function write() {
    setState("waiting");
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20_000);
    try {
      await writeCounterTag(counterTagUrl(window.location.origin, store.id, store.nfcTagSecret!), ctrl.signal);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <details className="rounded-2xl border-2 border-dashed border-cream/20 p-4 text-sm">
      <summary className="cursor-pointer font-bold">📶 Program counter NFC tag</summary>
      <p className="mt-2 text-cream/70">Writes a Twin Sync tag for {store.name}. Hold a blank NFC sticker to the back of this phone.</p>
      <button onClick={write} disabled={state === "waiting"} className="mt-3 w-full rounded-xl bg-ash p-3 font-semibold">
        {state === "waiting" ? "Hold tag to phone…" : state === "done" ? "✅ Tag written — write another" : state === "error" ? "Failed — try again" : "Write tag"}
      </button>
    </details>
  );
}
