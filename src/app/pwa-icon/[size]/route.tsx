import { ImageResponse } from "next/og";

// Placeholder app icon (no brand artwork): two overlapping discs + "TS".
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = (await ctx.params).size === "192" ? 192 : 512;
  const d = size * 0.46;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", width: d, height: d, borderRadius: d, background: "#ffc72c", left: size * 0.17, top: size * 0.27 }} />
        <div style={{ position: "absolute", width: d, height: d, borderRadius: d, background: "#e31837", right: size * 0.17, top: size * 0.27 }} />
        <div style={{ position: "relative", color: "#fff8e6", fontSize: size * 0.28, fontWeight: 900, letterSpacing: -size * 0.01 }}>TS</div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
