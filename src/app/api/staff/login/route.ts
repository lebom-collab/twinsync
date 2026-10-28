import { NextResponse } from "next/server";
import { handle, readJson, str } from "@/lib/api";
import { staffLogin } from "@/lib/staffAuth";

export const POST = handle(async (req: Request) => {
  const result = await staffLogin(str((await readJson(req)).pin) ?? "");
  if (result === "OK") return NextResponse.json({ ok: true });
  return NextResponse.json({ error: result }, { status: result === "LOCKED" ? 429 : 401 });
});
