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

export function registerSecurity(app: Express): void {
  // Cast once where libs still expose Connect-typed handlers.
  app.use(helmet() as unknown as RequestHandler);

  app.use(
    cors({
      origin: true,
      credentials: true,
    }) as unknown as RequestHandler
  );

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // 100 req per window per IP
    standardHeaders: true,
    legacyHeaders: false,
  }) as unknown as RequestHandler;

  app.use(limiter);
}
