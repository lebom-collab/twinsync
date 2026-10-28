"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CountdownRing, formatClock, useRemainingMs } from "@/components/Countdown";
import { QrImage } from "@/components/QrImage";
import { BrandLogo, Header, MealPhoto, LinkButton, Notice, Spinner } from "@/components/ui";

interface Voucher {
  id: string;
  code: string;
  dealName: string;
  price: string;
  storeName: string;
  expiresAt: string;
  serverNow: string;
  state: "ACTIVE" | "EXPIRED" | "REDEEMED";
}

export default function VoucherPage() {
  return (
    <Suspense fallback={<Spinner label="Loading your deal…" />}>
      <VoucherScreen />
    </Suspense>
  );
}

function VoucherScreen() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const [voucher, setVoucher] = useState<Voucher | null | "missing">(null);
  const [celebrate, setCelebrate] = useState(params.get("new") === "1");

  const load = useCallback(async () => {
    const res = await fetch(`/api/vouchers/${id}`, { cache: "no-store" });
    setVoucher(res.ok ? await res.json() : "missing");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Pick up redemption at the till without the customer refreshing.
  useEffect(() => {
    if (!voucher || voucher === "missing" || voucher.state !== "ACTIVE") return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [voucher, load]);

  // Keep the screen on while the cashier scans (best effort).
  useEffect(() => {
    let lock: { release(): Promise<void> } | undefined;
    (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<typeof lock> } }).wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);

  const finishCelebration = useCallback(() => {
    setCelebrate(false);
    router.replace(`/voucher/${id}`); // don't replay the animation on refresh
  }, [id, router]);

  if (voucher === null) return <Spinner label="Loading your deal…" />;
  if (voucher === "missing")
    return (
      <>
        <Header />
        <div className="mt-8">
          <Notice emoji="🔍" title="Voucher not found" action={<LinkButton href="/">Home</LinkButton>}>
            Vouchers only open on the phone that unlocked them.
          </Notice>
        </div>
      </>
    );

  return (
    <>
      {celebrate && voucher.state === "ACTIVE" && <Unlock onDone={finishCelebration} />}
      <Header />
      <VoucherCard voucher={voucher} onExpire={load} />
    </>
  );
}

function VoucherCard({ voucher, onExpire }: { voucher: Voucher; onExpire: () => void }) {
  const left = useRemainingMs(voucher.expiresAt, voucher.serverNow);
  const active = voucher.state === "ACTIVE" && left > 0;

  useEffect(() => {
    // Client timer hit zero: ask the server, which is the source of truth.
    if (voucher.state === "ACTIVE" && left === 0) onExpire();
  }, [left, voucher.state, onExpire]);

  const [title, items] = voucher.dealName.split(" – ");

  return (
    <div className="mt-4 flex flex-col items-center gap-5 pb-4">
      <section className={`relative w-full overflow-hidden rounded-3xl pb-5 text-center ${active ? "bg-flame" : "bg-ash"}`}>
        <MealPhoto className={`mb-4 aspect-[16/9] bg-ink ${active ? "" : "opacity-25 grayscale"}`} />
        <p className="font-display text-sm uppercase tracking-widest text-sun">{voucher.storeName}</p>
        <h1 className={`font-display text-4xl uppercase leading-none ${active ? "" : "opacity-25"}`}>{title}</h1>
        <p className={`mt-1 text-lg ${active ? "" : "opacity-25"}`}>
          {items} for <strong className="font-display text-2xl text-sun">{voucher.price}</strong>
        </p>
        {!active && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className={`-rotate-12 rounded-xl border-4 bg-ink px-4 py-1 font-display text-4xl uppercase ${voucher.state === "REDEEMED" ? "border-sun text-sun" : "border-flame text-flame"}`}>
              {voucher.state === "REDEEMED" ? "Enjoy!" : "Expired"}
            </span>
          </div>
        )}
      </section>

      {active ? (
        <>
          <CountdownRing leftMs={left} totalMs={10 * 60_000} warnBelowMs={60_000} size={200}>
            <span className={`font-display text-5xl ${left <= 60_000 ? "text-flame" : "text-cream"}`}>{formatClock(left)}</span>
            <span className="text-xs uppercase tracking-widest text-cream/60">left to redeem</span>
          </CountdownRing>
          <div className="flex w-full flex-col items-center gap-3 rounded-3xl bg-cream p-5 text-ink">
            <p className="font-display text-sm uppercase tracking-widest">Show this to the cashier</p>
            <QrImage value={voucher.code} size={180} label={`Voucher code ${voucher.code}`} />
            <p className="font-mono text-3xl font-bold tracking-[0.25em]">{voucher.code}</p>
            <p className="text-xs text-ink/60">Valid only at {voucher.storeName} · one use</p>
          </div>
        </>
      ) : voucher.state === "REDEEMED" ? (
        <Notice emoji="🍗" title="Redeemed!" action={<LinkButton href="/">Done</LinkButton>}>
          Enjoy your Big Johns. Two really is better.
        </Notice>
      ) : (
        <Notice emoji="⏰" title="This deal has expired" action={<LinkButton href="/" variant="ghost">Home</LinkButton>}>
          Twin Sync deals last 10 minutes after unlocking. Catch you next time!
        </Notice>
      )}
    </div>
  );
}

/** Full-screen unlock celebration: two halves slam together, stamp, confetti. */
function Unlock({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    let cancelled = false;
    import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const colors = ["#ffc72c", "#e31837", "#fff8e6"];
      setTimeout(() => confetti({ particleCount: 140, spread: 90, origin: { y: 0.55 }, colors }), 450);
      setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors }), 750);
      setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors }), 750);
    });
    const t = setTimeout(onDone, 3200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [onDone]);

  return (
    <button onClick={onDone} aria-label="Continue to voucher" className="stripes fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-ink">
      <div className="animate-pop-in">
        <BrandLogo size={96} className="shadow-2xl" />
      </div>
      <div className="flex items-center gap-2">
        <Half className="animate-slide-left bg-sun text-ink" label="Big John" />
        <Half className="animate-slide-right bg-flame text-cream" label="Big John" />
      </div>
      <div className="animate-pop-in text-center [animation-delay:0.45s]">
        <p className="font-display text-6xl uppercase leading-none text-sun">Synced!</p>
        <p className="mt-2 font-display text-2xl uppercase text-cream">Two is better</p>
      </div>
      <p className="animate-pop-in text-sm text-cream/60 [animation-delay:1.2s]">Tap to see your deal</p>
    </button>
  );
}

/** Placeholder product shape. Swap for real artwork later. */
function Half({ className, label }: { className: string; label: string }) {
  return (
    <div className={`flex h-36 w-32 flex-col items-center justify-center rounded-[2.5rem] font-display uppercase shadow-2xl ${className}`}>
      <span className="text-4xl">🍔</span>
      <span className="mt-1 text-sm">{label}</span>
    </div>
  );
}
