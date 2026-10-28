"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

/** Round brand logo. The source PNG has a white square background, so clip it to a circle. */
export function BrandLogo({ size, className = "" }: { size: number; className?: string }) {
  return <Image src="/brand/logo.png" alt="Chicken Licken" width={size} height={size} priority className={`rounded-full ${className}`} />;
}

/**
 * Promo meal photo from public/brand/meal.png. Renders nothing if the file
 * is missing, so the layout still works without it.
 */
export function MealPhoto({ className = "" }: { className?: string }) {
  const [missing, setMissing] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // onError can fire before hydration, so also check once mounted.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setMissing(true);
  }, []);
  if (missing) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src="/brand/meal.png" alt="Big John meal" onError={() => setMissing(true)} className={`w-full object-cover ${className}`} />
  );
}

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3">
      <BrandLogo size={small ? 44 : 64} className="shrink-0 shadow-lg" />
      <span className={`-rotate-3 font-display uppercase leading-none text-cream ${small ? "text-2xl" : "text-4xl"}`}>
        Twin <span className="text-flame">Sync</span>
      </span>
    </div>
  );
}

export function Header({ back }: { back?: string }) {
  return (
    <header className="flex items-center justify-between py-2">
      <Link href="/" aria-label="Home">
        <Wordmark small />
      </Link>
      {back && (
        <Link href={back} className="rounded-full border-2 border-cream/30 px-4 py-2 text-sm font-bold">
          ← Back
        </Link>
      )}
    </header>
  );
}

type Variant = "sun" | "flame" | "ghost";
const VARIANTS: Record<Variant, string> = {
  sun: "bg-sun text-ink shadow-[0_6px_0_var(--color-sun-dark)] active:shadow-[0_2px_0_var(--color-sun-dark)]",
  flame: "bg-flame text-cream shadow-[0_6px_0_var(--color-flame-dark)] active:shadow-[0_2px_0_var(--color-flame-dark)]",
  ghost: "border-2 border-cream/40 text-cream",
};

export function Button({ variant = "sun", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`min-h-16 w-full rounded-2xl px-6 font-display text-xl uppercase tracking-wide transition active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function LinkButton({ variant = "sun", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      {...props}
      className={`flex min-h-16 w-full items-center justify-center rounded-2xl px-6 text-center font-display text-xl uppercase tracking-wide transition active:translate-y-1 ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Notice({ emoji, title, children, action }: { emoji: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-cream/15 bg-coal p-6 text-center">
      <div className="text-5xl" aria-hidden>
        {emoji}
      </div>
      <h2 className="font-display text-2xl uppercase text-sun">{title}</h2>
      {children && <div className="text-cream/80">{children}</div>}
      {action && <div className="mt-2 w-full">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-cream/70" role="status">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-sun border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
