/**
 * Registers baseline security middleware.
 * - Helmet for HTTP headers
 * - Rate limiting
 * - CORS (open in dev; tighten in prod)
 */
import type { Express, RequestHandler } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { getConfig } from "../config/index.js";

export function registerSecurity(app: Express): void {
  // Cast once where libs still expose Connect-typed handlers.
  app.use(helmet() as unknown as RequestHandler);

  const cfg = getConfig();
  const allowlist = cfg.corsOriginsParsed;

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

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // 100 req per window per IP
    standardHeaders: true,
    legacyHeaders: false,
  }) as unknown as RequestHandler;

  app.use(limiter);
}
