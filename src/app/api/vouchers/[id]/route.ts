import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { getVoucherForDevice } from "@/lib/services/voucherService";

export const dynamic = "force-dynamic";

/** A customer's own voucher (with server time, for an accurate countdown). */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const voucher = await getVoucherForDevice(id, await getOrCreateDeviceId());
  if (!voucher) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json(voucher);
});
