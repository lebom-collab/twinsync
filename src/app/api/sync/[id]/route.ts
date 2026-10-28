import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/device";
import { getSessionStatus } from "@/lib/services/syncService";

export const dynamic = "force-dynamic";

/** Polling fallback for Phone A when SSE isn't available. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const status = await getSessionStatus(id, await getOrCreateDeviceId());
  if (!status) return NextResponse.json({ error: "TOKEN_NOT_FOUND" }, { status: 404 });
  return NextResponse.json(status);
});
