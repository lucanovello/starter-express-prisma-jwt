/**
 * Verifies JWT helpers read secrets/expiries from the central config.
 * - Sets test-only envs
 * - Imports the module (config is read at import)
 * - Asserts sign + verify round-trips
 */

import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

const OLD_ENV = { ...process.env };
const STRONG_ACCESS_SECRET = "0123456789abcdef0123456789abcdef";
const STRONG_REFRESH_SECRET = "fedcba9876543210fedcba9876543210";

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = STRONG_ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = STRONG_REFRESH_SECRET;
  process.env.JWT_ACCESS_EXPIRY = "1h";
  process.env.JWT_REFRESH_EXPIRY = "30d";
});
afterAll(() => {
  process.env = OLD_ENV;
  vi.resetModules();
});

describe("config validation", () => {
  test("rejects weak JWT secrets", async () => {
    vi.resetModules();
    const prevAccess = process.env.JWT_ACCESS_SECRET;
    const prevRefresh = process.env.JWT_REFRESH_SECRET;

    process.env.JWT_ACCESS_SECRET = "too-short";
    process.env.JWT_REFRESH_SECRET = "too-short";

    try {
      const { getConfig, ConfigError } = await import("../src/config/index.js");
      expect(() => getConfig()).toThrow(ConfigError);
    } finally {
      process.env.JWT_ACCESS_SECRET = prevAccess ?? STRONG_ACCESS_SECRET;
      process.env.JWT_REFRESH_SECRET = prevRefresh ?? STRONG_REFRESH_SECRET;
      vi.resetModules();
    }
  });
});

describe("jwt config adoption", () => {
  let jwtLib: typeof import("../src/lib/jwt.js");

  beforeAll(async () => {
    vi.resetModules();
    jwtLib = await import("../src/lib/jwt.js");
  });

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
