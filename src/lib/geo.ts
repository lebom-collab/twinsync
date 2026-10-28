export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoStore extends LatLng {
  id: string;
  radiusMeters: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Nearest store whose radius contains the point, or null.
 *
 * NOTE: browser GPS is trivially spoofable (dev tools, mock-location apps).
 * This check only filters casual misuse; the staff redemption check at the
 * counter (voucher tied to one store, single use, server-side expiry) is the
 * real safeguard.
 */
export function findStoreForLocation<T extends GeoStore>(
  point: LatLng,
  stores: T[],
): { store: T; distanceMeters: number } | null {
  let best: { store: T; distanceMeters: number } | null = null;
  for (const store of stores) {
    const d = haversineMeters(point, store);
    if (d <= store.radiusMeters && (!best || d < best.distanceMeters)) {
      best = { store, distanceMeters: d };
    }
  }
  return best;
}

/** Nearest store regardless of radius ("twins" mode), or null if none. */
export function findNearestStore<T extends GeoStore>(point: LatLng, stores: T[]): { store: T; distanceMeters: number } | null {
  let best: { store: T; distanceMeters: number } | null = null;
  for (const store of stores) {
    const d = haversineMeters(point, store);
    if (!best || d < best.distanceMeters) best = { store, distanceMeters: d };
  }
  return best;
}

export function isValidLatLng(p: unknown): p is LatLng {
  if (!p || typeof p !== "object") return false;
  const { lat, lng } = p as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
