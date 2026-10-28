import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

// Rotating QR frames: "<sessionId>.<issuedAtBase36>.<sig>". The signature is
// keyed on the server secret plus the session's private token, so a frame
// can't be forged or extended. Phone A never sees the token itself; it just
// shows whatever frame the server sent last (every QR_ROTATE_SECONDS).

function sig(sessionToken: string, sessionId: string, issuedAtMs: number) {
  return createHmac("sha256", config.cookieSecret).update(`${sessionToken}|${sessionId}|${issuedAtMs}`).digest("base64url").slice(0, 16);
}

/** Frame for the current rotation step (stable within a step, so SSE only sends changes). */
export function makeQrFrame(sessionId: string, sessionToken: string, now: Date): string {
  const step = Math.floor(now.getTime() / config.qrRotateMs) * config.qrRotateMs;
  return `${sessionId}.${step.toString(36)}.${sig(sessionToken, sessionId, step)}`;
}

export function parseQrFrame(frame: string): { sessionId: string; issuedAtMs: number; sig: string } | null {
  const m = /^([a-z0-9]{10,40})\.([a-z0-9]{1,12})\.([A-Za-z0-9_-]{16})$/.exec(frame);
  if (!m) return null;
  const issuedAtMs = parseInt(m[2], 36);
  return Number.isFinite(issuedAtMs) ? { sessionId: m[1], issuedAtMs, sig: m[3] } : null;
}

export function verifyQrFrameSig(frame: { sessionId: string; issuedAtMs: number; sig: string }, sessionToken: string): boolean {
  const expected = Buffer.from(sig(sessionToken, frame.sessionId, frame.issuedAtMs));
  const given = Buffer.from(frame.sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
