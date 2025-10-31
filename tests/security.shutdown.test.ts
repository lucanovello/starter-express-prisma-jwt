import express from "express";
import { afterEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("security middleware teardown", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
    vi.unmock("redis");
    vi.unmock("rate-limit-redis");
  });

  test("disconnects redis client during teardown", async () => {
    vi.resetModules();

    const connect = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const sendCommand = vi.fn().mockResolvedValue(undefined);

    vi.doMock("redis", () => ({
      createClient: () => ({
        connect,
        disconnect,
        sendCommand,
      }),
    }));

    vi.doMock("rate-limit-redis", () => {
      class FakeRedisStore {
        prefix: string;

        constructor(options: { prefix?: string } = {}) {
          this.prefix = options.prefix ?? "rl:";
        }

        init() {
          return undefined;
        }

        async increment() {
          return {
            totalHits: 1,
            resetTime: new Date(),
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

    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://app.example.com";
    process.env.RATE_LIMIT_REDIS_URL = "redis://cache:6379";
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    process.env.JWT_ACCESS_EXPIRY = "15m";
    process.env.JWT_REFRESH_EXPIRY = "7d";

    const { resetConfigCache } = await import("../src/config/index.js");
    resetConfigCache();

    const { registerSecurity } = await import("../src/middleware/security.js");
    const app = express();
    const teardown = await registerSecurity(app);

    await teardown();
    resetConfigCache();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
