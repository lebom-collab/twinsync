import { describe, expect, it } from "vitest";
import { checkJoin, checkRedeem, hasReachedDailyLimit, isExpired, isQrFrameFresh, startOfDayInZone, type ProximityCheck } from "@/lib/rules";
import { findStoreForLocation, haversineMeters } from "@/lib/geo";

const now = new Date("2026-10-28T10:00:00Z");
const inSecs = (s: number) => new Date(now.getTime() + s * 1000);

const pending = {
  storeId: "store-a",
  initiatorDeviceId: "dev-a",
  joinerDeviceId: null,
  status: "PENDING",
  expiresAt: inSecs(60),
};

describe("isExpired", () => {
  it("is not expired before expiresAt", () => expect(isExpired(inSecs(1), now)).toBe(false));
  it("is expired exactly at expiresAt", () => expect(isExpired(now, now)).toBe(true));
  it("is expired after expiresAt", () => expect(isExpired(inSecs(-1), now)).toBe(true));
});

const atStore = (joinerStoreId: string): ProximityCheck => ({ mode: "store", joinerStoreId });

describe("checkJoin", () => {
  it("accepts a fresh token from another device at the same store", () => {
    expect(checkJoin(pending, "dev-b", atStore("store-a"), now)).toBeNull();
  });
  it("rejects an unknown token", () => {
    expect(checkJoin(null, "dev-b", atStore("store-a"), now)).toBe("TOKEN_NOT_FOUND");
  });
  it("rejects an expired token", () => {
    expect(checkJoin({ ...pending, expiresAt: inSecs(-1) }, "dev-b", atStore("store-a"), now)).toBe("TOKEN_EXPIRED");
  });
  it("rejects a token that was already used (single use)", () => {
    expect(checkJoin({ ...pending, status: "PAIRED", joinerDeviceId: "dev-c" }, "dev-b", atStore("store-a"), now)).toBe("TOKEN_USED");
  });
  it("reports used before expired", () => {
    expect(checkJoin({ ...pending, status: "PAIRED", joinerDeviceId: "dev-c", expiresAt: inSecs(-5) }, "dev-b", atStore("store-a"), now)).toBe("TOKEN_USED");
  });
  it("rejects syncing with yourself", () => {
    expect(checkJoin(pending, "dev-a", atStore("store-a"), now)).toBe("SAME_DEVICE");
  });
  it("rejects a joiner at a different store", () => {
    expect(checkJoin(pending, "dev-b", atStore("store-b"), now)).toBe("STORE_MISMATCH");
  });
});

describe("checkJoin in twins mode", () => {
  const here = { lat: -26.1458, lng: 28.0416 };
  const twins = (joiner: { lat: number; lng: number } | null, initiator: { lat: number; lng: number } | null = here, locationWaived = false): ProximityCheck => ({
    mode: "twins",
    initiator,
    joiner,
    maxDistanceMeters: 50,
    locationWaived,
  });
  it("accepts twins ~10m apart", () => {
    expect(checkJoin(pending, "dev-b", twins({ lat: -26.14589, lng: 28.0416 }), now)).toBeNull();
  });
  it("rejects twins ~200m apart", () => {
    expect(checkJoin(pending, "dev-b", twins({ lat: -26.1476, lng: 28.0416 }), now)).toBe("TOO_FAR");
  });
  it("ignores which store each twin is nearest to", () => {
    expect(checkJoin({ ...pending, storeId: "elsewhere" }, "dev-b", twins(here), now)).toBeNull();
  });
  it("needs both GPS fixes unless waived (dev mode)", () => {
    expect(checkJoin(pending, "dev-b", twins(null), now)).toBe("LOCATION_REQUIRED");
    expect(checkJoin(pending, "dev-b", twins(here, null), now)).toBe("LOCATION_REQUIRED");
    expect(checkJoin(pending, "dev-b", twins(null, null, true), now)).toBeNull();
  });
  it("still applies the basic rules first", () => {
    expect(checkJoin(pending, "dev-a", twins(here), now)).toBe("SAME_DEVICE");
    expect(checkJoin({ ...pending, expiresAt: inSecs(-1) }, "dev-b", twins(here), now)).toBe("TOKEN_EXPIRED");
  });
});

describe("rotating QR freshness", () => {
  const rotate = 5000;
  const maxAge = 30_000;
  it("accepts a frame from a few seconds ago", () => expect(isQrFrameFresh(now.getTime() - 4000, now, maxAge, rotate)).toBe(true));
  it("accepts a frame right at the limit", () => expect(isQrFrameFresh(now.getTime() - maxAge, now, maxAge, rotate)).toBe(true));
  it("rejects a screenshot older than 30s", () => expect(isQrFrameFresh(now.getTime() - maxAge - 1, now, maxAge, rotate)).toBe(false));
  it("rejects frames from the future", () => expect(isQrFrameFresh(now.getTime() + rotate + 1, now, maxAge, rotate)).toBe(false));
});

describe("checkRedeem", () => {
  const voucher = { storeId: "store-a", expiresAt: inSecs(600), redeemedAt: null };
  it("is VALID at the right store before expiry", () => expect(checkRedeem(voucher, "store-a", now)).toBe("VALID"));
  it("is NOT_FOUND for unknown codes", () => expect(checkRedeem(null, "store-a", now)).toBe("NOT_FOUND"));
  it("is WRONG_STORE at another store", () => expect(checkRedeem(voucher, "store-b", now)).toBe("WRONG_STORE"));
  it("is EXPIRED after 10 minutes", () => expect(checkRedeem(voucher, "store-a", inSecs(600))).toBe("EXPIRED"));
  it("is ALREADY_REDEEMED once used, even if also expired", () => {
    expect(checkRedeem({ ...voucher, redeemedAt: now, expiresAt: inSecs(-1) }, "store-a", now)).toBe("ALREADY_REDEEMED");
  });
});

describe("daily limit", () => {
  it("allows the first deal", () => expect(hasReachedDailyLimit(0, 1)).toBe(false));
  it("blocks the second deal", () => expect(hasReachedDailyLimit(1, 1)).toBe(true));
  it("respects a configured higher limit", () => expect(hasReachedDailyLimit(1, 3)).toBe(false));

  it("computes Johannesburg midnight (UTC+2)", () => {
    expect(startOfDayInZone(new Date("2026-10-28T10:00:00Z"), "Africa/Johannesburg").toISOString()).toBe("2026-10-27T22:00:00.000Z");
    // 23:30 UTC on the 27th is already 01:30 on the 28th in Joburg
    expect(startOfDayInZone(new Date("2026-10-27T23:30:00Z"), "Africa/Johannesburg").toISOString()).toBe("2026-10-27T22:00:00.000Z");
  });
});

describe("geo", () => {
  const stores = [
    { id: "a", lat: -26.1929, lng: 28.0305, radiusMeters: 100 },
    { id: "b", lat: -26.1458, lng: 28.0416, radiusMeters: 100 },
  ];
  it("measures roughly 5.3km between Braamfontein and Rosebank demo points", () => {
    const d = haversineMeters(stores[0], stores[1]);
    expect(d).toBeGreaterThan(5000);
    expect(d).toBeLessThan(5600);
  });
  it("finds the store when within radius", () => {
    expect(findStoreForLocation({ lat: -26.1932, lng: 28.0307 }, stores)?.store.id).toBe("a");
  });
  it("returns null when ~200m away", () => {
    expect(findStoreForLocation({ lat: -26.1947, lng: 28.0305 }, stores)).toBeNull();
  });
});
