// The sync abstraction. A SyncProvider is a *channel* for getting Phone A's
// pairing credential onto Phone B: QR camera scan, NFC counter tag, and later
// (in a native app) NFC HCE or BLE. Whatever the channel, it ends in the same
// server call (POST /api/sync/join), which does all validation.

export type SyncMethod = "qr" | "nfc-tag" | "native-nfc" | "ble";

/** Where the phone says it is. The server re-validates every field. */
export interface PresenceProof {
  location?: { lat: number; lng: number };
  devStoreId?: string;
  nfc?: { storeId: string; tagSecret: string };
}

/** What a channel hands over so Phone B can join Phone A's session. */
export interface JoinCredential {
  token?: string; // full token (QR, or a future native peer-to-peer exchange)
  shortCode?: string; // 6-char code typed by the user
  nfc?: { storeId: string; tagSecret: string }; // store proof from a counter tag
}

export interface AcquireOptions {
  signal: AbortSignal;
  /** DOM element id to render a camera preview into (QR). */
  elementId?: string;
}

export interface SyncProvider {
  readonly id: SyncMethod;
  readonly label: string;
  /** Feature-detect; hide the option when false. */
  isAvailable(): Promise<boolean>;
  /**
   * Phone B: read a credential from this channel. Resolves once something
   * usable is read; rejects with a SyncChannelError on permission problems.
   */
  acquire(opts: AcquireOptions): Promise<JoinCredential>;
}

export type ChannelErrorCode = "PERMISSION_DENIED" | "NO_DEVICE" | "UNSUPPORTED" | "BAD_PAYLOAD" | "ABORTED";

export class SyncChannelError extends Error {
  constructor(public code: ChannelErrorCode, message?: string) {
    super(message ?? code);
  }
}
