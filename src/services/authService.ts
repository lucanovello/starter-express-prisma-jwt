// src/services/authService.ts
/**
 * Auth service scaffolding.
 * Implements contracts; real logic lands in the next PR.
 */
import { AppError } from "../lib/errors.js";

export type LoginDTO = { email: string; password: string };
export type Tokens = { accessToken: string; refreshToken: string };

/**
 * Log in a user: verify password, create session, return tokens.
 * @throws AppError(501) until implemented
 */
export async function login(_dto: LoginDTO): Promise<Tokens> {
  throw new AppError("Not implemented", 501, { code: "NOT_IMPLEMENTED" });
}

/**
 * Rotate refresh tokens with reuse detection.
 * @throws AppError(501) until implemented
 */
export async function refresh(_oldRefresh: string): Promise<Tokens> {
  throw new AppError("Not implemented", 501, { code: "NOT_IMPLEMENTED" });
}

/**
 * Invalidate the session mapped to the given refresh token.
 * Idempotent by design.
 * @throws AppError(501) until implemented
 */
export async function logout(_refresh: string): Promise<void> {
  throw new AppError("Not implemented", 501, { code: "NOT_IMPLEMENTED" });
}
