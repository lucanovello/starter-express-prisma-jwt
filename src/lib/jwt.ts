/**
 * JWT helpers: sign/verify access & refresh tokens with env-driven secrets/expiries.
 * Key decisions: fail fast when secrets are missing; map verify errors to 401.
 */
import jwt, {
  type SignOptions,
  type JwtPayload,
  type Secret,
} from "jsonwebtoken";
import crypto from "node:crypto";
import { AppError } from "./errors.js";

/** Public payload surface kept minimal & generic. */
export type JwtClaims = Record<string, unknown>;

/** Fetch a required env var or fail fast at boot. */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new AppError(`Missing ${name}`, 500, {
      code: `ENV_${name}_MISSING`,
      // Don't expose internal config details to clients.
      expose: false,
    });
  }
  return v;
}

/**
 * Parse an expiry string/number from env into the exact type jwt.sign expects.
 * Accepts seconds as number (e.g., "900") or time strings (e.g., "15m").
 */
function parseExpiry(
  raw: string | undefined,
  fallback: SignOptions["expiresIn"]
): SignOptions["expiresIn"] {
  if (!raw || raw.trim() === "") return fallback;
  const n = Number(raw);
  // If it's a finite number, treat as seconds; otherwise accept ms-style strings.
  return Number.isFinite(n) ? n : (raw as unknown as SignOptions["expiresIn"]);
}

// Read and validate env *once* at module load.
const ACCESS_SECRET: Secret = requireEnv("JWT_ACCESS_SECRET");
const REFRESH_SECRET: Secret = requireEnv("JWT_REFRESH_SECRET");
const ACCESS_EXP: SignOptions["expiresIn"] = parseExpiry(
  process.env.JWT_ACCESS_EXPIRY,
  "15m"
);
const REFRESH_EXP: SignOptions["expiresIn"] = parseExpiry(
  process.env.JWT_REFRESH_EXPIRY,
  "7d"
);

/**
 * Signs an access token.
 * @param payload - minimal JWT payload (e.g., { sub: userId })
 * @returns JWT string
 */
export function signAccess(payload: JwtClaims): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}

/**
 * Verifies an access token.
 * @param token - bearer token string (no "Bearer " prefix)
 * @returns decoded claims object
 * @throws AppError(401) if invalid/expired
 */
export function verifyAccess<T extends object = JwtPayload>(token: string): T {
  try {
    return jwt.verify(token, ACCESS_SECRET) as T;
  } catch {
    throw new AppError("Invalid access token", 401, {
      code: "JWT_ACCESS_INVALID",
    });
  }
}

/**
 * Signs a refresh token.
 * @param payload - minimal JWT payload (e.g., { sub: userId, sid?: sessionId })
 * @returns JWT string
 */
export function signRefresh(payload: JwtClaims): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXP,
    jwtid: crypto.randomUUID(), // ensure a unique token each issuance
  });
}

/**
 * Verifies a refresh token.
 * @param token - refresh token string
 * @returns decoded claims object
 * @throws AppError(401) if invalid/expired
 */
export function verifyRefresh<T extends object = JwtPayload>(token: string): T {
  try {
    return jwt.verify(token, REFRESH_SECRET) as T;
  } catch {
    throw new AppError("Invalid refresh token", 401, {
      code: "JWT_REFRESH_INVALID",
    });
  }
}
