"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrImage({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0d0d0d", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [value, size]);

  return (
    <div className="rounded-2xl bg-white p-3" style={{ width: size + 24, height: size + 24 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} width={size} height={size} alt={label} />}
    </div>
  );
}
