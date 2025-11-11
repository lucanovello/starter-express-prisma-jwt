import client from "prom-client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import request from "supertest";

const ENV_KEYS = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ACCESS_EXPIRY",
  "JWT_REFRESH_EXPIRY",
  "RESPONSE_COMPRESSION_ENABLED",
  "RESPONSE_COMPRESSION_MIN_BYTES",
  "NODE_ENV",
];

let previousEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  client.register.clear();
  previousEnv = {};
  for (const key of ENV_KEYS) {
    previousEnv[key] = process.env[key];
  }

  process.env.JWT_ACCESS_SECRET = "test_jwt_access_secret_32_chars_min";
  process.env.JWT_REFRESH_SECRET = "test_jwt_refresh_secret_32_chars_min";
  process.env.JWT_ACCESS_EXPIRY = "15m";
  process.env.JWT_REFRESH_EXPIRY = "7d";
  process.env.NODE_ENV = "development";
  delete process.env.RESPONSE_COMPRESSION_ENABLED;
  process.env.RESPONSE_COMPRESSION_MIN_BYTES = "64";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = previousEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("openapi.json responses are gzipped by default", async () => {
  const mod = await import("../src/app.js");
  const app = mod.default;

  const res = await request(app)
    .get("/openapi.json")
    .set("Accept-Encoding", "gzip, deflate");

  expect(res.status).toBe(200);
  expect(res.headers["content-encoding"]).toBe("gzip");
  expect(res.headers["cache-control"]).toBe("public, max-age=300, stale-while-revalidate=60");
});

test("compression can be disabled via env toggle", async () => {
  process.env.RESPONSE_COMPRESSION_ENABLED = "false";
  const mod = await import("../src/app.js");
  const app = mod.default;

  const res = await request(app)
    .get("/openapi.json")
    .set("Accept-Encoding", "gzip, deflate");

  expect(res.status).toBe(200);
  expect(res.headers["content-encoding"]).toBeUndefined();
});

test("/version emits cache headers for slow-changing metadata", async () => {
  const mod = await import("../src/app.js");
  const app = mod.default;

  const res = await request(app).get("/version");

  expect(res.status).toBe(200);
  expect(res.headers["cache-control"]).toBe("public, max-age=300, stale-while-revalidate=60");
});
