import client from "prom-client";
import request from "supertest";
import { beforeAll, beforeEach, expect, test } from "vitest";

let app: any;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET ??= "test-access";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh";
  process.env.JWT_ACCESS_EXPIRY ??= "15m";
  process.env.JWT_REFRESH_EXPIRY ??= "7d";

  const mod = await import("../src/app.js");
  app = mod.default;
});

beforeEach(() => {
  client.register.resetMetrics();
});

test("metrics label includes router base path", async () => {
  await request(app).post("/auth/login").send({ email: "demo@example.com" }).expect(400);

  const metrics = await request(app).get("/metrics").expect(200);
  expect(metrics.text).toContain('route="/auth/login"');
  expect(metrics.text).not.toContain('route="/login"');
});
