import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RATE_LIMIT_RPM: z.coerce.number().default(600),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().default(900),
  RATE_LIMIT_RPM_AUTH: z.coerce.number().default(120),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
  OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
  METRICS_ENABLED: z.string().optional(),
});

export class ConfigError extends Error {
  constructor(public readonly errors: Record<string, string[]>) {
    super("Invalid configuration");
  }
}

export type AppConfig = z.infer<typeof EnvSchema> & {
  corsOriginsParsed: string[];
};

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
  const corsOriginsParsed = (cfg.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  cached = { ...cfg, corsOriginsParsed };
  return cached!;
}
