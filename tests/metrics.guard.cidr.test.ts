import request from "supertest";
import { beforeAll, expect, test } from "vitest";

let app: any;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET ??= "test-access";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh";
  process.env.JWT_ACCESS_EXPIRY ??= "15m";
  process.env.JWT_REFRESH_EXPIRY ??= "7d";
  process.env.METRICS_GUARD = "cidr";
  process.env.METRICS_GUARD_ALLOWLIST = "203.0.113.0/24";

  const mod = await import("../src/app.js");
  app = mod.default;
  app.set("trust proxy", "loopback");
});

test("rejects IP outside allowlist", async () => {
  const res = await request(app).get("/metrics").expect(403);
  expect(res.body?.error?.code).toBe("METRICS_GUARD_FORBIDDEN");
});

test("allows request from allowlisted CIDR", async () => {
  await request(app)
    .get("/metrics")
    .set("x-forwarded-for", "203.0.113.5")
    .expect(200);
});
