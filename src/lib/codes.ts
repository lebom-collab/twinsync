import { randomBytes, randomInt } from "node:crypto";

// No 0/O, 1/I/L — easy to read aloud and type at a till.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Unguessable token carried in the sync QR code. */
export const newSyncToken = () => randomBytes(24).toString("base64url");

/** 6-char code for NFC pairing and the typed fallback when camera is denied. */
export const newShortCode = () => randomCode(6);

/** 8-char voucher code shown to the cashier. */
export const newVoucherCode = () => randomCode(8);

export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
