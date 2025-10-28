import request from "supertest";
import { afterEach, describe, expect, test, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("CORS allowlist enforcement", () => {
  test("rejects requests from origins not in the allowlist", async () => {
    process.env.CORS_ORIGINS = "https://allowed.example";
    vi.resetModules();

    const { default: app } = await import("../src/app.js");

    const res = await request(app)
      .get("/health")
      .set("Origin", "https://malicious.example");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: { message: "Forbidden", code: "CORS_ORIGIN_FORBIDDEN" },
    });
  });
});
