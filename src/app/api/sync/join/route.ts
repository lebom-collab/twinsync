import { NextResponse } from "next/server";
import { handle, readJson, str } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { SyncError } from "@/lib/errors";
import { resolveStore } from "@/lib/services/storeService";
import { joinSession } from "@/lib/services/syncService";
import { proofFrom } from "../../_proof";

/** Phone B: join with the scanned token or a typed short code. */
export const POST = handle(async (req: Request) => {
  const deviceId = await getOrCreateDeviceId();
  const body = await readJson(req);
  const token = str(body.token);
  const shortCode = str(body.shortCode);
  if (!token && !shortCode) throw new SyncError("BAD_REQUEST");
  const store = await resolveStore(proofFrom(body));
  const { joinerVoucher } = await joinSession({ deviceId, storeId: store.id, token, shortCode });
  return NextResponse.json({ voucherId: joinerVoucher.id });
});
