import client from "prom-client";
import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const METRICS_SECRET_HEADER = "x-metrics-secret";

const setupMocks = () => {
  vi.doMock("redis", () => ({
    createClient: () => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      sendCommand: vi.fn().mockResolvedValue(undefined),
    }),
  }));

  vi.doMock("rate-limit-redis", () => {
    class FakeRedisStore {
      constructor(options: { prefix?: string } = {}) {
        this.prefix = options.prefix ?? "rl:";
      }

      prefix: string;

      // express-rate-limit calls init/increment/decrement/resetKey; keep them idempotent.
      init() {
        return undefined;
      }

      async increment() {
        return {
          totalHits: 1,
          resetTime: new Date(Date.now() + 60_000),
        };
      }

      async decrement() {
        return undefined;
      }

      async resetKey() {
        return undefined;
      }
    }

    return { RedisStore: FakeRedisStore, default: FakeRedisStore };
  });
};

const prepareBaseEnv = () => {
  process.env.NODE_ENV = "production";
  process.env.METRICS_ENABLED = "true";
  process.env.CORS_ORIGINS = "https://app.example.com";
  process.env.RATE_LIMIT_REDIS_URL = "redis://fake-host:6379";
  process.env.TRUST_PROXY = "loopback";
  process.env.JWT_ACCESS_SECRET = "prod-access-secret-0123456789abcdef";
  process.env.JWT_REFRESH_SECRET = "prod-refresh-secret-fedcba9876543210";
  process.env.JWT_ACCESS_EXPIRY = "15m";
  process.env.JWT_REFRESH_EXPIRY = "7d";
  delete process.env.METRICS_GUARD_SECRET;
  delete process.env.METRICS_GUARD_ALLOWLIST;
};

const setupProductionApp = async (configureMetrics: () => void) => {
  vi.resetModules();
  setupMocks();
  prepareBaseEnv();
  configureMetrics();
  client.register.clear();
  client.register.resetMetrics();
  const { resetConfigCache } = await import("../src/config/index.js");
  resetConfigCache();
  const mod = await import("../src/app.js");
  return mod.default;
};

describe("metrics guard in production", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock("redis");
    vi.unmock("rate-limit-redis");
    process.env = { ...ORIGINAL_ENV };
  });

  test("requires the configured secret header", async () => {
    const app = await setupProductionApp(() => {
      process.env.METRICS_GUARD = "secret";
      process.env.METRICS_GUARD_SECRET = "prod-guard-secret";
    });

    const missing = await request(app).get("/metrics").expect(401);
    expect(missing.body?.error?.code).toBe("METRICS_GUARD_MISSING");

    await request(app).get("/metrics").set(METRICS_SECRET_HEADER, "prod-guard-secret").expect(200);
  });

  test("enforces CIDR allowlist", async () => {
    const app = await setupProductionApp(() => {
      process.env.METRICS_GUARD = "cidr";
      process.env.METRICS_GUARD_ALLOWLIST = "203.0.113.0/24";
      process.env.TRUST_PROXY = "1";
    });

    const blocked = await request(app).get("/metrics").expect(403);
    expect(blocked.body?.error?.code).toBe("METRICS_GUARD_FORBIDDEN");

    await request(app).get("/metrics").set("x-forwarded-for", "203.0.113.22").expect(200);
  });
});
