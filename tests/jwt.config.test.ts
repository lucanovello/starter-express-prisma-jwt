/**
 * Verifies JWT helpers read secrets/expiries from the central config.
 * - Sets test-only envs
 * - Imports the module (config is read at import)
 * - Asserts sign + verify round-trips
 */

import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const OLD_ENV = { ...process.env };
beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test_access_secret";
  process.env.JWT_REFRESH_SECRET = "test_refresh_secret";
  process.env.JWT_ACCESS_EXPIRY = "1h";
  process.env.JWT_REFRESH_EXPIRY = "30d";
});
afterAll(() => {
  process.env = OLD_ENV;
  vi.resetModules();
});

describe("jwt config adoption", async () => {
  const jwtLib = await import("../src/lib/jwt.js");

  test("sign/verify access", () => {
    const token = jwtLib.signAccess({ sub: "u1" });
    const payload = jwtLib.verifyAccess<{ sub: string }>(token);
    expect(payload.sub).toBe("u1");
  });

  test("sign/verify refresh", () => {
    const token = jwtLib.signRefresh({ sid: "s1" });
    const payload = jwtLib.verifyRefresh<{ sid: string }>(token);
    expect(payload.sid).toBe("s1");
  });
});
