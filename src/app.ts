/**
 * App composition (no .listen() here).
 * WHY: Tests import the app directly (Supertest) without opening a TCP port.
 */
import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import * as ipaddr from "ipaddr.js";
import crypto from "node:crypto";
import pino, { type LoggerOptions } from "pino";
import pinoHttp, { type Options } from "pino-http";
import swaggerUi from "swagger-ui-express";

import { BUILD_VERSION, BUILD_GIT_SHA, BUILD_TIME } from "./build/meta.js";
import { getConfig, type AppConfig, type MetricsGuardConfig } from "./config/index.js";
import openapi from "./docs/openapi.js";
import { prisma } from "./lib/prisma.js";
import { isShuttingDown } from "./lifecycle/state.js";
import { metricsMiddleware, metricsHandler } from "./metrics/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { attachUserToLog } from "./middleware/logUser.js";
import { notFound } from "./middleware/notFound.js";
import { registerSecurity } from "./middleware/security.js";
import { auth as authRoutes } from "./routes/auth.js";
import { protectedRoutes } from "./routes/protected.js";

import type { IncomingMessage, ServerResponse } from "node:http";

const app = express();

type NodeEnv = AppConfig["NODE_ENV"];

const METRICS_SECRET_HEADER = "x-metrics-secret";

const createMetricsGuard = (env: NodeEnv, guard: MetricsGuardConfig): RequestHandler[] => {
  const respondForbidden = (res: Response) =>
    res.status(403).json({
      error: {
        message: "Metrics access forbidden",
        code: "METRICS_GUARD_FORBIDDEN",
      },
    });

  if (guard.type === "none") {
    if (env === "production") {
      const blockUnguarded: RequestHandler = (_req, res) => {
        respondForbidden(res);
      };
      return [blockUnguarded];
    }
    return [];
  }

  if (guard.type === "secret") {
    const expected = guard.secret;
    const requireSecret: RequestHandler = (req, res, next) => {
      const provided = req.get(METRICS_SECRET_HEADER);
      if (provided !== expected) {
        return res.status(401).json({
          error: {
            message: "Missing or invalid metrics secret",
            code: provided ? "METRICS_GUARD_INVALID" : "METRICS_GUARD_MISSING",
          },
        });
      }
      return next();
    };
    return [requireSecret];
  }

  if (guard.type === "cidr") {
    const requireAllowlist: RequestHandler = (req, res, next) => {
      const ip = normalizeClientIp(req);
      if (!ip || !isIpAllowed(ip, guard.allowlist)) {
        respondForbidden(res);
        return;
      }
      return next();
    };
    return [requireAllowlist];
  }

  return [];
};

const normalizeClientIp = (req: Request): string | null => {
  const raw = req.ip ?? req.socket?.remoteAddress ?? null;
  if (!raw) return null;
  try {
    const addr = ipaddr.parse(raw);
    if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
      return (addr as ipaddr.IPv6).toIPv4Address().toString();
    }
    return addr.toString();
  } catch {
    return null;
  }
};

const isIpAllowed = (ip: string, allowlist: string[]): boolean => {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(ip);
  } catch {
    return false;
  }

  return allowlist.some((cidr) => {
    try {
      let [range, prefix] = ipaddr.parseCIDR(cidr);
      if (range.kind() === "ipv6" && (range as ipaddr.IPv6).isIPv4MappedAddress()) {
        range = (range as ipaddr.IPv6).toIPv4Address();
      }

      let candidate: ipaddr.IPv4 | ipaddr.IPv6 = parsed;
      if (candidate.kind() === "ipv6" && (candidate as ipaddr.IPv6).isIPv4MappedAddress()) {
        candidate = (candidate as ipaddr.IPv6).toIPv4Address();
      }

      if (range.kind() !== candidate.kind()) {
        return false;
      }

      return candidate.match([range, prefix]);
    } catch {
      return false;
    }
  });
};

// Structured logging with request correlation.
const cfg = getConfig();
const redactionPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-metrics-secret"]',
  "req.headers['set-cookie']",
  "res.headers['set-cookie']",
  "req.body.password",
  "req.body.passwordConfirmation",
  "req.body.currentPassword",
  "req.body.newPassword",
  "req.body.refreshToken",
  "req.body.refresh_token",
  "req.body.smtpPass",
  "req.body.smtpPassword",
  "req.body.clientSecret",
  "req.body.client_secret",
] as const;

export const LOG_REDACTION_PATHS = redactionPaths;

const baseLoggerOptions: LoggerOptions = {
  level: cfg.LOG_LEVEL,
  redact: {
    paths: [...redactionPaths],
    censor: "[REDACTED]",
  },
};

const logger = pino(
  cfg.NODE_ENV === "production"
    ? baseLoggerOptions
    : { ...baseLoggerOptions, transport: { target: "pino-pretty" } },
);

const pinoOptions: Options<IncomingMessage, ServerResponse<IncomingMessage>> = {
  logger,
  genReqId: (req) => (req.headers["x-request-id"] as string) || crypto.randomUUID(),
  customProps: (_req, res) => {
    // Express adds res.locals; not present on ServerResponse types.
    const anyRes = res as unknown as { locals?: Record<string, unknown> };
    return { userId: anyRes.locals?.userId };
  },
  redact: {
    paths: [...redactionPaths],
    censor: "[REDACTED]",
  },
};

// Some installs surface pinoHttp’s type as a module object.
// Cast once to a callable Express RequestHandler factory.
const pinoHttpFn = pinoHttp as unknown as (opts: typeof pinoOptions) => RequestHandler;

app.use(pinoHttpFn(pinoOptions));

// Echo the id to clients so they can reference it in bug reports, etc.
const echoRequestId: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  // pino-http attaches `req.id` as string | number
  const id = (req as unknown as { id?: string | number }).id;
  if (id != null) res.setHeader("x-request-id", String(id));
  next();
};
app.use(echoRequestId);

// express.json() needs a cast for Express 5 + connect-style types.
const jsonParser = express.json({ limit: cfg.REQUEST_BODY_LIMIT }) as unknown as RequestHandler;
app.use(jsonParser);

// Security baseline (helmet, CORS, rate limit, etc.)
await registerSecurity(app);

// Metrics: request logging + /metrics endpoint
app.use(metricsMiddleware);
if (cfg.NODE_ENV !== "production" || cfg.metricsEnabled) {
  const guardChain = createMetricsGuard(cfg.NODE_ENV, cfg.metricsGuard);
  app.get("/metrics", ...guardChain, metricsHandler as RequestHandler);
}

// Attach userId to logs when a valid token is present
app.use(attachUserToLog as RequestHandler);

// Liveness: process is up and serving HTTP
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Readiness: dependencies (DB) respond
app.get("/ready", async (_req, res) => {
  // When draining, advertise "not ready" so load balancers stop sending traffic.
  if (isShuttingDown()) {
    return res.status(503).json({ error: { message: "Shutting down", code: "SHUTTING_DOWN" } });
  }

  try {
    // Keep your existing DB health check here
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ready" });
  } catch {
    return res.status(503).json({ error: { message: "Not Ready", code: "NOT_READY" } });
  }
});

// Build metadata
app.get("/version", (_req: Request, res: Response) => {
  res.json({
    version: BUILD_VERSION,
    gitSha: BUILD_GIT_SHA,
    buildTime: BUILD_TIME,
  });
});

// Feature routes
app.use("/auth", authRoutes);
app.use("/protected", protectedRoutes);

// API docs
// Serve OpenAPI spec as JSON
app.get("/openapi.json", (_req, res) => res.json(openapi));

// Serve Swagger UI only in non-production environments
if (process.env.NODE_ENV !== "production") {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
}

// 404 + error pipeline
app.use(notFound);
app.use(errorHandler);

export default app;
