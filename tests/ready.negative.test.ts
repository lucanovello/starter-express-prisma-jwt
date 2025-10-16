import { test, expect, beforeAll, vi } from "vitest";
import request from "supertest";

let app: any;

beforeAll(async () => {
  // minimal env for modules that read on import
  process.env.JWT_ACCESS_SECRET ??= "test-access";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh";
  process.env.JWT_ACCESS_EXPIRY ??= "15m";
  process.env.JWT_REFRESH_EXPIRY ??= "7d";

  // Mock prisma to simulate DB outage for this test file
  vi.mock("../src/lib/prisma.js", () => {
    return {
      prisma: {
        $queryRaw: vi.fn().mockRejectedValue(new Error("db down")),
      },
    };
  });

  const mod = await import("../src/app.js");
  app = mod.default;
});

test("GET /ready -> 503 when DB ping fails", async () => {
  const r = await request(app).get("/ready");
  expect(r.status).toBe(503);
  expect(r.body).toEqual({
    error: { message: "Not Ready", code: "NOT_READY" },
  });
  expect(r.headers["x-request-id"]).toBeTruthy();
});
