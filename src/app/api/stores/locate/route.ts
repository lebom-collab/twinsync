import { NextResponse } from "next/server";
import { handle, readJson } from "@/lib/api";
import { resolveStore } from "@/lib/services/storeService";
import { proofFrom } from "../../_proof";

/** Which store am I in? Used by the home screen before enabling Twin Sync. */
export const POST = handle(async (req: Request) => {
  const store = await resolveStore(proofFrom(await readJson(req)));
  return NextResponse.json({ store: { id: store.id, name: store.name } });
});
