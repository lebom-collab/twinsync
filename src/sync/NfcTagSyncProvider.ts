import { SyncChannelError, type AcquireOptions, type JoinCredential, type SyncProvider } from "./SyncProvider";

// Minimal Web NFC typings (Chrome on Android only; not in lib.dom yet).
interface NDEFRecord {
  recordType: string;
  data?: DataView;
  encoding?: string;
}
interface NDEFReadingEvent extends Event {
  message: { records: NDEFRecord[] };
}
interface NDEFReaderLike extends EventTarget {
  scan(opts?: { signal?: AbortSignal }): Promise<void>;
  write(message: { records: { recordType: string; data: string }[] }, opts?: { signal?: AbortSignal }): Promise<void>;
}
declare global {
  interface Window {
    NDEFReader?: { new (): NDEFReaderLike };
  }
}

/** URL written to counter tags. Opening it also works on phones without Web NFC. */
export function counterTagUrl(origin: string, storeId: string, tagSecret: string): string {
  return `${origin}/sync?store=${encodeURIComponent(storeId)}&k=${encodeURIComponent(tagSecret)}`;
}

export function parseCounterTag(text: string): JoinCredential["nfc"] | null {
  try {
    const url = new URL(text);
    const storeId = url.searchParams.get("store");
    const tagSecret = url.searchParams.get("k");
    return storeId && tagSecret ? { storeId, tagSecret } : null;
  } catch {
    return null;
  }
}

/**
 * Optional channel: tap the store's NFC counter sticker (proves the store),
 * then type your twin's 6-char code. Web NFC reads/writes *tags* only; it
 * can't do phone-to-phone, which is why the short code is still needed.
 */
export class NfcTagSyncProvider implements SyncProvider {
  readonly id = "nfc-tag" as const;
  readonly label = "Tap the counter NFC tag";

  async isAvailable() {
    return typeof window !== "undefined" && "NDEFReader" in window;
  }

  async acquire({ signal }: AcquireOptions): Promise<JoinCredential> {
    if (!window.NDEFReader) throw new SyncChannelError("UNSUPPORTED");
    const reader = new window.NDEFReader();
    try {
      await reader.scan({ signal });
    } catch (err) {
      const name = (err as DOMException)?.name;
      throw new SyncChannelError(name === "NotAllowedError" ? "PERMISSION_DENIED" : name === "AbortError" ? "ABORTED" : "UNSUPPORTED");
    }

    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new SyncChannelError("ABORTED")));
      reader.addEventListener("reading", (event) => {
        const decoder = new TextDecoder();
        for (const record of (event as NDEFReadingEvent).message.records) {
          if ((record.recordType === "url" || record.recordType === "text") && record.data) {
            const nfc = parseCounterTag(decoder.decode(record.data));
            if (nfc) return resolve({ nfc });
          }
        }
        reject(new SyncChannelError("BAD_PAYLOAD"));
      });
    });
  }
}

/** Staff helper: program a blank sticker for a store. */
export async function writeCounterTag(url: string, signal: AbortSignal) {
  if (!window.NDEFReader) throw new SyncChannelError("UNSUPPORTED");
  await new window.NDEFReader().write({ records: [{ recordType: "url", data: url }] }, { signal });
}
