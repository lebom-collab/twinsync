import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Home-screen icon: the round brand logo centred on black. The source PNG is
// only 225px, so the 512 icon is upscaled; swap in a larger/SVG logo for
// production.
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const size = (await ctx.params).size === "192" ? 192 : 512;
  const logo = await readFile(path.join(process.cwd(), "public/brand/logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  // Keep the logo inside the maskable-icon safe zone (centre 80%).
  const d = Math.round(size * 0.78);
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={d} height={d} style={{ borderRadius: d }} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
