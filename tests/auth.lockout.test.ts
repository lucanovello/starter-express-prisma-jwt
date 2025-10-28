import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { resetDb } from "./utils/db.js";

let app: any;
const ORIGINAL_ENV = { ...process.env };

async function loadApp() {
  const mod = await import("../src/app.js");
  return mod.default;
}

beforeAll(async () => {
  process.env.AUTH_LOGIN_MAX_ATTEMPTS = "3";
  process.env.AUTH_LOGIN_LOCKOUT_MINUTES = "10";
  process.env.AUTH_LOGIN_ATTEMPT_WINDOW_MINUTES = "15";
  vi.resetModules();
  app = await loadApp();
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

beforeEach(async () => {
  await resetDb();
});

describe("login brute-force guard", () => {
  test("locks account after repeated failures and allows login after lock expires", async () => {
    const email = `lockout_${Date.now()}@example.com`;
    const password = "Passw0rd!";

    await request(app).post("/auth/register").send({ email, password }).expect(201);

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post("/auth/login")
        .send({ email, password: "WrongPassw0rd!" })
        .expect(401);
    }

    const locked = await request(app)
      .post("/auth/login")
      .send({ email, password })
      .expect(429);
    expect(locked.body.error?.code).toBe("LOGIN_LOCKED");

    const { prisma } = await import("../src/lib/prisma.js");
    await prisma.loginAttempt.updateMany({
      where: { emailLowercase: email.toLowerCase() },
      data: {
        lockedUntil: new Date(Date.now() - 60 * 1000),
        failCount: 0,
        lastFailedAt: new Date(Date.now() - 60 * 1000),
      },
    });

    const success = await request(app)
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    expect(success.body.accessToken).toBeDefined();

    const attempts = await prisma.loginAttempt.findMany({
      where: { emailLowercase: email.toLowerCase() },
    });
    expect(attempts.length).toBe(0);
  });
});
