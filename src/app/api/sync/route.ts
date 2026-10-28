import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { makeQrFrame } from "@/lib/qrFrame";
import { resolveStore } from "@/lib/services/storeService";
import { createSession } from "@/lib/services/syncService";
import { proofFrom } from "../_proof";

/** Phone A: start a sync session. Location is (re)checked here, server-side. */
export const POST = handle(async (req: Request) => {
  const deviceId = await getOrCreateDeviceId();
  const { store, location } = await resolveStore(proofFrom(await readJson(req)));
  const now = new Date();
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
