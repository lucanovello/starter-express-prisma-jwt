/**
 * Password hashing utilities.
 * Uses Argon2id, a memory-hard algorithm recommended by OWASP.
 */
import argon2 from "argon2";

/**
 * Hash a plain-text password using Argon2id.
 * @param plain - the user's plain password
 * @returns a hashed string (includes salt and algorithm parameters)
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

/**
 * Verify a plain password against a previously hashed password.
 * @param hash - the stored Argon2 hash
 * @param plain - the password provided by the user
 * @returns true if the password matches, otherwise false
 */
export async function verifyPassword(
  hash: string,
  plain: string
): Promise<boolean> {
  return argon2.verify(hash, plain);
}
