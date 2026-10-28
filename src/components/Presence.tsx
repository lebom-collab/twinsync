"use client";

import { useApp } from "./AppProvider";
import { Button, Notice, Spinner } from "./ui";

/** Friendly states for "are you in a store?". Renders nothing when OK. */
export function PresenceNotice() {
  const { presence, refreshPresence, config } = useApp();
  const retry = <Button variant="ghost" onClick={refreshPresence}>Try again</Button>;
  const devHint = config?.devMode ? <p className="mt-2 text-sm text-sun">Testing at your desk? Pick a store in Dev mode below.</p> : null;

  switch (presence.kind) {
    case "ok":
      return null;
    case "checking":
      return <Spinner label="Finding your store…" />;
    case "insecure":
      return (
        <Notice emoji="🔒" title="Needs a secure link">
          Location and camera only work over HTTPS. Open the https:// link (see README).
          {devHint}
        </Notice>
      );
    case "unsupported":
      return <Notice emoji="🧭" title="No location on this device">Your browser can&apos;t share location, so we can&apos;t check you&apos;re in-store.{devHint}</Notice>;
    case "denied":
      return (
        <Notice emoji="📍" title="Location is off" action={retry}>
          We only use it to check you&apos;re inside a store. Turn on location for this site in your browser settings, then try again.
          {devHint}
        </Notice>
      );
    case "unavailable":
      return <Notice emoji="📡" title="Can't find you" action={retry}>We couldn&apos;t get a GPS fix. Step closer to a window or the entrance and try again.{devHint}</Notice>;
    case "not_in_store":
      return (
        <Notice emoji="🍗" title="Not in a store yet" action={retry}>
          Twin Sync only unlocks inside a participating store. Pop in, grab a twin, and try again!
          {devHint}
        </Notice>
      );
  }
}

export function StoreChip() {
  const { presence } = useApp();
  if (presence.kind !== "ok") return null;
  return (
    <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-coal px-4 py-2 text-sm font-semibold">
      <span className="h-2.5 w-2.5 rounded-full bg-green-400" aria-hidden /> {presence.store.name}
    </div>
  );
}

export function DevPanel() {
  const { config, devStoreId, setDevStoreId } = useApp();
  if (!config?.devMode) return null;

  async function resetDevice() {
    await fetch("/api/dev/reset", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <details className="mt-6 rounded-2xl border-2 border-dashed border-sun/50 p-4 text-sm">
      <summary className="cursor-pointer font-bold text-sun">🛠 Dev mode {devStoreId ? "· location bypassed" : ""}</summary>
      <label className="mt-3 block">
        <span className="mb-1 block text-cream/70">Pretend I&apos;m at</span>
        <select
          className="w-full rounded-xl bg-coal p-3 text-cream"
          value={devStoreId ?? ""}
          onChange={(e) => setDevStoreId(e.target.value || null)}
        >
          <option value="">Use real GPS</option>
          {config.devStores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <button onClick={resetDevice} className="mt-3 w-full rounded-xl bg-ash p-3 font-semibold">
        Reset this device (new ID, clears daily limit)
      </button>
      <p className="mt-2 text-cream/50">Server ignores the store override unless DEV_MODE=true.</p>
    </details>
  );
}
