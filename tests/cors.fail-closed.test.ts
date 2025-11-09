import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
  vi.doUnmock("redis");
  vi.doUnmock("rate-limit-redis");
});

async function importApp(options: { stubRedis?: boolean } = {}) {
  vi.resetModules();
  if (options.stubRedis) {
    vi.doMock("redis", () => {
      const connect = vi.fn().mockResolvedValue(undefined);
      const disconnect = vi.fn().mockResolvedValue(undefined);
      const sendCommand = vi.fn().mockResolvedValue(null);
      return {
        createClient: () => ({
          connect,
          disconnect,
          sendCommand,
        }),
      };
    });
    vi.doMock("rate-limit-redis", () => {
      class FakeRedisStore {
        windowMs = 1000;
        prefix?: string;
        constructor(options: { prefix?: string } = {}) {
          this.prefix = options.prefix;
        }
        init(options: { windowMs: number }) {
          this.windowMs = options.windowMs;
        }
        async increment() {
          return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
        }
        async get() {
          return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
        }
        async decrement() {}
        async resetKey() {}
      }
      return { RedisStore: FakeRedisStore, default: FakeRedisStore };
    });
  }
  const { register } = await import("prom-client");
  register.clear();
  try {
    return await import("../src/app.js");
  } finally {
    if (options.stubRedis) {
      vi.doUnmock("redis");
      vi.doUnmock("rate-limit-redis");
    }
  }
}

describe("CORS allowlist enforcement", () => {
  test("rejects requests from origins not in the allowlist", async () => {
    process.env.CORS_ORIGINS = "https://allowed.example";
    const { default: app } = await importApp();

    const res = await request(app).get("/health").set("Origin", "https://malicious.example");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: { message: "Forbidden", code: "CORS_ORIGIN_FORBIDDEN" },
    });
  });

  test("returns hardened CORS headers for allowed origins", async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://allowed.example";
    process.env.RATE_LIMIT_REDIS_URL = "redis://cache:6379";
    const { default: app } = await importApp({ stubRedis: true });

    const res = await request(app).get("/health").set("Origin", "https://allowed.example");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://allowed.example");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(res.headers["access-control-expose-headers"]).toContain("x-request-id");
    expect(res.headers["access-control-expose-headers"]).toContain("RateLimit-Limit");

    const preflight = await request(app)
      .options("/health")
      .set("Origin", "https://allowed.example")
      .set("Access-Control-Request-Method", "GET");

    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-max-age"]).toBe("600");
    expect(preflight.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});
