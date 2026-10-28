import { cookies } from "next/headers";
import { config } from "./config";
import { safeEqual, sign, unsign } from "./signing";

// Prototype-grade staff auth: one shared PIN -> signed cookie for 12h.
// Production would use per-staff accounts tied to a store.

const COOKIE = "ts_staff";
const TTL_MS = 12 * 60 * 60 * 1000;

// Naive in-memory brute-force brake (per server process).
let failures = 0;
let lockedUntil = 0;

export async function staffLogin(pin: string): Promise<"OK" | "BAD_PIN" | "LOCKED"> {
  if (Date.now() < lockedUntil) return "LOCKED";
  if (!safeEqual(pin, config.staffPin)) {
    if (++failures >= 5) {
      lockedUntil = Date.now() + 60_000;
      failures = 0;
    }
    return "BAD_PIN";
  }
  failures = 0;
  const jar = await cookies();
  jar.set(COOKIE, sign(`staff:${Date.now() + TTL_MS}`), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
  return "OK";
}

export async function isStaff(): Promise<boolean> {
  const value = unsign((await cookies()).get(COOKIE)?.value);
  if (!value?.startsWith("staff:")) return false;
  return Number(value.slice(6)) > Date.now();
}

export async function staffLogout() {
  (await cookies()).delete(COOKIE);
}
