import client from "prom-client";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import request from "supertest";
import { setupFakeRedis } from "./utils/mockRedisRateLimit.js";

const RATE_ENV_VARS = [
  "CORS_ORIGINS",
  "RATE_LIMIT_REDIS_URL",
  "RATE_LIMIT_RPM",
  "RATE_LIMIT_RPM_AUTH",
  "RATE_LIMIT_RPM_AUTH_REGISTER",
  "RATE_LIMIT_RPM_AUTH_PASSWORD_RESET",
  "RATE_LIMIT_WINDOW_SEC",
  "TRUST_PROXY",
];

const originalEnv: Record<string, string | undefined> = {};
const originalNodeEnv = process.env.NODE_ENV;

beforeAll(() => {
  for (const key of RATE_ENV_VARS) {
    originalEnv[key] = process.env[key];
  }
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  client.register.clear();
  for (const key of RATE_ENV_VARS) {
    delete process.env[key];
  }
  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGINS = "http://localhost";
});

afterEach(() => {
  vi.resetModules();
  vi.unmock("redis");
  vi.unmock("rate-limit-redis");
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});


test("redis-backed rate limiting persists counters between requests", async () => {
  const { stores } = setupFakeRedis();
  process.env.RATE_LIMIT_REDIS_URL = "redis://fake-host:6379";
  process.env.RATE_LIMIT_RPM = "2";
  process.env.RATE_LIMIT_RPM_AUTH = "2";
  process.env.RATE_LIMIT_WINDOW_SEC = "60";

  const mod = await import("../src/app.js");
  const app = mod.default;

  expect(stores.length).toBe(4);

  const agent = request(app);
  await agent.get("/health").expect(200);
  await agent.get("/health").expect(200);
  const blocked = await agent.get("/health");

  expect(blocked.status).toBe(429);
});

test("rate limiter honours x-forwarded-for when trusting proxies", async () => {
  process.env.NODE_ENV = "development";
  process.env.TRUST_PROXY = "1";
  process.env.RATE_LIMIT_RPM = "2";
  process.env.RATE_LIMIT_WINDOW_SEC = "60";
  const mod = await import("../src/app.js");
  const app = mod.default;

  const agent = request(app);
  await agent.get("/health").set("x-forwarded-for", "198.51.100.20").expect(200);
  await agent.get("/health").set("x-forwarded-for", "198.51.100.20").expect(200);
  const blocked = await agent.get("/health").set("x-forwarded-for", "198.51.100.20");

  expect(blocked.status).toBe(429);
});

test("application fails fast when the redis store is unreachable", async () => {
  vi.doMock("rate-limit-redis", () => {
    class MinimalStore {
      init() {}
      async increment() {
        return { totalHits: 0, resetTime: new Date() };
      }
      async decrement() {}
      async resetKey() {}
    }
    return { RedisStore: MinimalStore, default: MinimalStore };
  });

  vi.doMock("redis", () => ({
    createClient: () => ({
      connect: vi.fn().mockRejectedValue(new Error("cannot connect")),
      disconnect: vi.fn().mockResolvedValue(undefined),
      sendCommand: vi.fn(),
    }),
  }));

  process.env.RATE_LIMIT_REDIS_URL = "redis://offline-host:6379";

  await expect(import("../src/app.js")).rejects.toThrow(/rate limit store/i);
});
