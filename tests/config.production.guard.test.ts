import { afterEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("production configuration guardrails", () => {
  test("requires CORS_ORIGINS when NODE_ENV=production", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ORIGINS;
    process.env.RATE_LIMIT_REDIS_URL = "redis://localhost:6379";

    const { getConfig, ConfigError } = await import("../src/config/index.js");

    expect(() => getConfig()).toThrow(ConfigError);
    try {
      getConfig();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      if (err instanceof ConfigError) {
        expect(err.errors.CORS_ORIGINS).toBeDefined();
      }
    }
  });

  test("requires RATE_LIMIT_REDIS_URL when NODE_ENV=production", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://app.example.com";
    delete process.env.RATE_LIMIT_REDIS_URL;

    const { getConfig, ConfigError } = await import("../src/config/index.js");

    expect(() => getConfig()).toThrow(ConfigError);
    try {
      getConfig();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      if (err instanceof ConfigError) {
        expect(err.errors.RATE_LIMIT_REDIS_URL).toBeDefined();
      }
    }
  });

  test("treats blank RATE_LIMIT_REDIS_URL as invalid in production", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://app.example.com";
    process.env.RATE_LIMIT_REDIS_URL = "   ";

    const { getConfig, ConfigError } = await import("../src/config/index.js");

    expect(() => getConfig()).toThrow(ConfigError);
    try {
      getConfig();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      if (err instanceof ConfigError) {
        expect(err.errors.RATE_LIMIT_REDIS_URL).toBeDefined();
      }
    }
  });

  test("requires metrics guard when metrics are enabled in production", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://app.example.com";
    process.env.RATE_LIMIT_REDIS_URL = "redis://cache:6379";
    process.env.METRICS_ENABLED = "true";
    process.env.METRICS_GUARD = "none";

    const { getConfig, ConfigError } = await import("../src/config/index.js");

    expect(() => getConfig()).toThrow(ConfigError);
    try {
      getConfig();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      if (err instanceof ConfigError) {
        expect(err.errors.METRICS_GUARD).toBeDefined();
      }
    }
  });
});
