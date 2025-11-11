import client from "prom-client";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";
import request from "supertest";

import { resetDb } from "./utils/db.js";
import { setupFakeRedis } from "./utils/mockRedisRateLimit.js";
import { prisma } from "../src/lib/prisma.js";

const ORIGINAL_ENV: Record<string, string | undefined> = {};
const REQUIRED_ENV = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ACCESS_EXPIRY",
  "JWT_REFRESH_EXPIRY",
  "CORS_ORIGINS",
  "RATE_LIMIT_REDIS_URL",
  "NODE_ENV",
];

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  client.register.clear();
  setupFakeRedis();

  for (const key of REQUIRED_ENV) {
    ORIGINAL_ENV[key] = process.env[key];
  }
  process.env.JWT_ACCESS_SECRET = "0123456789abcdef0123456789abcdef";
  process.env.JWT_REFRESH_SECRET = "fedcba9876543210fedcba9876543210";
  process.env.JWT_ACCESS_EXPIRY ??= "15m";
  process.env.JWT_REFRESH_EXPIRY ??= "7d";
  process.env.CORS_ORIGINS = "http://localhost";
  process.env.RATE_LIMIT_REDIS_URL = "redis://fake-host:6379";
  process.env.NODE_ENV = "production";

  await resetDb();
});

afterEach(() => {
  vi.unmock("redis");
  vi.unmock("rate-limit-redis");

  for (const key of REQUIRED_ENV) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

test("readiness fails when redis is unhealthy", async () => {
  const mod = await import("../src/app.js");
  const app = mod.default;

  const { markRateLimitRedisUnhealthy, getRateLimitRedisHealth } = await import(
    "../src/lib/rateLimitHealth.js"
  );
  markRateLimitRedisUnhealthy("connection dropped");
  expect(getRateLimitRedisHealth().status).toBe("unhealthy");
  const res = await request(app).get("/ready");

  expect(res.status).toBe(503);
  expect(res.body).toEqual({
    error: { message: "Redis not ready", code: "REDIS_NOT_READY" },
  });
});

test("readiness returns ready once redis recovers", async () => {
  const mod = await import("../src/app.js");
  const app = mod.default;

  const res = await request(app).get("/ready");

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ready" });
});
