import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

// Signed cookie values: "<value>.<hmac>". Stops clients minting arbitrary
// device IDs or staff sessions by editing cookies.

function hmac(value: string): string {
  return createHmac("sha256", config.cookieSecret).update(value).digest("base64url");
}

export function sign(value: string): string {
  return `${value}.${hmac(value)}`;
}

export function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  const given = Buffer.from(signed.slice(i + 1));
  const expected = Buffer.from(hmac(value));
  return given.length === expected.length && timingSafeEqual(given, expected) ? value : null;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
