import request from "supertest";
import { beforeAll, expect, test } from "vitest";

let app: any;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET ??= "test-access";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh";
  process.env.JWT_ACCESS_EXPIRY ??= "15m";
  process.env.JWT_REFRESH_EXPIRY ??= "7d";
  process.env.METRICS_GUARD = "secret";
  process.env.METRICS_GUARD_SECRET = "guard-secret";

  const mod = await import("../src/app.js");
  app = mod.default;
});

test("rejects missing metrics secret", async () => {
  const res = await request(app).get("/metrics").expect(401);
  expect(res.body?.error?.code).toBe("METRICS_GUARD_MISSING");
});

test("rejects incorrect metrics secret", async () => {
  const res = await request(app).get("/metrics").set("x-metrics-secret", "wrong").expect(401);
  expect(res.body?.error?.code).toBe("METRICS_GUARD_INVALID");
});

test("allows metrics with valid secret", async () => {
  await request(app).get("/metrics").set("x-metrics-secret", "guard-secret").expect(200);
});
