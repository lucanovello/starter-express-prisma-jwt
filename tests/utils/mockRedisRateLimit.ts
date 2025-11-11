import { vi } from "vitest";

type RateLimitInfo = { totalHits: number; resetTime: Date };

const now = () => Date.now();

export const setupFakeRedis = () => {
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
          return "fake-script";
        }
        case "EVALSHA": {
          return [0, 0];
        }
        default:
          throw new Error(`Unsupported command in fake redis: ${command}`);
      }
    });

    const eventHandlers = new Map<string, Array<(payload?: unknown) => void>>();

    const emit = (event: string, payload?: unknown) => {
      const handlers = eventHandlers.get(event);
      handlers?.forEach((handler) => {
        handler(payload);
      });
    };

    const client = {
      connect,
      disconnect,
      sendCommand,
      on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
        const existing = eventHandlers.get(event) ?? [];
        existing.push(handler);
        eventHandlers.set(event, existing);
        if (event === "ready") {
          // Simulate ready firing shortly after listeners attached.
          handler();
        }
        return client;
      }),
      off: vi.fn((event: string, handler: (payload?: unknown) => void) => {
        const handlers = eventHandlers.get(event);
        if (handlers) {
          eventHandlers.set(
            event,
            handlers.filter((fn) => fn !== handler),
          );
        }
        return client;
      }),
      removeListener: vi.fn((event: string, handler: (payload?: unknown) => void) => {
        const handlers = eventHandlers.get(event);
        if (handlers) {
          eventHandlers.set(
            event,
            handlers.filter((fn) => fn !== handler),
          );
        }
        return client;
      }),
      emit,
    };

    return {
      createClient: () => client,
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
