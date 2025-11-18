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

describe("session management", () => {
  test("lists sessions and supports logout-all", async () => {
    const email = `sessions_${Date.now()}@example.com`;
    const password = "Passw0rd!";

    await request(app).post("/auth/register").send({ email, password }).expect(201);

    const loginOne = await request(app).post("/auth/login").send({ email, password }).expect(200);
    const loginTwo = await request(app).post("/auth/login").send({ email, password }).expect(200);

    const accessToken = loginTwo.body.accessToken as string;
    const refreshToken = loginTwo.body.refreshToken as string;

    // 1) Before logout-all, sessions list works
    const list = await request(app)
      .get("/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(list.body.sessions)).toBe(true);
    expect(list.body.sessions.length).toBeGreaterThanOrEqual(2);
    const current = list.body.sessions.find((s: any) => s.current === true);
    expect(current).toBeDefined();
    expect(typeof current.id).toBe("string");

    // 2) Logout all sessions
    await request(app)
      .post("/auth/logout-all")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    // 3) Refresh with old refresh token should fail
    await request(app).post("/auth/refresh").send({ refreshToken }).expect(401);

    // 4) Old access token should now also be rejected
    await request(app)
      .get("/auth/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
  });

  test("requires authorization header for session routes", async () => {
    await request(app).get("/auth/sessions").expect(401);
    await request(app).post("/auth/logout-all").expect(401);
  });
});
