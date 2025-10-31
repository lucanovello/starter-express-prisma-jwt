import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { ConfigError, getConfig, resetConfigCache } from "../src/config/index.js";

describe("Environment configuration validation", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    resetConfigCache();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetConfigCache();
  });

  test("requires DATABASE_URL", () => {
    delete process.env.DATABASE_URL;

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("requires JWT secrets with minimum length", () => {
    process.env.JWT_ACCESS_SECRET = "short";

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("validates NODE_ENV enum values", () => {
    process.env.NODE_ENV = "invalid" as any;

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("validates METRICS_GUARD enum values", () => {
    process.env.METRICS_GUARD = "invalid" as any;

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("accepts valid minimal configuration", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);

    expect(() => getConfig()).not.toThrow();
  });

  test("parses boolean environment variables correctly", () => {
    process.env.NODE_ENV = "development";
    process.env.METRICS_ENABLED = "true";
    process.env.AUTH_EMAIL_VERIFICATION_REQUIRED = "false";

    const config = getConfig();

    expect(config.metricsEnabled).toBe(true);
    expect(config.auth.emailVerificationRequired).toBe(false);
  });

  test("parses TRUST_PROXY env into an express-compatible value", () => {
    process.env.TRUST_PROXY = "1";

    const config = getConfig();

    expect(config.trustProxy).toBe(1);
  });

  test("converts duration strings to milliseconds", () => {
    process.env.AUTH_EMAIL_VERIFICATION_TTL_MINUTES = "60";
    process.env.AUTH_PASSWORD_RESET_TTL_MINUTES = "30";

    const config = getConfig();

    expect(config.auth.emailVerificationTtlMs).toBe(60 * 60 * 1000);
    expect(config.auth.passwordResetTtlMs).toBe(30 * 60 * 1000);
  });

  test("validates CORS_ORIGINS required in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ORIGINS;

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("validates RATE_LIMIT_REDIS_URL required in production", () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://example.com";
    delete process.env.RATE_LIMIT_REDIS_URL;

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("validates METRICS_GUARD_SECRET required when METRICS_GUARD=secret", () => {
    process.env.METRICS_GUARD = "secret";
    delete process.env.METRICS_GUARD_SECRET;

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("validates METRICS_GUARD_ALLOWLIST required when METRICS_GUARD=cidr", () => {
    process.env.METRICS_GUARD = "cidr";
    delete process.env.METRICS_GUARD_ALLOWLIST;

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("validates CIDR format in METRICS_GUARD_ALLOWLIST", () => {
    process.env.METRICS_GUARD = "cidr";
    process.env.METRICS_GUARD_ALLOWLIST = "not-a-valid-cidr";

    expect(() => getConfig()).toThrow(ConfigError);
  });

  test("accepts valid CIDR in METRICS_GUARD_ALLOWLIST", () => {
    process.env.NODE_ENV = "development";
    process.env.METRICS_GUARD = "cidr";
    process.env.METRICS_GUARD_ALLOWLIST = "203.0.113.0/24,192.168.1.0/24";

    expect(() => getConfig()).not.toThrow();

    const config = getConfig();
    expect(config.metricsGuard).toEqual({
      type: "cidr",
      allowlist: ["203.0.113.0/24", "192.168.1.0/24"],
    });
  });

  test("defaults to development environment", () => {
    delete process.env.NODE_ENV;

    const config = getConfig();

    expect(config.NODE_ENV).toBe("development");
  });

  test("sets default timeouts and limits", () => {
    const config = getConfig();

    expect(config.HTTP_SERVER_REQUEST_TIMEOUT_MS).toBe(30_000);
    expect(config.HTTP_SERVER_HEADERS_TIMEOUT_MS).toBe(60_000);
    expect(config.HTTP_SERVER_KEEPALIVE_TIMEOUT_MS).toBe(5_000);
    expect(config.REQUEST_BODY_LIMIT).toBe("100kb");
  });
});
