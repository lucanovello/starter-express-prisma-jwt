/**
 * JWT helpers for access and refresh tokens.
 * Reads secrets/expiries from the central config module to ensure
 * consistent, validated configuration across the application.
 */
import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";

import { getConfig } from "../config/index.js";
import { AppError } from "../lib/errors.js";

const cfg = getConfig();

const ACCESS_SECRET: Secret = cfg.JWT_ACCESS_SECRET;
const REFRESH_SECRET: Secret = cfg.JWT_REFRESH_SECRET;

const accessOptions: SignOptions = {
  // jsonwebtoken@9 expects the typed union for expiresIn
  expiresIn: cfg.JWT_ACCESS_EXPIRY as unknown as SignOptions["expiresIn"],
};
const refreshOptionsBase: SignOptions = {
  expiresIn: cfg.JWT_REFRESH_EXPIRY as unknown as SignOptions["expiresIn"],
};

export function signAccess(payload: object) {
  return jwt.sign(payload, ACCESS_SECRET, accessOptions);
}

export function signRefresh(payload: object) {
  // Guarantee a different token string on each issuance
  const refreshOptions: SignOptions = {
    ...refreshOptionsBase,
    jwtid: randomUUID(),
  };
  return jwt.sign(payload, REFRESH_SECRET, refreshOptions);
}

export function verifyAccess<T extends object = JwtPayload>(token: string): T {
  try {
    return jwt.verify(token, ACCESS_SECRET) as T;
  } catch {
    throw new AppError("Invalid access token", 401, {
      code: "JWT_ACCESS_INVALID",
    });
  }
}

export function verifyRefresh<T extends object = JwtPayload>(token: string): T {
  try {
    return jwt.verify(token, REFRESH_SECRET) as T;
  } catch (err) {
    if (
      err instanceof Error &&
      // jsonwebtoken is CommonJS; when imported in ESM the error class is exposed on the default export
      // so we detect the token expiry by name to avoid import interop issues.
      (err as any)?.name === "TokenExpiredError"
    ) {
      throw new AppError("Refresh token expired", 401, {
        code: "SESSION_EXPIRED",
      });
    }
    throw new AppError("Invalid refresh token", 401, {
      code: "JWT_REFRESH_INVALID",
    });
  }
}

export function decodeRefresh<T extends object = JwtPayload>(token: string): T | null {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") {
    return null;
  }
  return decoded as T;
}

export function getTokenExpiration(token: string): Date {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string") {
    throw new Error("Unable to decode JWT payload");
  }

  const payload = decoded as JwtPayload;
  if (typeof payload.exp !== "number") {
    throw new Error("JWT payload missing exp claim");
  }

  return new Date(payload.exp * 1000);
}
