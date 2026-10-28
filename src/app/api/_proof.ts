import { str } from "@/lib/api";
import type { PresenceProof } from "@/lib/services/storeService";

/** Pull presence evidence out of a request body. */
export function proofFrom(body: Record<string, unknown>): PresenceProof {
  const nfc = body.nfc as Record<string, unknown> | undefined;
  return {
    location: body.location,
    devStoreId: str(body.devStoreId),
    nfc: nfc && str(nfc.storeId) && typeof nfc.tagSecret === "string"
      ? { storeId: str(nfc.storeId)!, tagSecret: nfc.tagSecret.slice(0, 128) }
      : undefined,
  };
}
