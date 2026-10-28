// Server-side config, read from env. Never import this into client components
// except via values the server passes down.

function num(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  get dealTitle() {
    return process.env.DEAL_TITLE ?? "Two Is Better";
  },
  get dealItems() {
    return process.env.DEAL_ITEMS ?? "2 Big Johns";
  },
  /** e.g. "Two Is Better – 2 Big Johns" */
  get dealName() {
    return `${this.dealTitle} – ${this.dealItems}`;
  },
  get dealPriceCents() {
    return num("DEAL_PRICE_CENTS", 5990);
  },
  get syncTokenTtlMs() {
    return num("SYNC_TOKEN_TTL_SECONDS", 60) * 1000;
  },
  get voucherTtlMs() {
    return num("VOUCHER_TTL_SECONDS", 600) * 1000;
  },
  get maxDealsPerDevicePerDay() {
    return num("MAX_DEALS_PER_DEVICE_PER_DAY", 1);
  },
  get dayTimezone() {
    return process.env.DAY_TIMEZONE ?? "Africa/Johannesburg";
  },
  get staffPin() {
    return process.env.STAFF_PIN ?? "1234";
  },
  get cookieSecret() {
    return process.env.COOKIE_SECRET ?? "dev-only-insecure-secret";
  },
  /**
   * "twins": phones must be within twinMaxDistanceMeters of each other,
   * anywhere; the voucher goes to the nearest store.
   * "store": both phones must be inside the same store's radius.
   */
  get proximityMode(): "twins" | "store" {
    return process.env.PROXIMITY_MODE === "store" ? "store" : "twins";
  },
  get twinMaxDistanceMeters() {
    return num("TWIN_MAX_DISTANCE_METERS", 50);
  },
  /** Phone A's QR changes this often, so screenshots/forwarded links go stale. */
  get qrRotateMs() {
    return num("QR_ROTATE_SECONDS", 5) * 1000;
  },
  /** Oldest QR frame still accepted (covers scan + GPS lookup time). */
  get qrMaxAgeMs() {
    return num("QR_MAX_AGE_SECONDS", 30) * 1000;
  },
  /**
   * Typing the 6-char code works at any distance (it can be read out over a
   * call), so in "twins" mode it's only allowed in dev mode.
   */
  get allowTypedCode() {
    return this.proximityMode === "store" || this.devMode;
  },
  get devMode() {
    return process.env.DEV_MODE === "true";
  },
};

export function formatPrice(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}
