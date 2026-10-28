import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { resolveStore } from "@/lib/services/storeService";
import { createSession } from "@/lib/services/syncService";
import { proofFrom } from "../_proof";

/** Phone A: start a sync session. Location is (re)checked here, server-side. */
export const POST = handle(async (req: Request) => {
  const deviceId = await getOrCreateDeviceId();
  const store = await resolveStore(proofFrom(await readJson(req)));
  const now = new Date();
  const s = await createSession(deviceId, store.id, now);
  return NextResponse.json({
    sessionId: s.id,
    token: s.token,
    shortCode: s.shortCode,
    storeName: store.name,
    expiresAt: s.expiresAt.toISOString(),
    serverNow: now.toISOString(),
  });
});
