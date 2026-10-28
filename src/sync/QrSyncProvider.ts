import { frameFromQrPayload } from "./syncApi";
import { SyncChannelError, type AcquireOptions, type JoinCredential, type SyncProvider } from "./SyncProvider";

/** Primary channel: Phone B scans the QR on Phone A's screen. Works everywhere with a camera. */
export class QrSyncProvider implements SyncProvider {
  readonly id = "qr" as const;
  readonly label = "Scan your twin's code";

  async isAvailable() {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  }

  async acquire({ signal, elementId }: AcquireOptions): Promise<JoinCredential> {
    if (!elementId) throw new SyncChannelError("UNSUPPORTED", "QR scanning needs a preview element");
    if (!window.isSecureContext) throw new SyncChannelError("UNSUPPORTED", "Camera needs HTTPS");
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode(elementId, { verbose: false });

    const stop = async () => {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {}
    };

    return new Promise<JoinCredential>((resolve, reject) => {
      signal.addEventListener("abort", () => {
        stop();
        reject(new SyncChannelError("ABORTED"));
      });

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.75, height: Math.min(w, h) * 0.75 }) },
          (text) => {
            const qr = frameFromQrPayload(text);
            if (!qr) return; // keep scanning; probably some other QR code
            stop();
            resolve({ qr });
          },
          () => {}, // per-frame "no QR found" noise
        )
        .catch((err: unknown) => {
          const msg = String((err as Error)?.message ?? err);
          const code = /NotAllowed|Permission/i.test(msg) ? "PERMISSION_DENIED" : /NotFound|no camera|Requested device not found/i.test(msg) ? "NO_DEVICE" : "UNSUPPORTED";
          reject(new SyncChannelError(code, msg));
        });
    });
  }
}
