import { Prisma } from "@prisma/client";
import { newShortCode, newSyncToken, newVoucherCode, normaliseCode } from "../codes";
import { config } from "../config";
import { prisma } from "../db";
import { SyncError } from "../errors";
import { checkJoin, hasReachedDailyLimit, isExpired, startOfDayInZone } from "../rules";

type Tx = Prisma.TransactionClient;

async function dealsToday(db: Tx | typeof prisma, deviceId: string, now: Date) {
  return db.voucher.count({
    where: { deviceId, createdAt: { gte: startOfDayInZone(now, config.dayTimezone) } },
  });
}

async function assertUnderDailyLimit(db: Tx | typeof prisma, deviceId: string, now: Date) {
  if (hasReachedDailyLimit(await dealsToday(db, deviceId, now), config.maxDealsPerDevicePerDay)) {
    throw new SyncError("DAILY_LIMIT");
  }
}

/** Phone A: open a 60-second, single-use sync session at `storeId`. */
export async function createSession(deviceId: string, storeId: string, now = new Date()) {
  await assertUnderDailyLimit(prisma, deviceId, now);

  // Short codes only need to be unique among live sessions at one store.
  let shortCode = newShortCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.syncSession.findFirst({
      where: { storeId, shortCode, status: "PENDING", expiresAt: { gt: now } },
    });
    if (!clash) break;
    shortCode = newShortCode();
  }

  return prisma.syncSession.create({
    data: {
      token: newSyncToken(),
      shortCode,
      storeId,
      initiatorDeviceId: deviceId,
      expiresAt: new Date(now.getTime() + config.syncTokenTtlMs),
    },
  });
}

export interface JoinInput {
  deviceId: string;
  storeId: string; // where the joiner is, already resolved server-side
  token?: string; // from the QR code
  shortCode?: string; // typed (camera denied / NFC path)
  now?: Date;
}

/** Phone B: claim the session and issue a voucher to both phones. */
export async function joinSession({ deviceId, storeId, token, shortCode, now = new Date() }: JoinInput) {
  const session = token
    ? await prisma.syncSession.findUnique({ where: { token } })
    : shortCode
      ? await prisma.syncSession.findFirst({
          where: { storeId, shortCode: normaliseCode(shortCode) },
          orderBy: { createdAt: "desc" },
        })
      : null;

  const problem = checkJoin(session, deviceId, storeId, now);
  if (problem) throw new SyncError(problem);
  const s = session!;

  try {
    return await claimAndIssue(s, deviceId, now);
  } catch (e) {
    // Serializable conflict: another join touched the same rows at the same
    // moment (Postgres). The other one won; report it as used.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") throw new SyncError("TOKEN_USED");
    throw e;
  }
}

function claimAndIssue(s: { id: string; storeId: string; initiatorDeviceId: string }, deviceId: string, now: Date) {
  // Serializable so the daily-limit counts below can't race a concurrent
  // join by the same device on Postgres (SQLite is serializable anyway).
  return prisma.$transaction(async (tx) => {
    // Atomic claim: only one joiner can flip PENDING -> PAIRED, and only
    // while unexpired.
    const claimed = await tx.syncSession.updateMany({
      where: { id: s.id, status: "PENDING", joinerDeviceId: null, expiresAt: { gt: now } },
      data: { status: "PAIRED", joinerDeviceId: deviceId, pairedAt: now },
    });
    if (claimed.count !== 1) {
      const fresh = await tx.syncSession.findUnique({ where: { id: s.id } });
      throw new SyncError(fresh && isExpired(fresh.expiresAt, now) && fresh.status === "PENDING" ? "TOKEN_EXPIRED" : "TOKEN_USED");
    }

    await assertUnderDailyLimit(tx, s.initiatorDeviceId, now);
    await assertUnderDailyLimit(tx, deviceId, now);

    const expiresAt = new Date(now.getTime() + config.voucherTtlMs);
    const make = (forDevice: string) =>
      tx.voucher.create({
        data: {
          code: newVoucherCode(),
          deviceId: forDevice,
          storeId: s.storeId,
          syncSessionId: s.id,
          priceCents: config.dealPriceCents,
          createdAt: now,
          expiresAt,
        },
      });
    const initiatorVoucher = await make(s.initiatorDeviceId);
    const joinerVoucher = await make(deviceId);
    return { sessionId: s.id, initiatorVoucher, joinerVoucher };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Status for Phone A's waiting screen. Only the two participants may look. */
export async function getSessionStatus(sessionId: string, deviceId: string, now = new Date()) {
  const s = await prisma.syncSession.findUnique({
    where: { id: sessionId },
    include: { vouchers: { where: { deviceId }, select: { id: true } } },
  });
  if (!s || (s.initiatorDeviceId !== deviceId && s.joinerDeviceId !== deviceId)) return null;
  const status = s.status === "PAIRED" ? "PAIRED" : isExpired(s.expiresAt, now) ? "EXPIRED" : "PENDING";
  return { status, expiresAt: s.expiresAt, voucherId: s.vouchers[0]?.id ?? null };
}
