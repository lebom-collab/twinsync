"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { DevPanel, PresenceNotice, StoreChip } from "@/components/Presence";
import { Wordmark } from "@/components/ui";

export default function Home() {
  const { config, presence } = useApp();
  const ready = presence.kind === "ok";

  return (
    <>
      <header className="pt-4">
        <Wordmark />
      </header>

      <section className="mt-6 -rotate-2 rounded-3xl bg-flame p-5 shadow-[0_8px_0_var(--color-flame-dark)]">
        <p className="font-display text-sm uppercase tracking-widest text-sun">In-store only · 10 min deal</p>
        <h1 className="font-display text-4xl uppercase leading-none">{config?.dealTitle ?? "Two Is Better"}</h1>
        <p className="mt-2 text-lg">
          {config?.dealItems ?? "2 Big Johns"} for <strong className="font-display text-sun">{config?.price ?? "…"}</strong>
        </p>
        <p className="mt-1 text-sm text-cream/80">Sync phones with a friend in the store and you both unlock it.</p>
      </section>

      <div className="mt-6 flex flex-col items-center gap-4">
        <StoreChip />
        <PresenceNotice />
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        {ready ? (
          <Link
            href="/sync"
            className="animate-pulse-ring flex h-60 w-60 flex-col items-center justify-center rounded-full bg-sun text-center font-display uppercase text-ink shadow-[0_10px_0_var(--color-sun-dark)] transition active:translate-y-2 active:shadow-[0_2px_0_var(--color-sun-dark)]"
          >
            <span className="text-5xl leading-none">Twin</span>
            <span className="text-5xl leading-none">Sync</span>
            <span className="mt-2 text-xs tracking-widest">Tap to start</span>
          </Link>
        ) : (
          <div aria-disabled className="flex h-60 w-60 flex-col items-center justify-center rounded-full bg-ash text-center font-display uppercase text-cream/30">
            <span className="text-5xl leading-none">Twin</span>
            <span className="text-5xl leading-none">Sync</span>
          </div>
        )}
      </div>

      <ol className="grid grid-cols-3 gap-2 text-center text-xs text-cream/70">
        <li className="rounded-xl bg-coal p-3"><b className="block font-display text-lg text-sun">1</b>One phone shows a code</li>
        <li className="rounded-xl bg-coal p-3"><b className="block font-display text-lg text-sun">2</b>Your twin scans it</li>
        <li className="rounded-xl bg-coal p-3"><b className="block font-display text-lg text-sun">3</b>Both unlock the deal</li>
      </ol>

      <DevPanel />
    </>
  );
}
