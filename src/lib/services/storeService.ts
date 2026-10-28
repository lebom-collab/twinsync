import { config } from "../config";
import { prisma } from "../db";
import { SyncError } from "../errors";
import { findNearestStore, findStoreForLocation, isValidLatLng, type LatLng } from "../geo";
import { safeEqual } from "../signing";

export interface PresenceProof {
  location?: unknown; // { lat, lng } from the browser
  devStoreId?: string; // honoured only when DEV_MODE=true on the server
  nfc?: { storeId: string; tagSecret: string }; // read from the counter tag
}

export interface ResolvedPresence {
  store: { id: string; name: string };
  /** The phone's GPS fix, when it sent one (used for the twins distance check). */
  location: LatLng | null;
  /** True when dev mode or an NFC tag stood in for GPS. */
  locationWaived: boolean;
}

/**
 * Work out which store the caller belongs to, and where they are.
 *
 * - "store" mode: GPS must fall inside a store's radius.
 * - "twins" mode: any GPS fix works; the nearest store is used for the
 *   voucher. Whether the twins are close is checked at join time.
 *
 * Every signal here comes from the client and can be faked: GPS can be
 * spoofed, and an NFC tag's contents can be copied. These checks stop casual
 * misuse only. The real safeguard is the staff check at redemption: the
 * voucher is tied to one store, is single-use and expires on the server.
 */
export async function resolveStore(proof: PresenceProof): Promise<ResolvedPresence> {
  const location = isValidLatLng(proof.location) ? { lat: proof.location.lat, lng: proof.location.lng } : null;

  if (config.devMode && proof.devStoreId) {
    const store = await prisma.store.findUnique({ where: { id: proof.devStoreId } });
    if (store) return { store, location, locationWaived: true };
  }

  if (proof.nfc) {
    const store = await prisma.store.findUnique({ where: { id: proof.nfc.storeId } });
    if (!store?.nfcTagSecret || !safeEqual(store.nfcTagSecret, proof.nfc.tagSecret)) {
      throw new SyncError("BAD_NFC_TAG");
    }
    return { store, location, locationWaived: true };
  }

  if (!location) throw new SyncError("LOCATION_REQUIRED");
  const stores = await prisma.store.findMany();
  const hit = config.proximityMode === "twins" ? findNearestStore(location, stores) : findStoreForLocation(location, stores);
  if (!hit) throw new SyncError("NOT_IN_STORE");
  return { store: hit.store, location, locationWaived: false };
}

export function listStores() {
  return prisma.store.findMany({
    select: { id: true, name: true, lat: true, lng: true, radiusMeters: true },
    orderBy: { name: "asc" },
  });
}
