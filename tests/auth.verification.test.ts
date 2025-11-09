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
  process.env.AUTH_EMAIL_VERIFICATION_REQUIRED = "true";
  process.env.AUTH_EMAIL_VERIFICATION_TTL_MINUTES = "60";
  // Provide minimal SMTP configuration required when email verification is enabled
  process.env.SMTP_HOST = "localhost";
  process.env.SMTP_PORT = "1025";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_FROM = "noreply@example.com";
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

describe("email verification flow", () => {
  test("successfully verifies email and consumes token", async () => {
    const email = `verify_user_${Date.now()}@example.com`;
    const password = "Passw0rd!";

    const register = await request(app)
      .post("/auth/register")
      .send({ email, password })
      .expect(201);

    expect(register.body.emailVerificationRequired).toBe(true);
    expect(register.body.accessToken).toBeUndefined();

    const { prisma } = await import("../src/lib/prisma.js");
    const { hashToken } = await import("../src/lib/tokenHash.js");

    const user = await prisma.user.findFirstOrThrow({
      where: { email: email.toLowerCase() },
      include: { verificationTokens: true },
    });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.verificationTokens).toHaveLength(1);

    const existingToken = user.verificationTokens[0];
    const rawToken = `verify-${existingToken.id}`;
    await prisma.verificationToken.update({
      where: { id: existingToken.id },
      data: { tokenHash: await hashToken(rawToken) },
    });

    await request(app).post("/auth/verify-email").send({ token: rawToken }).expect(204);

    const refreshedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(refreshedUser.emailVerifiedAt).not.toBeNull();

    const tokens = await prisma.verificationToken.findMany({
      where: { userId: user.id },
    });
    tokens.forEach((t) => {
      expect(t.usedAt).not.toBeNull();
    });

    const reuse = await request(app)
      .post("/auth/verify-email")
      .send({ token: rawToken })
      .expect(400);
    expect(reuse.body.error?.code).toBe("EMAIL_VERIFICATION_INVALID");
  });

  test("rejects expired verification token", async () => {
    const email = `verify_expired_${Date.now()}@example.com`;
    const password = "Passw0rd!";

    await request(app).post("/auth/register").send({ email, password }).expect(201);

    const { prisma } = await import("../src/lib/prisma.js");
    const { hashToken } = await import("../src/lib/tokenHash.js");

    const user = await prisma.user.findFirstOrThrow({
      where: { email: email.toLowerCase() },
      include: { verificationTokens: true },
    });

    const existingToken = user.verificationTokens[0];
    const rawToken = `expired-${existingToken.id}`;

    await prisma.verificationToken.update({
      where: { id: existingToken.id },
      data: {
        tokenHash: await hashToken(rawToken),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const res = await request(app).post("/auth/verify-email").send({ token: rawToken }).expect(400);
    expect(res.body.error?.code).toBe("EMAIL_VERIFICATION_EXPIRED");

    const refreshedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(refreshedUser.emailVerifiedAt).toBeNull();
  });

  test("login is blocked until email is verified", async () => {
    const email = `verify_login_${Date.now()}@example.com`;
    const password = "Passw0rd!";

    await request(app).post("/auth/register").send({ email, password }).expect(201);

    const denied = await request(app).post("/auth/login").send({ email, password }).expect(401);
    expect(denied.body.error?.code).toBe("INVALID_CREDENTIALS");

    const { prisma } = await import("../src/lib/prisma.js");
    const { hashToken } = await import("../src/lib/tokenHash.js");

    const user = await prisma.user.findFirstOrThrow({
      where: { email: email.toLowerCase() },
      include: { verificationTokens: true },
    });
    const rawToken = `login-${user.id}`;
    await prisma.verificationToken.update({
      where: { id: user.verificationTokens[0].id },
      data: { tokenHash: await hashToken(rawToken) },
    });

    await request(app).post("/auth/verify-email").send({ token: rawToken }).expect(204);

    const allowed = await request(app).post("/auth/login").send({ email, password }).expect(200);
    expect(allowed.body.accessToken).toBeDefined();
  });
});
