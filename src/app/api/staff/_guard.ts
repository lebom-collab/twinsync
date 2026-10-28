import { NextResponse } from "next/server";
import { isStaff } from "@/lib/staffAuth";

export async function denyUnlessStaff() {
  return (await isStaff()) ? null : NextResponse.json({ error: "UNAUTHORISED" }, { status: 401 });
}
