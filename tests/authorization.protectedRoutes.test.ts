import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import request from "supertest";

import { prisma } from "../src/lib/prisma.js";
import { resetDb } from "./utils/db.js";

type UserRole = "USER" | "ADMIN";

let app: any;
const ORIGINAL_ENV = { ...process.env };

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "test-access";
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test-refresh";
  process.env.JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY ?? "15m";
  process.env.JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY ?? "7d";
  process.env.RATE_LIMIT_RPM_AUTH_REGISTER = process.env.RATE_LIMIT_RPM_AUTH_REGISTER ?? "120";

  const mod = await import("../src/app.js");
  app = mod.default;
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

beforeEach(async () => {
  await resetDb();
});

const uniqueEmail = () =>
  `user+${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

async function createUser(role: UserRole = "USER") {
  const email = uniqueEmail();
  const password = "Passw0rd!";

  await request(app)
    .post("/auth/register")
    .send({ email, password })
    .expect(201);

  const record = await prisma.user.findFirstOrThrow({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  if (role !== "USER") {
    await prisma.user.update({
      where: { id: record.id },
      data: { role },
    });
  }

  const login = await request(app)
    .post("/auth/login")
    .send({ email, password })
    .expect(200);

  const accessToken = login.body.accessToken as string;

  return { id: record.id, email, accessToken };
}

test("protected admin route returns 401 when unauthenticated", async () => {
  const res = await request(app).get("/protected/admin/ping").expect(401);
  expect(res.body?.error?.message).toBeDefined();
});

test("protected admin route returns 403 for non-admin users", async () => {
  const user = await createUser("USER");

  await request(app)
    .get("/protected/admin/ping")
    .set("Authorization", `Bearer ${user.accessToken}`)
    .expect(403);
});

test("protected admin route returns 200 for admins", async () => {
  const admin = await createUser("ADMIN");

  const res = await request(app)
    .get("/protected/admin/ping")
    .set("Authorization", `Bearer ${admin.accessToken}`)
    .expect(200);

  expect(res.body).toMatchObject({ status: "ok" });
});

test("ownership guard allows the resource owner", async () => {
  const owner = await createUser("USER");

  const res = await request(app)
    .get(`/protected/users/${owner.id}`)
    .set("Authorization", `Bearer ${owner.accessToken}`)
    .expect(200);

  expect(res.body?.owner).toBe(true);
  expect(res.body?.user?.id).toBe(owner.id);
});

test("ownership guard rejects other users", async () => {
  const owner = await createUser("USER");
  const intruder = await createUser("USER");

  await request(app)
    .get(`/protected/users/${owner.id}`)
    .set("Authorization", `Bearer ${intruder.accessToken}`)
    .expect(403);
});

test("protected user route validates uuid param", async () => {
  const admin = await createUser("ADMIN");

  const res = await request(app)
    .get("/protected/users/not-a-uuid")
    .set("Authorization", `Bearer ${admin.accessToken}`)
    .expect(400);

  expect(res.body?.error?.code).toBe("VALIDATION");
});
