/**
 * Registers baseline security middleware.
 * - Helmet for HTTP headers
 * - Rate limiting
 * - CORS (open in dev; tighten in prod)
 */
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { getConfig } from "../config/index.js";

import type { Express, RequestHandler } from "express";

export function registerSecurity(app: Express): void {
  // Cast once where libs still expose Connect-typed handlers.
  app.use(helmet() as unknown as RequestHandler);

  const cfg = getConfig();
  const allowlist = cfg.corsOriginsParsed;
  const windowMs = cfg.RATE_LIMIT_WINDOW_SEC * 1000;
  const toMax = (rpm: number) =>
    Math.max(1, Math.ceil(rpm * (cfg.RATE_LIMIT_WINDOW_SEC / 60)));

  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow same-origin / server-to-server / curl with no Origin header
        if (!origin) return cb(null, true);

        // If no allowlist provided, be permissive
        if (allowlist.length === 0) return cb(null, true);

        // Otherwise restrict to the allowlist
        if (allowlist.includes(origin)) return cb(null, true);

        // Block anything not explicitly allowed
        return cb(new Error("CORS origin not allowed"), false);
      },
      credentials: true,
    }) as RequestHandler
  );

  // Global limiter
  app.use(
    rateLimit({
      windowMs,
      max: toMax(cfg.RATE_LIMIT_RPM),
      standardHeaders: true,
      legacyHeaders: false,
    }) as RequestHandler
  );

  // Stricter limiter for auth endpoints
  app.use(
    "/auth",
    rateLimit({
      windowMs,
      max: toMax(cfg.RATE_LIMIT_RPM_AUTH),
      standardHeaders: true,
      legacyHeaders: false,
    }) as RequestHandler
  );
}
