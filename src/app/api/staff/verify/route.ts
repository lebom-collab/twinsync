import { NextResponse } from "next/server";
import { handle, readJson, str } from "@/lib/api";
import { verifyVoucher } from "@/lib/services/voucherService";
import { denyUnlessStaff } from "../_guard";

export const POST = handle(async (req: Request) => {
  const denied = await denyUnlessStaff();
  if (denied) return denied;
  const body = await readJson(req);
  const code = str(body.code);
  const storeId = str(body.storeId);
  if (!code || !storeId) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  return NextResponse.json(await verifyVoucher(code, storeId));
});
