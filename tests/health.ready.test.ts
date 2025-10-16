import { test, expect, beforeAll } from "vitest";
import request from "supertest";

let app: any;

beforeAll(async () => {
  // Ensure JWT env is present for modules that read on import
  process.env.JWT_ACCESS_SECRET ??= "test-access";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh";
  process.env.JWT_ACCESS_EXPIRY ??= "15m";
  process.env.JWT_REFRESH_EXPIRY ??= "7d";

  const mod = await import("../src/app.js");
  app = mod.default;
});

test("GET /health -> 200 {status:'ok'}", async () => {
  const r = await request(app).get("/health");
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ status: "ok" });
  expect(r.headers["x-request-id"]).toBeTruthy();
});

test("GET /ready -> 200 {status:'ready'} (DB reachable)", async () => {
  const r = await request(app).get("/ready");
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ status: "ready" });
  expect(r.headers["x-request-id"]).toBeTruthy();
});
