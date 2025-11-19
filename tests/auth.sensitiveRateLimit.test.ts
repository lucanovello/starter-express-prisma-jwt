import client from "prom-client";
import request from "supertest";
import { afterEach, afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { resetDb } from "./utils/db.js";

let app: any;
const ORIGINAL_ENV = { ...process.env };

async function loadApp() {
  const mod = await import("../src/app.js");
  return mod.default;
}

const uniqueEmail = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

const configureRateLimitEnv = () => {
  process.env = { ...ORIGINAL_ENV };
  process.env.RATE_LIMIT_WINDOW_SEC = "60";
  process.env.RATE_LIMIT_RPM = "1000";
  process.env.RATE_LIMIT_RPM_AUTH = "1000";
  process.env.RATE_LIMIT_RPM_AUTH_REGISTER = "2";
  process.env.RATE_LIMIT_RPM_AUTH_PASSWORD_RESET = "1";
};

beforeEach(async () => {
  vi.resetModules();
  client.register.clear();
  configureRateLimitEnv();
  app = await loadApp();
  await resetDb();
});

afterEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("auth register rate limit", () => {
  test("blocks registrations after threshold", async () => {
    const agent = request(app);
    await agent
      .post("/auth/register")
      .send({ email: uniqueEmail("register-limit"), password: "Passw0rd!" })
      .expect(201);
    await agent
      .post("/auth/register")
      .send({ email: uniqueEmail("register-limit"), password: "Passw0rd!" })
      .expect(201);

    const blocked = await agent
      .post("/auth/register")
      .send({ email: uniqueEmail("register-limit"), password: "Passw0rd!" });

    expect(blocked.status).toBe(429);
  });
});

describe("auth request-password-reset rate limit", () => {
  test("blocks password reset requests after threshold", async () => {
    const agent = request(app);
    const email = uniqueEmail("reset-limit");

    await agent.post("/auth/request-password-reset").send({ email }).expect(202);

    const blocked = await agent.post("/auth/request-password-reset").send({ email });

    expect(blocked.status).toBe(429);
  });
});
