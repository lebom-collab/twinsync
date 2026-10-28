import { NextResponse } from "next/server";
import { SyncError } from "./errors";

const STATUS: Record<string, number> = {
  NOT_IN_STORE: 403,
  LOCATION_REQUIRED: 400,
  TOKEN_NOT_FOUND: 404,
  TOKEN_EXPIRED: 410,
  TOKEN_USED: 409,
  SAME_DEVICE: 409,
  STORE_MISMATCH: 403,
  TOO_FAR: 403,
  QR_STALE: 410,
  SCAN_REQUIRED: 403,
  DAILY_LIMIT: 429,
  BAD_NFC_TAG: 403,
  BAD_REQUEST: 400,
};

/** Wrap a route handler so SyncErrors become `{ error: CODE }` responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof SyncError) {
        return NextResponse.json({ error: e.code }, { status: STATUS[e.code] ?? 400 });
      }
      console.error(e);
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown) => (typeof v === "string" && v.length < 256 ? v : undefined);
