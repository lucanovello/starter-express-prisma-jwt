/**
 * Token hashing helpers for refresh/session tokens.
 * - Hash: SHA-256 hex (fast and deterministic)
 * - Compare: constant-time check to avoid timing side-channels
 */
import { createHash, timingSafeEqual } from "node:crypto";

/** Synchronous hash, used internally and for comparisons. */
export function hashTokenSync(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Async wrapper so call-sites can `await hashToken(...)` without changing signatures. */
export async function hashToken(token: string): Promise<string> {
  return hashTokenSync(token);
}

/** Constant-time check of a raw token against a stored hash. */
export function tokenEqualsHash(token: string, hashed: string): boolean {
  const a = Buffer.from(hashTokenSync(token), "utf8");
  const b = Buffer.from(hashed, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
