import { config } from "../config";
import { prisma } from "../db";
import { isTwinNearby } from "../rules";
import type { ResolvedPresence } from "./storeService";

const PRUNE_AFTER_MS = 5 * 60_000;

function meFrom(deviceId: string, p: ResolvedPresence) {
  return { deviceId, storeId: p.store.id, location: p.location, waived: p.locationWaived };
}

/** How many *other* phones have Twin Sync open near this one right now. */
export async function countNearby(deviceId: string, p: ResolvedPresence, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - config.presenceFreshMs);
  const rows = await prisma.presence.findMany({ where: { lastSeen: { gte: since }, deviceId: { not: deviceId } } });
  const me = meFrom(deviceId, p);
  const opts = { mode: config.proximityMode, maxMeters: config.twinMaxDistanceMeters, freshMs: config.presenceFreshMs, now };
  return rows.filter((r) =>
    isTwinNearby(me, { deviceId: r.deviceId, storeId: r.storeId, waived: r.waived, lastSeen: r.lastSeen, location: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null }, opts),
  ).length;
}

/** Record "this phone is open here", then report how many twins are nearby. */
export async function heartbeat(deviceId: string, p: ResolvedPresence, now = new Date()): Promise<number> {
  const data = { lat: p.location?.lat ?? null, lng: p.location?.lng ?? null, storeId: p.store.id, waived: p.locationWaived, lastSeen: now };
  await prisma.presence.upsert({ where: { deviceId }, update: data, create: { deviceId, ...data } });
  // Don't keep anyone's location around longer than needed.
  await prisma.presence.deleteMany({ where: { lastSeen: { lt: new Date(now.getTime() - PRUNE_AFTER_MS) } } });
  return countNearby(deviceId, p, now);
}

/** Phone closed the app / left the screen. */
export async function leave(deviceId: string) {
  await prisma.presence.deleteMany({ where: { deviceId } });
}
