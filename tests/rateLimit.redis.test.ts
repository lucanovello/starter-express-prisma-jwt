import client from "prom-client";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import request from "supertest";

type RateLimitInfo = { totalHits: number; resetTime: Date };

const RATE_ENV_VARS = [
  "RATE_LIMIT_REDIS_URL",
  "RATE_LIMIT_RPM",
  "RATE_LIMIT_RPM_AUTH",
  "RATE_LIMIT_WINDOW_SEC",
];

const originalEnv: Record<string, string | undefined> = {};

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
});

const now = () => Date.now();

const setupFakeRedis = () => {
  const redisData = new Map<string, RateLimitInfo>();
  const stores: unknown[] = [];

  vi.doMock("redis", () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const sendCommand = vi.fn(async (...args: string[]) => {
      const [command] = args;
      const upper = command?.toUpperCase();
      switch (upper) {
        case "DECR": {
          const key = args[1]!;
          const entry = redisData.get(key);
          if (!entry) return 0;
          entry.totalHits = Math.max(0, entry.totalHits - 1);
          return entry.totalHits;
        }
        case "DEL": {
          const key = args[1]!;
          return Number(redisData.delete(key));
        }
        case "SCRIPT": {
          // Accept script loading but do nothing; Fake store bypasses sendCommand.
          return "fake-script";
        }
        case "EVALSHA": {
          // The fake store bypasses Lua execution; respond with zeros to satisfy awaits.
          return [0, 0];
        }
        default:
          throw new Error(`Unsupported command in fake redis: ${command}`);
      }
    });

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
      prefix: string;
      windowMs = 0;

      constructor(options: { prefix?: string }) {
        this.prefix = options.prefix ?? "rl:";
        stores.push(this);
      }

      private key(key: string) {
        return `${this.prefix}${key}`;
      }

      init(options: { windowMs: number }) {
        this.windowMs = options.windowMs;
      }

      private ensureFresh(key: string) {
        const entry = redisData.get(key);
        if (!entry) return undefined;
        if (entry.resetTime.getTime() <= now()) {
          redisData.delete(key);
          return undefined;
        }
        return entry;
      }

      async increment(key: string) {
        const fullKey = this.key(key);
        const existing = this.ensureFresh(fullKey);
        if (!existing) {
          const resetTime = new Date(now() + this.windowMs);
          const entry: RateLimitInfo = { totalHits: 1, resetTime };
          redisData.set(fullKey, entry);
          return { ...entry };
        }

        existing.totalHits += 1;
        return { totalHits: existing.totalHits, resetTime: existing.resetTime };
      }

      async get(key: string) {
        const entry = this.ensureFresh(this.key(key));
        return entry ? { ...entry } : undefined;
      }

      async decrement(key: string) {
        const entry = this.ensureFresh(this.key(key));
        if (!entry) return;
        entry.totalHits = Math.max(0, entry.totalHits - 1);
      }

      async resetKey(key: string) {
        redisData.delete(this.key(key));
      }
    }

    return { RedisStore: FakeRedisStore, default: FakeRedisStore };
  });

  return { stores };
};

test("redis-backed rate limiting persists counters between requests", async () => {
  const { stores } = setupFakeRedis();
  process.env.RATE_LIMIT_REDIS_URL = "redis://fake-host:6379";
  process.env.RATE_LIMIT_RPM = "2";
  process.env.RATE_LIMIT_RPM_AUTH = "2";
  process.env.RATE_LIMIT_WINDOW_SEC = "60";

  const mod = await import("../src/app.js");
  const app = mod.default;

  expect(stores.length).toBe(2);

  const agent = request(app);
  await agent.get("/health").expect(200);
  await agent.get("/health").expect(200);
  const blocked = await agent.get("/health");

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
