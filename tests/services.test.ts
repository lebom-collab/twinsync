import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { SyncError } from "@/lib/errors";
import { createSession, getSessionStatus, joinSession } from "@/lib/services/syncService";
import { redeemVoucher, verifyVoucher } from "@/lib/services/voucherService";
import { resolveStore } from "@/lib/services/storeService";

const T0 = new Date("2026-10-28T10:00:00Z");
const at = (secs: number) => new Date(T0.getTime() + secs * 1000);

async function device() {
  return (await prisma.device.create({ data: {} })).id;
}

async function expectSyncError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e) => e instanceof SyncError && e.code === code);
}

beforeEach(async () => {
  await prisma.voucher.deleteMany();
  await prisma.syncSession.deleteMany();
  await prisma.device.deleteMany();
  await prisma.store.deleteMany();
  await prisma.store.createMany({
    data: [
      { id: "store-a", name: "Store A", lat: -26.1929, lng: 28.0305, radiusMeters: 100, nfcTagSecret: "secret-a" },
      { id: "store-b", name: "Store B", lat: -26.1458, lng: 28.0416, radiusMeters: 100 },
    ],
  });
});

afterAll(() => prisma.$disconnect());

describe("sync handshake", () => {
  it("pairs two devices and issues one voucher each, 10 minutes, tied to the store", async () => {
    const [a, b] = [await device(), await device()];
    const s = await createSession(a, "store-a", T0);
    expect(s.expiresAt.getTime() - T0.getTime()).toBe(60_000);

    const res = await joinSession({ deviceId: b, storeId: "store-a", token: s.token, now: at(10) });
    expect(res.initiatorVoucher.deviceId).toBe(a);
    expect(res.joinerVoucher.deviceId).toBe(b);
    expect(res.joinerVoucher.storeId).toBe("store-a");
    expect(res.joinerVoucher.priceCents).toBe(5990);
    expect(res.joinerVoucher.expiresAt.getTime() - at(10).getTime()).toBe(600_000);

    const status = await getSessionStatus(s.id, a, at(11));
    expect(status).toMatchObject({ status: "PAIRED", voucherId: res.initiatorVoucher.id });
  });

  it("joins by short code (NFC / no-camera path)", async () => {
    const [a, b] = [await device(), await device()];
    const s = await createSession(a, "store-a", T0);
    const res = await joinSession({ deviceId: b, storeId: "store-a", shortCode: s.shortCode.toLowerCase(), now: at(5) });
    expect(res.joinerVoucher.deviceId).toBe(b);
  });

  it("rejects an expired token (60s)", async () => {
    const [a, b] = [await device(), await device()];
    const s = await createSession(a, "store-a", T0);
    await expectSyncError(joinSession({ deviceId: b, storeId: "store-a", token: s.token, now: at(60) }), "TOKEN_EXPIRED");
    expect((await getSessionStatus(s.id, a, at(61)))?.status).toBe("EXPIRED");
  });

  it("token is single use", async () => {
    const [a, b, c] = [await device(), await device(), await device()];
    const s = await createSession(a, "store-a", T0);
    await joinSession({ deviceId: b, storeId: "store-a", token: s.token, now: at(5) });
    await expectSyncError(joinSession({ deviceId: c, storeId: "store-a", token: s.token, now: at(6) }), "TOKEN_USED");
  });

  it("only one of two simultaneous scans wins", async () => {
    const [a, b, c] = [await device(), await device(), await device()];
    const s = await createSession(a, "store-a", T0);
    const results = await Promise.allSettled([
      joinSession({ deviceId: b, storeId: "store-a", token: s.token, now: at(5) }),
      joinSession({ deviceId: c, storeId: "store-a", token: s.token, now: at(5) }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.voucher.count()).toBe(2);
  });

  it("a device can't sync with itself", async () => {
    const a = await device();
    const s = await createSession(a, "store-a", T0);
    await expectSyncError(joinSession({ deviceId: a, storeId: "store-a", token: s.token, now: at(5) }), "SAME_DEVICE");
  });

  it("both devices must be at the same store", async () => {
    const [a, b] = [await device(), await device()];
    const s = await createSession(a, "store-a", T0);
    await expectSyncError(joinSession({ deviceId: b, storeId: "store-b", token: s.token, now: at(5) }), "STORE_MISMATCH");
  });

  it("one deal per device per day", async () => {
    const [a, b, c] = [await device(), await device(), await device()];
    const s1 = await createSession(a, "store-a", T0);
    await joinSession({ deviceId: b, storeId: "store-a", token: s1.token, now: at(5) });

    // a has had its deal today: can't host again...
    await expectSyncError(createSession(a, "store-a", at(700)), "DAILY_LIMIT");
    // ...and c can't use b as a twin either
    const s2 = await createSession(c, "store-a", at(700));
    await expectSyncError(joinSession({ deviceId: b, storeId: "store-a", token: s2.token, now: at(705) }), "DAILY_LIMIT");
    // the failed join rolled back: session still open, no extra vouchers
    expect((await getSessionStatus(s2.id, c, at(706)))?.status).toBe("PENDING");
    expect(await prisma.voucher.count()).toBe(2);

    // next Joburg day (midnight = 22:00 UTC) is fine
    const tomorrow = new Date("2026-10-28T22:00:01Z");
    expect((await createSession(a, "store-a", tomorrow)).id).toBeTruthy();
  });

  it("hides session status from non-participants", async () => {
    const [a, x] = [await device(), await device()];
    const s = await createSession(a, "store-a", T0);
    expect(await getSessionStatus(s.id, x, T0)).toBeNull();
  });
});

describe("staff redemption", () => {
  async function issued() {
    const [a, b] = [await device(), await device()];
    const s = await createSession(a, "store-a", T0);
    return (await joinSession({ deviceId: b, storeId: "store-a", token: s.token, now: T0 })).joinerVoucher;
  }

  it("VALID then REDEEMED then ALREADY_REDEEMED", async () => {
    const v = await issued();
    expect((await verifyVoucher(v.code, "store-a", at(60))).status).toBe("VALID");
    expect((await redeemVoucher(v.code, "store-a", at(60))).status).toBe("REDEEMED");
    expect((await redeemVoucher(v.code, "store-a", at(61))).status).toBe("ALREADY_REDEEMED");
  });

  it("WRONG_STORE does not burn the voucher", async () => {
    const v = await issued();
    expect((await redeemVoucher(v.code, "store-b", at(60))).status).toBe("WRONG_STORE");
    expect((await redeemVoucher(v.code, "store-a", at(61))).status).toBe("REDEEMED");
  });

  it("EXPIRED after 10 minutes, checked on the server", async () => {
    const v = await issued();
    expect((await redeemVoucher(v.code, "store-a", at(600))).status).toBe("EXPIRED");
    expect((await prisma.voucher.findUnique({ where: { id: v.id } }))?.redeemedAt).toBeNull();
  });

  it("accepts lowercase / spaced codes, NOT_FOUND for junk", async () => {
    const v = await issued();
    const messy = `${v.code.slice(0, 4).toLowerCase()} ${v.code.slice(4)}`;
    expect((await verifyVoucher(messy, "store-a", at(1))).status).toBe("VALID");
    expect((await verifyVoucher("NOPE1234", "store-a", at(1))).status).toBe("NOT_FOUND");
  });

  it("double-submit from two tills redeems once", async () => {
    const v = await issued();
    const r = await Promise.all([redeemVoucher(v.code, "store-a", at(5)), redeemVoucher(v.code, "store-a", at(5))]);
    expect(r.map((x) => x.status).sort()).toEqual(["ALREADY_REDEEMED", "REDEEMED"]);
  });
});

describe("store resolution", () => {
  it("resolves by GPS within radius", async () => {
    expect((await resolveStore({ location: { lat: -26.1931, lng: 28.0306 } })).id).toBe("store-a");
  });
  it("NOT_IN_STORE when far away", async () => {
    await expectSyncError(resolveStore({ location: { lat: -26.0, lng: 28.0 } }), "NOT_IN_STORE");
  });
  it("ignores dev override when DEV_MODE is off", async () => {
    await expectSyncError(resolveStore({ devStoreId: "store-a" }), "LOCATION_REQUIRED");
  });
  it("accepts a genuine NFC tag, rejects a forged one", async () => {
    expect((await resolveStore({ nfc: { storeId: "store-a", tagSecret: "secret-a" } })).id).toBe("store-a");
    await expectSyncError(resolveStore({ nfc: { storeId: "store-a", tagSecret: "guess" } }), "BAD_NFC_TAG");
    await expectSyncError(resolveStore({ nfc: { storeId: "store-b", tagSecret: "" } }), "BAD_NFC_TAG");
  });
});
