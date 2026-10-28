import { NfcTagSyncProvider } from "./NfcTagSyncProvider";
import { QrSyncProvider } from "./QrSyncProvider";
import type { SyncProvider } from "./SyncProvider";

export * from "./SyncProvider";
export * from "./syncApi";

/**
 * Registered channels, in display order. A native Expo app would ship its
 * own list (e.g. NativeNfcSyncProvider, BleSyncProvider) against the same
 * interface and the same server API.
 */
export const syncProviders: SyncProvider[] = [new QrSyncProvider(), new NfcTagSyncProvider()];
