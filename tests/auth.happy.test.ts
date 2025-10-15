/**
 * Auth integration tests:
 * - register -> login -> refresh (rotate) -> logout
 * - old refresh token is rejected after rotation (reuse detection)
 */
import { beforeAll, beforeEach, expect, test } from "vitest";
import request from "supertest";
import { resetDb } from "./utils/db.js";

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

beforeEach(async () => {
  await resetDb();
});

// simple unique email per test run
function uniqueEmail() {
  return `user+${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}@example.com`;
}

test("register → login → refresh rotates → old refresh rejected → logout", async () => {
  const email = uniqueEmail();
  const password = "Passw0rd!";

  // 1) REGISTER
  const reg = await request(app)
    .post("/auth/register")
    .send({ email, password })
    .expect(201);

  // Some APIs return tokens on register; if not, we'll login anyway.
  // prefer tokens from login for clarity
  // 2) LOGIN
  const login = await request(app)
    .post("/auth/login")
    .send({ email, password })
    .expect(200);

  expect(login.body).toHaveProperty("accessToken");
  expect(login.body).toHaveProperty("refreshToken");
  const refresh1 = login.body.refreshToken;

  // 3) REFRESH (ROTATE)
  const refreshRes = await request(app)
    .post("/auth/refresh")
    .send({ refreshToken: refresh1 })
    .expect(200);

  expect(refreshRes.body).toHaveProperty("accessToken");
  expect(refreshRes.body).toHaveProperty("refreshToken");
  const refresh2 = refreshRes.body.refreshToken;

  // rotated token must differ
  expect(refresh2).not.toBe(refresh1);

  // 3b) REUSE DETECTION: using old refresh should now fail (401)
  const reuse = await request(app)
    .post("/auth/refresh")
    .send({ refreshToken: refresh1 })
    .expect(401);

  // API returns a typed error code under error.code; don't assert exact value
  // to avoid flakiness, just ensure a machine code exists.
  expect(typeof reuse.body?.error?.code).toBe("string");

  // 4) LOGOUT (with the latest refresh)
  await request(app)
    .post("/auth/logout")
    .send({ refreshToken: refresh2 })
    .expect(204);

  // After logout, the token is invalid
  await request(app)
    .post("/auth/refresh")
    .send({ refreshToken: refresh2 })
    .expect(401);
});
