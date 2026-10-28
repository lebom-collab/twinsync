import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { heartbeat, leave } from "@/lib/services/presenceService";
import { resolveStore } from "@/lib/services/storeService";
import { proofFrom } from "../_proof";

/**
 * Heartbeat while Twin Sync is open and visible (every few seconds).
 * Returns only a count of nearby twins, never anyone's location.
 */
export const POST = handle(async (req: Request) => {
  const deviceId = await getOrCreateDeviceId();
  const presence = await resolveStore(proofFrom(await readJson(req)));
  return NextResponse.json({ nearby: await heartbeat(deviceId, presence) });
});

/** Tab hidden / page closed: stop counting this phone straight away. */
export const DELETE = handle(async () => {
  await leave(await getOrCreateDeviceId());
  return NextResponse.json({ ok: true });
});
