/**
 * Registers baseline security middleware.
 * - Helmet for setting various HTTP headers.
 * - Rate limiting to prevent brute-force attacks.
 * - CORS to control cross-origin requests.
 */
import type { Express } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";

export function registerSecurity(app: Express): void {
  // Set security-related HTTP headers
  app.use(helmet());

  // Open CORS in dev; tighten origin list in production
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  // Basic rate limiting: 100 req/min/IP
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
    })
  );
}
