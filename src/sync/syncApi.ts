// Channel-agnostic client for the sync endpoints.

import type { JoinCredential, PresenceProof } from "./SyncProvider";

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "BAD_REQUEST");
  return data as T;
}

export interface HostSession {
  sessionId: string;
  qr: string; // current rotating frame; fresh ones arrive via watchPairing
  shortCode: string;
  storeName: string;
  expiresAt: string;
  serverNow: string;
}

export const createHostSession = (proof: PresenceProof) => postJson<HostSession>("/api/sync", proof);

export const joinSession = (proof: PresenceProof, cred: JoinCredential) =>
  // An NFC tag read *is* the presence proof for that request.
  postJson<{ voucherId: string }>("/api/sync/join", { ...proof, ...cred });

/** The QR payload is a URL so a phone's native camera app can open it too. */
export function qrPayloadFor(frame: string): string {
  return `${window.location.origin}/sync?q=${encodeURIComponent(frame)}`;
}

export function frameFromQrPayload(text: string): string | null {
  try {
    const url = new URL(text);
    return url.pathname === "/sync" ? url.searchParams.get("q") : null;
  } catch {
    return null;
  }
}

export type PairUpdate = { status: "PENDING" | "PAIRED" | "EXPIRED" | "NOT_FOUND"; voucherId?: string | null; qr?: string | null };

/**
 * Phone A: wait for Phone B, receiving a fresh QR frame each rotation.
 * Uses Server-Sent Events, falling back to
 * polling every 2s if the stream errors (some proxies buffer SSE).
 */
export function watchPairing(sessionId: string, onUpdate: (u: PairUpdate) => void): () => void {
  let stopped = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  const es = typeof EventSource !== "undefined" ? new EventSource(`/api/sync/${sessionId}/events`) : null;

  const handle = (u: PairUpdate) => {
    if (stopped) return;
    onUpdate(u);
    if (u.status !== "PENDING") stop();
  };

  const poll = async () => {
    if (stopped) return;
    try {
      const res = await fetch(`/api/sync/${sessionId}`, { cache: "no-store" });
      handle(res.ok ? await res.json() : { status: "NOT_FOUND" });
    } catch {
      /* network blip; try again */
    }
    if (!stopped) pollTimer = setTimeout(poll, 2000);
  };

  if (es) {
    es.onmessage = (e) => handle(JSON.parse(e.data));
    es.onerror = () => {
      es.close();
      if (!stopped) poll();
    };
  } else {
    poll();
  }

  function stop() {
    stopped = true;
    es?.close();
    clearTimeout(pollTimer);
  }
  return stop;
}
