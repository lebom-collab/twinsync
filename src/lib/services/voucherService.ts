import { normaliseCode } from "../codes";
import { formatPrice, config } from "../config";
import { prisma } from "../db";
import type { RedeemStatus } from "../errors";
import { checkRedeem, isExpired } from "../rules";

/** A customer's own voucher. Other devices get null. */
export async function getVoucherForDevice(id: string, deviceId: string, now = new Date()) {
  const v = await prisma.voucher.findUnique({ where: { id }, include: { store: true } });
  if (!v || v.deviceId !== deviceId) return null;
  return {
    id: v.id,
    code: v.code,
    dealName: config.dealName,
    price: formatPrice(v.priceCents),
    storeName: v.store.name,
    expiresAt: v.expiresAt.toISOString(),
    serverNow: now.toISOString(),
    state: v.redeemedAt ? "REDEEMED" : isExpired(v.expiresAt, now) ? "EXPIRED" : "ACTIVE",
  } as const;
}

async function findByCode(code: string) {
  return prisma.voucher.findUnique({ where: { code: normaliseCode(code) }, include: { store: true } });
}

function describe(v: Awaited<ReturnType<typeof findByCode>>) {
  return v
    ? { code: v.code, dealName: config.dealName, storeName: v.store.name, price: formatPrice(v.priceCents), expiresAt: v.expiresAt.toISOString(), redeemedAt: v.redeemedAt?.toISOString() ?? null }
    : null;
}

/** Staff lookup: what would happen if we redeemed this here, now? */
export async function verifyVoucher(code: string, staffStoreId: string, now = new Date()) {
  const v = await findByCode(code);
  return { status: checkRedeem(v, staffStoreId, now), voucher: describe(v) };
}

/**
 * Staff redemption. One conditional UPDATE so a voucher can't be redeemed
 * twice even if two tills submit at once.
 */
export async function redeemVoucher(code: string, staffStoreId: string, now = new Date()): Promise<{ status: RedeemStatus | "REDEEMED"; voucher: ReturnType<typeof describe> }> {
  const normalised = normaliseCode(code);
  const res = await prisma.voucher.updateMany({
    where: { code: normalised, storeId: staffStoreId, redeemedAt: null, expiresAt: { gt: now } },
    data: { redeemedAt: now },
  });
  const v = await findByCode(normalised);
  if (res.count === 1) return { status: "REDEEMED", voucher: describe(v) };
  return { status: checkRedeem(v, staffStoreId, now), voucher: describe(v) };
}
