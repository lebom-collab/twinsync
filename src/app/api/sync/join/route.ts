import { NextResponse } from "next/server";
import { handle, readJson, str } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { SyncError } from "@/lib/errors";
import { resolveStore } from "@/lib/services/storeService";
import { joinSession } from "@/lib/services/syncService";
import { proofFrom } from "../../_proof";

/** Phone B: join with a scanned QR frame (or a typed short code, where allowed). */
export const POST = handle(async (req: Request) => {
  const deviceId = await getOrCreateDeviceId();
  const body = await readJson(req);
  const qr = str(body.qr);
  const shortCode = str(body.shortCode);
  if (!qr && !shortCode) throw new SyncError("BAD_REQUEST");
  const { store, location, locationWaived } = await resolveStore(proofFrom(body));
  const { joinerVoucher } = await joinSession({ deviceId, storeId: store.id, location, locationWaived, qr, shortCode });
  return NextResponse.json({ voucherId: joinerVoucher.id });
});
