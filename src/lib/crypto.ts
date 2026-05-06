/**
 * Crypto primitives — sha256 for stored hashes, HMAC-SHA256 for webhook
 * signatures. Lifted from Overwatch's overwatch/crypto.py shape.
 *
 * We hash both API keys and webhook secrets at rest. The plaintext is
 * returned to the curator exactly once at creation time.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Cryptographically random key with prefix.  Length ≈ 48 chars after base64url. */
export function generateKey(prefix: string = "ark"): string {
  // 32 random bytes → 43-char base64url
  const buf = randomBytes(32).toString("base64url");
  return `${prefix}_${buf}`;
}

/** Constant-time string comparison so timing attacks don't leak hash content. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
