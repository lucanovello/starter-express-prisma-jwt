import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Logger } from "pino";

import { getEmailService, resetEmailService } from "../src/services/emailService.js";
import { getLogger, resetLogger } from "../src/lib/logger.js";

describe("Email Service", () => {
  const ORIGINAL_ENV = { ...process.env };
  let loggerInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetEmailService();
    resetLogger();
    // Mock the logger's info method to verify structured logging
    const logger = getLogger();
    loggerInfoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetEmailService();
    resetLogger();
    loggerInfoSpy?.mockRestore();
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
