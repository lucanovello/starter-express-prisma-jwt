import { test, expect, beforeAll } from "vitest";
import request from "supertest";
import { resetDb } from "./utils/db.js";

let app: any;
beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET ??= "test-access";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh";
  process.env.JWT_ACCESS_EXPIRY ??= "15m";
  process.env.JWT_REFRESH_EXPIRY ??= "7d";

  const mod = await import("../src/app.js");
  app = mod.default;
});

test("register 400 on invalid email", async () => {
  const r = await request(app).post("/auth/register").send({ email: "nope", password: "short" });
  expect(r.status).toBe(400);
  expect(r.body.error.code).toBe("VALIDATION");
});

test("login 400 on missing password", async () => {
  const r = await request(app).post("/auth/login").send({ email: "a@b.c" });
  expect(r.status).toBe(400);
  expect(r.body.error.code).toBe("VALIDATION");
});

test("refresh 400 on missing token", async () => {
  const r = await request(app).post("/auth/refresh").send({});
  expect(r.status).toBe(400);
  expect(r.body.error.code).toBe("VALIDATION");
});

test("logout 400 on invalid token", async () => {
  const r = await request(app).post("/auth/logout").send({ refreshToken: 123 });
  expect(r.status).toBe(400);
  expect(r.body.error.code).toBe("VALIDATION");
});

test("register 409 on duplicate email (case-insensitive)", async () => {
  await resetDb();
  const email = `dupuser${Date.now()}@example.com`;
  const password = "Passw0rd!";
  // Initial registration should succeed
  await request(app).post("/auth/register").send({ email, password }).expect(201);
  // Second registration with same email in different case
  const res = await request(app)
    .post("/auth/register")
    .send({ email: email.toUpperCase(), password });
  expect(res.status).toBe(409);
  expect(res.body.error.code).toBe("EMAIL_TAKEN");
});
