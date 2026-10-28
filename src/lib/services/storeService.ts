import { config } from "../config";
import { prisma } from "../db";
import { SyncError } from "../errors";
import { findStoreForLocation, isValidLatLng } from "../geo";
import { safeEqual } from "../signing";

export interface PresenceProof {
  location?: unknown; // { lat, lng } from the browser
  devStoreId?: string; // honoured only when DEV_MODE=true on the server
  nfc?: { storeId: string; tagSecret: string }; // read from the counter tag
}

/**
 * Work out which store the caller is physically in.
 *
 * Every signal here comes from the client and can be faked: GPS can be
 * spoofed, and an NFC tag's contents can be copied. These checks stop casual
 * misuse only. The real safeguard is the staff check at redemption: the
 * voucher is tied to one store, is single-use and expires on the server.
 */
export async function resolveStore(proof: PresenceProof) {
  if (config.devMode && proof.devStoreId) {
    const store = await prisma.store.findUnique({ where: { id: proof.devStoreId } });
    if (store) return store;
  }

  if (proof.nfc) {
    const store = await prisma.store.findUnique({ where: { id: proof.nfc.storeId } });
    if (!store?.nfcTagSecret || !safeEqual(store.nfcTagSecret, proof.nfc.tagSecret)) {
      throw new SyncError("BAD_NFC_TAG");
    }
    return store;
  }

  if (!isValidLatLng(proof.location)) throw new SyncError("LOCATION_REQUIRED");
  const stores = await prisma.store.findMany();
  const hit = findStoreForLocation(proof.location, stores);
  if (!hit) throw new SyncError("NOT_IN_STORE");
  return hit.store;
}

export function listStores() {
  return prisma.store.findMany({
    select: { id: true, name: true, lat: true, lng: true, radiusMeters: true },
    orderBy: { name: "asc" },
  });
}
