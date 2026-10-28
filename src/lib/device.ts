import { cookies } from "next/headers";
import { prisma } from "./db";
import { sign, unsign } from "./signing";

const COOKIE = "ts_device";

/**
 * The anonymous device ID for this browser, creating one if needed.
 * Call from route handlers only (it may set a cookie).
 *
 * Clearing cookies or using a private window yields a new "device"; the
 * daily limit is therefore a speed bump, not a hard guarantee. A native app
 * could use platform attestation (Play Integrity / App Attest) instead.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const jar = await cookies();
  const existing = unsign(jar.get(COOKIE)?.value);
  if (existing) {
    const device = await prisma.device.findUnique({ where: { id: existing } });
    if (device) return device.id;
  }
  const device = await prisma.device.create({ data: {} });
  jar.set(COOKIE, sign(device.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return device.id;
}
