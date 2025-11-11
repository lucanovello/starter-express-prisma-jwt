import * as ipaddr from "ipaddr.js";
import { z } from "zod";

const splitCommaSeparated = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const parseBooleanEnv = (value: string | undefined): boolean =>
  value != null && value.trim().toLowerCase() === "true";

type TrustProxySetting = boolean | number | string | string[];

const parseTrustProxySetting = (value: string): TrustProxySetting => {
  const trimmed = value.trim();
  if (trimmed === "") return false;

  const lower = trimmed.toLowerCase();
  if (["false", "off", "no"].includes(lower)) {
    return false;
  }
  if (["true", "on", "yes"].includes(lower)) {
    return true;
  }
  if (lower === "none") {
    return false;
  }

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric;
  }

  if (trimmed.includes(",")) {
    const parts = trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      return false;
    }
    if (parts.length === 1) {
      return parts[0]!;
    }
    return parts;
  }

  return trimmed;
};

const validateCidr = (cidr: string): boolean => {
  try {
    ipaddr.parseCIDR(cidr);
    return true;
  } catch {
    return false;
  }
};

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string(),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT access secret must be at least 32 characters long"),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, "JWT refresh secret must be at least 32 characters long"),
    JWT_ACCESS_EXPIRY: z.string().default("15m"),
    JWT_REFRESH_EXPIRY: z.string().default("7d"),
    CORS_ORIGINS: z.string().optional(),
    CORS_ALLOW_CREDENTIALS: z.string().optional(),
    CORS_MAX_AGE_SECONDS: z.coerce.number().int().nonnegative().default(600),
    TRUST_PROXY: z.string().default("loopback"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    RATE_LIMIT_RPM: z.coerce.number().default(600),
    RATE_LIMIT_WINDOW_SEC: z.coerce.number().default(900),
    RATE_LIMIT_RPM_AUTH: z.coerce.number().default(120),
    RATE_LIMIT_REDIS_URL: z
      .string()
      .url("RATE_LIMIT_REDIS_URL must be a valid URL (e.g. redis://:pass@host:6379)")
      .optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_SECURE: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().email().optional(),
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
    AUTH_EMAIL_VERIFICATION_REQUIRED: z.string().optional(),
    AUTH_EMAIL_VERIFICATION_TTL_MINUTES: z.coerce.number().int().positive().default(60),
    AUTH_PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
    AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    AUTH_LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
    AUTH_LOGIN_ATTEMPT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
    RESPONSE_COMPRESSION_ENABLED: z.string().optional(),
    RESPONSE_COMPRESSION_MIN_BYTES: z.coerce.number().int().nonnegative().default(1024),
  })
  .superRefine((data, ctx) => {
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
      const metricsEnabled = parseBooleanEnv(data.METRICS_ENABLED);
      if (metricsEnabled && data.METRICS_GUARD === "none") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["METRICS_GUARD"],
          message: "METRICS_GUARD must be secret or cidr when METRICS_ENABLED=true in production",
        });
      }

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

    const emailVerificationRequired = parseBooleanEnv(data.AUTH_EMAIL_VERIFICATION_REQUIRED);
    if (emailVerificationRequired) {
      const smtpHost = data.SMTP_HOST?.trim();
      if (!smtpHost) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_HOST"],
          message: "SMTP_HOST is required when AUTH_EMAIL_VERIFICATION_REQUIRED=true",
        });
      }

      if (!data.SMTP_PORT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_PORT"],
          message: "SMTP_PORT is required when AUTH_EMAIL_VERIFICATION_REQUIRED=true",
        });
      }

      const smtpFrom = data.SMTP_FROM?.trim();
      if (!smtpFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMTP_FROM"],
          message: "SMTP_FROM is required when AUTH_EMAIL_VERIFICATION_REQUIRED=true",
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
  corsAllowCredentials: boolean;
  corsMaxAgeSeconds: number;
  metricsEnabled: boolean;
  metricsGuard: MetricsGuardConfig;
  trustProxy: TrustProxySetting;
  rateLimitStore: RateLimitStoreConfig;
  responseCompression: {
    enabled: boolean;
    minBytes: number;
  };
  smtp: {
    host: string | undefined;
    port: number | undefined;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
    from: string | undefined;
  };
  auth: {
    emailVerificationRequired: boolean;
    emailVerificationTtlMs: number;
    passwordResetTtlMs: number;
    loginMaxAttempts: number;
    loginLockoutMs: number;
    loginAttemptWindowMs: number;
  };
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
  const metricsEnabled = parseBooleanEnv(cfg.METRICS_ENABLED);
  const trustProxy = parseTrustProxySetting(cfg.TRUST_PROXY);
  const allowCredentialsEnv = cfg.CORS_ALLOW_CREDENTIALS;
  const corsAllowCredentials =
    cfg.NODE_ENV === "production"
      ? allowCredentialsEnv
        ? parseBooleanEnv(allowCredentialsEnv)
        : false
      : allowCredentialsEnv
        ? parseBooleanEnv(allowCredentialsEnv)
        : true;
  const corsMaxAgeSeconds = cfg.CORS_MAX_AGE_SECONDS;
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

  const smtp = {
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    secure: parseBooleanEnv(cfg.SMTP_SECURE),
    user: cfg.SMTP_USER,
    pass: cfg.SMTP_PASS,
    from: cfg.SMTP_FROM,
  };

  const auth = {
    emailVerificationRequired: parseBooleanEnv(cfg.AUTH_EMAIL_VERIFICATION_REQUIRED),
    emailVerificationTtlMs: cfg.AUTH_EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
    passwordResetTtlMs: cfg.AUTH_PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    loginMaxAttempts: cfg.AUTH_LOGIN_MAX_ATTEMPTS,
    loginLockoutMs: cfg.AUTH_LOGIN_LOCKOUT_MINUTES * 60 * 1000,
    loginAttemptWindowMs: cfg.AUTH_LOGIN_ATTEMPT_WINDOW_MINUTES * 60 * 1000,
  };

  const compressionEnabledEnv = cfg.RESPONSE_COMPRESSION_ENABLED;
  const responseCompression = {
    enabled: compressionEnabledEnv ? parseBooleanEnv(compressionEnabledEnv) : true,
    minBytes: cfg.RESPONSE_COMPRESSION_MIN_BYTES,
  };

  cached = {
    ...cfg,
    corsOriginsParsed,
    corsAllowCredentials,
    corsMaxAgeSeconds,
    metricsEnabled,
    trustProxy,
    metricsGuard,
    rateLimitStore,
    responseCompression,
    smtp,
    auth,
  };
  return cached!;
}

export function resetConfigCache(): void {
  cached = null;
}
