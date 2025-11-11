/**
 * Registers baseline security middleware.
 * - Helmet for HTTP headers
 * - Rate limiting
 * - CORS (open in dev; tighten in prod)
 */
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { RedisStore, type SendCommandFn } from "rate-limit-redis";
import { createClient } from "redis";

import { getConfig } from "../config/index.js";
import { AppError } from "../lib/errors.js";
import {
  markRateLimitRedisHealthy,
  markRateLimitRedisUnhealthy,
} from "../lib/rateLimitHealth.js";

import type { Express, Request, RequestHandler } from "express";

type RateLimitMiddleware = ReturnType<typeof rateLimit>;
type RedisClient = ReturnType<typeof createClient>;

export type SecurityTeardown = () => Promise<void>;

const connectRedisClient = async (url: string): Promise<RedisClient> => {
  const client = createClient({ url });

  try {
    await client.connect();
  } catch (error) {
    client.disconnect().catch(() => undefined);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to connect to rate limit store at ${url}. Reason: ${reason}`);
  }

  return client;
};

export async function registerSecurity(app: Express): Promise<SecurityTeardown> {
  // Cast once where libs still expose Connect-typed handlers.
  app.use(helmet() as unknown as RequestHandler);

  const cfg = getConfig();
  const allowlist = cfg.corsOriginsParsed;
  const isProd = cfg.NODE_ENV === "production";
  const allowUnknownOrigins = !isProd && allowlist.length === 0;
  const windowMs = cfg.RATE_LIMIT_WINDOW_SEC * 1000;
  const toMax = (rpm: number) => Math.max(1, Math.ceil(rpm * (cfg.RATE_LIMIT_WINDOW_SEC / 60)));

  app.use(
    cors((req, cb) => {
      const expressReq = req as Request & {
        log?: { warn?: (obj: unknown, msg?: string) => void };
      };
      const origin = expressReq.get?.("Origin") ?? expressReq.headers.origin;

      // Allow same-origin / server-to-server / curl with no Origin header
      if (!origin) {
        return cb(null, { origin: true, credentials: true });
      }

      // Otherwise restrict to the allowlist
      if (allowlist.includes(origin)) {
        return cb(null, { origin: true, credentials: true });
      }

      if (allowUnknownOrigins) {
        // Preserve existing DX in dev/test with no allowlist specified.
        return cb(null, { origin: true, credentials: true });
      }

      // Block anything not explicitly allowed
      expressReq.log?.warn?.({ origin }, "Blocked CORS origin");

      return cb(new AppError("Forbidden", 403, { code: "CORS_ORIGIN_FORBIDDEN" }), {
        credentials: true,
      });
    }) as RequestHandler,
  );

  let globalStore: RedisStore | undefined;
  let authStore: RedisStore | undefined;
  const redisClients: Array<{ client: RedisClient; teardown: () => void }> = [];

  if (cfg.rateLimitStore.type === "redis") {
    // In test environments we deliberately avoid connecting to Redis to keep tests hermetic and fast.
    // With store undefined, express-rate-limit falls back to in-memory store. In production, a Redis store is required.
    if (cfg.NODE_ENV !== "test") {
      const client = await connectRedisClient(cfg.rateLimitStore.url);
      const handleReady = () => {
        markRateLimitRedisHealthy();
      };
      const handleEnd = () => {
        markRateLimitRedisUnhealthy("Redis connection closed");
      };
      const handleReconnecting = () => {
        markRateLimitRedisUnhealthy("Redis reconnecting");
      };
      const handleError = (error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        markRateLimitRedisUnhealthy(reason);
      };

      const anyClient: any = client as any;
      const hasEventApi = typeof anyClient?.on === "function";
      if (hasEventApi) {
        anyClient.on("ready", handleReady);
        anyClient.on("end", handleEnd);
        anyClient.on("reconnecting", handleReconnecting);
        anyClient.on("error", handleError);
      }

      const removeListeners = () => {
        anyClient?.off?.("ready", handleReady);
        anyClient?.off?.("end", handleEnd);
        anyClient?.off?.("reconnecting", handleReconnecting);
        anyClient?.off?.("error", handleError);
        anyClient?.removeListener?.("ready", handleReady);
        anyClient?.removeListener?.("end", handleEnd);
        anyClient?.removeListener?.("reconnecting", handleReconnecting);
        anyClient?.removeListener?.("error", handleError);
      };

      redisClients.push({ client, teardown: removeListeners });

      markRateLimitRedisHealthy();
      const sendCommand: SendCommandFn = (...args) =>
        client.sendCommand(args) as ReturnType<SendCommandFn>;

      globalStore = new RedisStore({
        prefix: "rate-limit:global",
        sendCommand,
      });
      authStore = new RedisStore({
        prefix: "rate-limit:auth",
        sendCommand,
      });
    }
  } else if (isProd) {
    throw new Error("Misconfigured rate limit store: production requires Redis backing store");
  }

  const asRequestHandler = (middleware: RateLimitMiddleware): RequestHandler =>
    middleware as RequestHandler;

  // Global limiter
  app.use(
    asRequestHandler(
      rateLimit({
        windowMs,
        max: toMax(cfg.RATE_LIMIT_RPM),
        standardHeaders: true,
        legacyHeaders: false,
        store: globalStore,
      }),
    ),
  );

  // Stricter limiter for auth endpoints
  app.use(
    "/auth",
    asRequestHandler(
      rateLimit({
        windowMs,
        max: toMax(cfg.RATE_LIMIT_RPM_AUTH),
        standardHeaders: true,
        legacyHeaders: false,
        store: authStore,
      }),
    ),
  );

  const teardown: SecurityTeardown = async () => {
    await Promise.all(
      redisClients.map(async ({ client, teardown }) => {
        try {
          teardown();
        } catch {
          // Listener cleanup shouldn't block shutdown.
        }
        try {
          await client.disconnect();
        } catch {
          // Swallow disconnect errors; shutdown should continue.
        }
      }),
    );
  };

  return teardown;
}
