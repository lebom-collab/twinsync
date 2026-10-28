"use client";

import { useEffect, useState } from "react";

/**
 * Milliseconds left until `expiresAt`, corrected for the device clock being
 * wrong (uses the server's `serverNow` at fetch time). Display only: expiry
 * is always enforced on the server.
 */
export function useRemainingMs(expiresAt: string, serverNow: string) {
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const end = new Date(expiresAt).getTime();
  const calc = () => Math.max(0, end - (Date.now() + offset));
  const [left, setLeft] = useState(calc);

  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, offset]);
  return left;
}

export function formatClock(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Circular countdown ring. Turns red when under `warnBelowMs`. */
export function CountdownRing({ leftMs, totalMs, warnBelowMs, size = 220, children }: { leftMs: number; totalMs: number; warnBelowMs: number; size?: number; children?: React.ReactNode }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, leftMs / totalMs));
  const warn = leftMs <= warnBelowMs;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-ash)" strokeWidth={12} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={warn ? "var(--color-flame)" : "var(--color-sun)"}
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
