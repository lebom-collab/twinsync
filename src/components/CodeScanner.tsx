"use client";

import { useEffect, useRef, useState } from "react";

/** Generic camera QR reader. Calls `onResult` once with the decoded text. */
export function CodeScanner({ onResult, onError }: { onResult: (text: string) => void; onError: (denied: boolean) => void }) {
  const cb = useRef({ onResult, onError });
  cb.current = { onResult, onError };
  const [id] = useState(() => `scanner-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let done = false;
    const stop = async () => {
      try {
        if (scanner?.isScanning) await scanner.stop();
        scanner?.clear();
      } catch {}
    };

    if (!window.isSecureContext) {
      cb.current.onError(false);
      return;
    }
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (done) return;
      scanner = new Html5Qrcode(id, { verbose: false });
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => ({ width: Math.min(w, h) * 0.7, height: Math.min(w, h) * 0.7 }) },
          (text) => {
            if (done) return;
            done = true;
            stop();
            cb.current.onResult(text);
          },
          () => {},
        )
        .catch((e: unknown) => cb.current.onError(/NotAllowed|Permission/i.test(String(e))));
    });

    return () => {
      done = true;
      stop();
    };
  }, [id]);

  return <div id={id} className="aspect-square w-full overflow-hidden rounded-3xl border-4 border-sun bg-coal" />;
}
