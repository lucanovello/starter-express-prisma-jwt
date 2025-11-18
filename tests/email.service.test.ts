import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Logger } from "pino";

import { getEmailService, resetEmailService } from "../src/services/emailService.js";
import { getLogger, resetLogger } from "../src/lib/logger.js";
import { resetConfigCache } from "../src/config/index.js";

describe("Email Service", () => {
  const ORIGINAL_ENV = { ...process.env };
  let loggerInfoSpy: ReturnType<typeof vi.spyOn>;
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetEmailService();
    resetLogger();
    resetConfigCache();
    // Mock the logger's info method to verify structured logging
    const logger = getLogger();
    loggerInfoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    loggerWarnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetEmailService();
    resetLogger();
    resetConfigCache();
    loggerInfoSpy?.mockRestore();
    loggerWarnSpy?.mockRestore();
  });

  test("uses console fallback when SMTP is not configured", () => {
    const service = getEmailService();
    expect(service).toBeDefined();
    expect(loggerInfoSpy).not.toHaveBeenCalled(); // Not called until we send an email
  });

  test("console service logs verification emails with structured data", async () => {
    const service = getEmailService();
    await service.sendVerificationEmail("test@example.com", "test-token-123");

    expect(loggerInfoSpy).toHaveBeenCalled();
    // Check that structured logging was used with proper fields
    const firstCall = loggerInfoSpy.mock.calls[0];
    expect(firstCall[0]).toMatchObject({
      emailType: "verification",
      recipient: "test@example.com",
      tokenLength: 14,
    });
    expect(firstCall[1]).toContain("Verification");
  });

  test("console service logs password reset emails with structured data", async () => {
    const service = getEmailService();
    await service.sendPasswordResetEmail("user@example.com", "reset-token-456");

    expect(loggerInfoSpy).toHaveBeenCalled();
    // Check that structured logging was used with proper fields
    const firstCall = loggerInfoSpy.mock.calls[0];
    expect(firstCall[0]).toMatchObject({
      emailType: "password-reset",
      recipient: "user@example.com",
      tokenLength: 15,
    });
    expect(firstCall[1]).toContain("Password reset");
  });

  test("console service redacts tokens when NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://app.example.com";
    process.env.RATE_LIMIT_REDIS_URL = "redis://cache:6379";
    process.env.JWT_ACCESS_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    resetConfigCache();
    resetEmailService();

    const service = getEmailService();
    loggerInfoSpy.mockClear();
    loggerWarnSpy.mockClear();

    const token = "prod-token-789";
    await service.sendPasswordResetEmail("prod@example.com", token);

    expect(loggerWarnSpy).toHaveBeenCalled();
    // No logged argument should contain the raw token string
    const includesToken = [...loggerInfoSpy.mock.calls, ...loggerWarnSpy.mock.calls].some((call) =>
      call.some((arg: string | string[]) => {
        if (typeof arg === "string") return arg.includes(token);
        if (arg && typeof arg === "object") {
          try {
            return JSON.stringify(arg).includes(token);
          } catch {
            return false;
          }
        }
        return false;
      }),
    );
    expect(includesToken).toBe(false);

    const metaCall = loggerInfoSpy.mock.calls.find(
      (call: { emailType: string }[]) => call[0]?.emailType === "password-reset",
    );
    expect(metaCall?.[0]).toMatchObject({
      emailType: "password-reset",
      tokenLength: token.length,
    });
  });

  test("returns same instance on subsequent calls (singleton)", () => {
    const service1 = getEmailService();
    const service2 = getEmailService();

    expect(service1).toBe(service2);
  });

  test("creates new instance after reset", () => {
    const service1 = getEmailService();
    resetEmailService();
    const service2 = getEmailService();

    expect(service1).not.toBe(service2);
  });
});
