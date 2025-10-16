import { test, expect, beforeAll } from "vitest";
import request from "supertest";

let app: any;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET ?? "test-access";
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? "test-refresh";
  process.env.JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY ?? "15m";
  process.env.JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY ?? "7d";

  const mod = await import("../src/app.js");
  app = mod.default;
});

test("GET /health -> 200 with {status:'ok'} and x-request-id", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: "ok" });
  expect(res.headers["x-request-id"]).toBeTruthy();
});
