import { beforeAll, beforeEach, expect, test } from "vitest";
import request from "supertest";

import { prisma } from "../src/lib/prisma.js";
import { resetDb } from "./utils/db.js";

let app: any;
let decodeRefresh: <T extends object = { [key: string]: unknown }>(
  token: string
) => T | null;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test-access";
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test-refresh";
  process.env.JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY ?? "15m";
  process.env.JWT_REFRESH_EXPIRY = "1s";

  ({ decodeRefresh } = await import("../src/lib/jwt.js"));
  const mod = await import("../src/app.js");
  app = mod.default;
});

beforeEach(async () => {
  await resetDb();
});

function uniqueEmail() {
  return `user+${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test("refresh rejects when session expires", async () => {
  const email = uniqueEmail();
  const password = "Passw0rd!";

  await request(app).post("/auth/register").send({ email, password }).expect(201);

  const login = await request(app).post("/auth/login").send({ email, password }).expect(200);
  const refreshToken = login.body.refreshToken;
  expect(typeof refreshToken).toBe("string");

  const decoded = decodeRefresh<{ sid: string }>(refreshToken);
  expect(decoded?.sid).toBeTruthy();
  const sid = decoded!.sid;

  // Wait for the token to expire (1s TTL from config above).
  await new Promise((resolve) => setTimeout(resolve, 2_500));

  const res = await request(app)
    .post("/auth/refresh")
    .send({ refreshToken })
    .expect(401);

  expect(res.body?.error?.code).toBe("SESSION_EXPIRED");

  const session = await prisma.session.findUnique({ where: { id: sid } });
  expect(session?.valid).toBe(false);
});
