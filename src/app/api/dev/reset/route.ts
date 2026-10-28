import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * DEV_MODE only: forget this browser's device ID so you can test the flow
 * again without waiting a day for the per-device limit to reset.
 */
export async function POST() {
  if (!config.devMode) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  (await cookies()).delete("ts_device");
  return NextResponse.json({ ok: true });
}
