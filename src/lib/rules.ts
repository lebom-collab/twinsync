// Pure validation rules. No DB, no clock: `now` is always passed in so the
// rules are deterministic and unit-testable. Services call these; they must
// never be re-implemented on the client.

import type { RedeemStatus, SyncErrorCode } from "./errors";
import { haversineMeters, type LatLng } from "./geo";

export interface SessionLike {
  storeId: string;
  initiatorDeviceId: string;
  joinerDeviceId: string | null;
  status: string;
  expiresAt: Date;
}

export interface VoucherLike {
  storeId: string;
  expiresAt: Date;
  redeemedAt: Date | null;
}

export function isExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export type ProximityCheck =
  | { mode: "store"; joinerStoreId: string }
  | {
      mode: "twins";
      initiator: LatLng | null;
      joiner: LatLng | null;
      maxDistanceMeters: number;
      /** Dev mode or an NFC counter tag stands in for missing GPS. */
      locationWaived: boolean;
    };

/**
 * Can `joinerDeviceId` join `session`?
 * Order matters: report "used" before "expired" so a late scan of a code that
 * was already paired says so, rather than just "expired".
 *
 * Proximity, by mode:
 * - "store": both phones resolved to the same store.
 * - "twins": the two phones' GPS fixes are within maxDistanceMeters. GPS is
 *   spoofable, so this is a speed bump; the till check is the real safeguard.
 */
export function checkJoin(
  session: SessionLike | null,
  joinerDeviceId: string,
  proximity: ProximityCheck,
  now: Date,
): SyncErrorCode | null {
  if (!session) return "TOKEN_NOT_FOUND";
  if (session.status !== "PENDING" || session.joinerDeviceId) return "TOKEN_USED";
  if (isExpired(session.expiresAt, now)) return "TOKEN_EXPIRED";
  if (session.initiatorDeviceId === joinerDeviceId) return "SAME_DEVICE";
  if (proximity.mode === "store") {
    if (session.storeId !== proximity.joinerStoreId) return "STORE_MISMATCH";
  } else if (proximity.initiator && proximity.joiner) {
    if (haversineMeters(proximity.initiator, proximity.joiner) > proximity.maxDistanceMeters) return "TOO_FAR";
  } else if (!proximity.locationWaived) {
    return "LOCATION_REQUIRED";
  }
  return null;
}

/** Has this device used up its daily deal allowance? */
export function hasReachedDailyLimit(dealsToday: number, maxPerDay: number): boolean {
  return dealsToday >= maxPerDay;
}

/**
 * What should the cashier see for this voucher at this store?
 * "Already redeemed" outranks "expired" so staff know it was used.
 */
export function checkRedeem(
  voucher: VoucherLike | null,
  staffStoreId: string,
  now: Date,
): RedeemStatus {
  if (!voucher) return "NOT_FOUND";
  if (voucher.redeemedAt) return "ALREADY_REDEEMED";
  if (voucher.storeId !== staffStoreId) return "WRONG_STORE";
  if (isExpired(voucher.expiresAt, now)) return "EXPIRED";
  return "VALID";
}

/**
 * Start of the calendar day containing `now` in `timeZone`, as a UTC Date.
 * Used for "one deal per device per day". Assumes the zone's offset doesn't
 * change between midnight and `now` (true for Africa/Johannesburg, no DST).
 */
export function startOfDayInZone(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = wallAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")) - offsetMs);
}

/**
 * Is a rotating-QR frame issued at `issuedAtMs` still acceptable at `now`?
 * Frames from the future (clock games) or older than `maxAgeMs` are rejected.
 */
export function isQrFrameFresh(issuedAtMs: number, now: Date, maxAgeMs: number, rotateMs: number): boolean {
  const age = now.getTime() - issuedAtMs;
  return age >= -rotateMs && age <= maxAgeMs;
}
