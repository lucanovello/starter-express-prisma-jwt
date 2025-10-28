import * as ipaddr from "ipaddr.js";
import { z } from "zod";

const splitCommaSeparated = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const validateCidr = (cidr: string): boolean => {
  try {
    ipaddr.parseCIDR(cidr);
    return true;
  } catch {
    return false;
  }
};

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT access secret must be at least 32 characters long"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT refresh secret must be at least 32 characters long"),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RATE_LIMIT_RPM: z.coerce.number().default(600),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().default(900),
  RATE_LIMIT_RPM_AUTH: z.coerce.number().default(120),
  RATE_LIMIT_REDIS_URL: z
    .string()
    .url("RATE_LIMIT_REDIS_URL must be a valid URL (e.g. redis://:pass@host:6379)")
    .optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  METRICS_ENABLED: z.string().optional(),
  METRICS_GUARD: z.enum(["none", "secret", "cidr"]).default("none"),
  METRICS_GUARD_SECRET: z.string().optional(),
  METRICS_GUARD_ALLOWLIST: z.string().optional(),
  SESSION_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  REQUEST_BODY_LIMIT: z.string().default("100kb"),
  HTTP_SERVER_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  HTTP_SERVER_HEADERS_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  HTTP_SERVER_KEEPALIVE_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
}).superRefine((data, ctx) => {
  if (data.METRICS_GUARD === "secret") {
    const secret = data.METRICS_GUARD_SECRET?.trim();
    if (!secret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["METRICS_GUARD_SECRET"],
        message: "METRICS_GUARD_SECRET is required when METRICS_GUARD=secret",
      });
    }
  } else if (data.METRICS_GUARD_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["METRICS_GUARD_SECRET"],
      message: "METRICS_GUARD_SECRET provided but METRICS_GUARD is not set to secret",
    });
  }

  if (data.METRICS_GUARD === "cidr") {
    const allowlist = splitCommaSeparated(data.METRICS_GUARD_ALLOWLIST);
    if (allowlist.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["METRICS_GUARD_ALLOWLIST"],
        message: "Provide at least one CIDR when METRICS_GUARD=cidr",
      });
      return;
    }

    const invalid = allowlist.filter((cidr) => !validateCidr(cidr));
    if (invalid.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["METRICS_GUARD_ALLOWLIST"],
        message: `Invalid CIDR entries: ${invalid.join(", ")}`,
      });
    }
  } else if (data.METRICS_GUARD_ALLOWLIST) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["METRICS_GUARD_ALLOWLIST"],
      message: "METRICS_GUARD_ALLOWLIST provided but METRICS_GUARD is not set to cidr",
    });
  }
  if (data.RATE_LIMIT_REDIS_URL?.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RATE_LIMIT_REDIS_URL"],
      message: "RATE_LIMIT_REDIS_URL cannot be blank",
    });
  }

  if (data.NODE_ENV === "production") {
    const allowlist = splitCommaSeparated(data.CORS_ORIGINS);
    if (allowlist.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGINS"],
        message: "Set CORS_ORIGINS with at least one allowed origin in production",
      });
    }
    const redisUrl = data.RATE_LIMIT_REDIS_URL?.trim();
    if (!redisUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RATE_LIMIT_REDIS_URL"],
        message: "RATE_LIMIT_REDIS_URL is required in production",
      });
    }
  }
});

export class ConfigError extends Error {
  constructor(public readonly errors: Record<string, string[]>) {
    super("Invalid configuration");
  }
}

export type AppConfig = z.infer<typeof EnvSchema> & {
  corsOriginsParsed: string[];
  metricsGuard: MetricsGuardConfig;
  rateLimitStore: RateLimitStoreConfig;
};

export type MetricsGuardConfig =
  | { type: "none" }
  | { type: "secret"; secret: string }
  | { type: "cidr"; allowlist: string[] };

export type RateLimitStoreConfig = { type: "memory" } | { type: "redis"; url: string };

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    // library code throws; the process should exit only at the boundary
    throw new ConfigError(errors);
  }
  const cfg = parsed.data;
  const corsOriginsParsed = splitCommaSeparated(cfg.CORS_ORIGINS);
  const metricsGuard: MetricsGuardConfig =
    cfg.METRICS_GUARD === "secret"
      ? { type: "secret", secret: cfg.METRICS_GUARD_SECRET!.trim() }
      : cfg.METRICS_GUARD === "cidr"
        ? {
            type: "cidr",
            allowlist: splitCommaSeparated(cfg.METRICS_GUARD_ALLOWLIST),
          }
        : { type: "none" };

  const redisUrl = cfg.RATE_LIMIT_REDIS_URL?.trim();
  const rateLimitStore: RateLimitStoreConfig = redisUrl
    ? { type: "redis", url: redisUrl }
    : { type: "memory" };

  cached = { ...cfg, corsOriginsParsed, metricsGuard, rateLimitStore };
  return cached!;
}
