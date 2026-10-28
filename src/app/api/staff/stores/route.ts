import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { denyUnlessStaff } from "../_guard";

export const dynamic = "force-dynamic";

/** Stores for the till's store picker (+ tag secret for programming NFC tags). */
export async function GET() {
  const denied = await denyUnlessStaff();
  if (denied) return denied;
  const stores = await prisma.store.findMany({
    select: { id: true, name: true, nfcTagSecret: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ stores });
}
