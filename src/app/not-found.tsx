import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl">🍗</div>
      <h1 className="font-display text-3xl uppercase text-sun">Nothing here</h1>
      <p className="text-cream/70">That page wandered off.</p>
      <Link href="/" className="rounded-2xl bg-sun px-6 py-4 font-display uppercase text-ink">
        Home
      </Link>
    </div>
  );
}
