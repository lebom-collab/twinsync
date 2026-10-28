import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { makeQrFrame } from "@/lib/qrFrame";
import { SyncError } from "@/lib/errors";
import { countNearby } from "@/lib/services/presenceService";
import { resolveStore } from "@/lib/services/storeService";
import { createSession } from "@/lib/services/syncService";
import { proofFrom } from "../_proof";

/** Phone A: start a sync session. Location is (re)checked here, server-side. */
export const POST = handle(async (req: Request) => {
  const deviceId = await getOrCreateDeviceId();
  const presence = await resolveStore(proofFrom(await readJson(req)));
  const { store, location } = presence;
  const now = new Date();
  // Mirrors the greyed-out button: no code unless another phone is open nearby.
  if ((await countNearby(deviceId, presence, now)) === 0) throw new SyncError("NO_TWIN_NEARBY");
  const s = await createSession(deviceId, store.id, now, location);
  return NextResponse.json({
    sessionId: s.id,
    // The session token never leaves the server; Phone A shows rotating frames.
    qr: makeQrFrame(s.id, s.token, now),
    shortCode: s.shortCode,
    storeName: store.name,
    expiresAt: s.expiresAt.toISOString(),
    serverNow: now.toISOString(),
  });
});
