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
  process.env.AUTH_PASSWORD_RESET_TTL_MINUTES = "60";
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

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describe("password reset flow", () => {
  test("request endpoint responds identically for known and unknown emails", async () => {
    const email = uniqueEmail("reset");
    const password = "Passw0rd!";

    await request(app).post("/auth/register").send({ email, password }).expect(201);

    const known = await request(app)
      .post("/auth/request-password-reset")
      .send({ email })
      .expect(202);
    const unknown = await request(app)
      .post("/auth/request-password-reset")
      .send({ email: "missing@example.com" })
      .expect(202);

    expect(known.body).toEqual({ status: "ok" });
    expect(unknown.body).toEqual({ status: "ok" });
  });

  test("reset password using valid token revokes sessions", async () => {
    const email = uniqueEmail("reset-valid");
    const password = "Passw0rd!";
    const newPassword = "NewPassw0rd!";

    const register = await request(app)
      .post("/auth/register")
      .send({ email, password })
      .expect(201);

    expect(register.body.accessToken).toBeDefined();
    expect(register.body.refreshToken).toBeDefined();

    const { prisma } = await import("../src/lib/prisma.js");
    const { hashToken } = await import("../src/lib/tokenHash.js");

    const user = await prisma.user.findFirstOrThrow({
      where: { email: email.toLowerCase() },
    });

    const rawToken = `reset-${user.id}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: await hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await request(app)
      .post("/auth/reset-password")
      .send({ token: rawToken, password: newPassword })
      .expect(204);

    const refresh = register.body.refreshToken as string;
    await request(app).post("/auth/refresh").send({ refreshToken: refresh }).expect(401);

    const loginOld = await request(app).post("/auth/login").send({ email, password }).expect(401);
    expect(loginOld.body.error?.code).toBe("INVALID_CREDENTIALS");

    const loginNew = await request(app)
      .post("/auth/login")
      .send({ email, password: newPassword })
      .expect(200);
    expect(loginNew.body.accessToken).toBeDefined();
  });

  test("reset password rejects weak password", async () => {
    const email = uniqueEmail("reset-weak");
    const password = "Passw0rd!";

    await request(app).post("/auth/register").send({ email, password }).expect(201);

    const { prisma } = await import("../src/lib/prisma.js");
    const { hashToken } = await import("../src/lib/tokenHash.js");

    const user = await prisma.user.findFirstOrThrow({
      where: { email: email.toLowerCase() },
    });

    const rawToken = `weak-${user.id}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: await hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post("/auth/reset-password")
      .send({ token: rawToken, password: "alllower" })
      .expect(400);

    expect(res.body.error?.code).toBe("VALIDATION");
  });

  test("rejects expired and already used reset tokens", async () => {
    const email = uniqueEmail("reset-expired");
    const password = "Passw0rd!";

    await request(app).post("/auth/register").send({ email, password }).expect(201);

    const { prisma } = await import("../src/lib/prisma.js");
    const { hashToken } = await import("../src/lib/tokenHash.js");

    const user = await prisma.user.findFirstOrThrow({
      where: { email: email.toLowerCase() },
    });

    const expiredToken = `expired-${user.id}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: await hashToken(expiredToken),
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
    });

    const expired = await request(app)
      .post("/auth/reset-password")
      .send({ token: expiredToken, password: "AnotherPass1!" })
      .expect(400);
    expect(expired.body.error?.code).toBe("PASSWORD_RESET_EXPIRED");

    const usedToken = `used-${user.id}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: await hashToken(usedToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(),
      },
    });

    const used = await request(app)
      .post("/auth/reset-password")
      .send({ token: usedToken, password: "AnotherPass2!" })
      .expect(400);
    expect(used.body.error?.code).toBe("PASSWORD_RESET_INVALID");
  });
});
