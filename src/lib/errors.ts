// Error codes shared by API and UI. Safe to import on the client.

export type SyncErrorCode =
  | "NOT_IN_STORE"
  | "LOCATION_REQUIRED"
  | "TOKEN_NOT_FOUND"
  | "TOKEN_EXPIRED"
  | "TOKEN_USED"
  | "SAME_DEVICE"
  | "STORE_MISMATCH"
  | "TOO_FAR"
  | "QR_STALE"
  | "SCAN_REQUIRED"
  | "DAILY_LIMIT"
  | "BAD_NFC_TAG"
  | "BAD_REQUEST";

export const SYNC_ERROR_MESSAGES: Record<SyncErrorCode, { title: string; body: string }> = {
  NOT_IN_STORE: { title: "You're not in a store yet", body: "Twin Sync only works inside a participating store. Head in and try again!" },
  LOCATION_REQUIRED: { title: "We need your location", body: "Allow location access so we can check you're in the store." },
  TOKEN_NOT_FOUND: { title: "Code not recognised", body: "That doesn't look like a Twin Sync code. Ask your twin to show theirs again." },
  TOKEN_EXPIRED: { title: "Too slow, twin!", body: "That code expired. Codes only last 60 seconds — ask your twin to make a fresh one." },
  TOKEN_USED: { title: "Already synced", body: "Someone already used that code. Each code pairs exactly two phones." },
  SAME_DEVICE: { title: "That's your own code", body: "You can't sync with yourself — find a twin with another phone!" },
  STORE_MISMATCH: { title: "Different stores", body: "You and your twin need to be in the same store." },
  QR_STALE: { title: "Scan it live", body: "Your twin's code refreshes every few seconds. Scan it straight off their screen, standing next to them." },
  SCAN_REQUIRED: { title: "Scan your twin's screen", body: "Twin Sync works phone to phone. Hold your camera up to your twin's code." },
  TOO_FAR: { title: "Get closer to your twin", body: "You need to be standing together to sync. Move next to your twin and try again." },
  DAILY_LIMIT: { title: "Come back tomorrow", body: "You've already unlocked today's Twin Sync deal on this phone." },
  BAD_NFC_TAG: { title: "Unknown NFC tag", body: "That tag isn't a Twin Sync counter tag. Try scanning your twin's QR instead." },
  BAD_REQUEST: { title: "Something went wrong", body: "Please try again." },
};

export type RedeemStatus =
  | "VALID"
  | "EXPIRED"
  | "WRONG_STORE"
  | "ALREADY_REDEEMED"
  | "NOT_FOUND";

export class SyncError extends Error {
  constructor(public code: SyncErrorCode) {
    super(code);
  }
}
