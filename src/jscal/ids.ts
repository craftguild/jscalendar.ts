import type { Id } from "../types.js";
import { TYPEOF_FUNCTION } from "./constants.js";

/**
 * Get a Crypto instance if available.
 * @return Crypto instance when available, otherwise undefined.
 */
function getCrypto(): Crypto | undefined {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === TYPEOF_FUNCTION) {
    return cryptoObj;
  }
  return undefined;
}

/**
 * Generate random bytes using Crypto or Math.random.
 * @param length Number of bytes to generate.
 * @return Random byte array.
 */
function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj = getCrypto();
  if (cryptoObj) {
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * Encode bytes as base64url.
 * @param bytes Byte array to encode.
 * @return Base64url string without padding.
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;

    const triplet = ((b0 ?? 0) << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);

    output += alphabet[(triplet >> 18) & 0x3f] ?? "";
    output += alphabet[(triplet >> 12) & 0x3f] ?? "";
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 0x3f] ?? "" : "=";
    output += i + 2 < bytes.length ? alphabet[triplet & 0x3f] ?? "" : "=";
  }
  return output.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Create a UUID-like identifier.
 * @return UUID string.
 */
export function createUid(): string {
  const cryptoObj = getCrypto();
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  const bytes = getRandomBytes(16);
  if (bytes.length > 6) {
    const b6 = bytes[6] ?? 0;
    bytes[6] = (b6 & 0x0f) | 0x40;
  }
  if (bytes.length > 8) {
    const b8 = bytes[8] ?? 0;
    bytes[8] = (b8 & 0x3f) | 0x80;
  }
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Create a compact base64url identifier.
 * @return Base64url ID string.
 */
export function createId(): Id {
  return base64UrlEncode(getRandomBytes(16));
}
