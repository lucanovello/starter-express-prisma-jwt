import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getEmailService, resetEmailService } from "../src/services/emailService.js";

describe("Email Service", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    resetEmailService();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetEmailService();
  });

  test("uses console fallback when SMTP is not configured", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const service = getEmailService();

    expect(service).toBeDefined();
    expect(consoleSpy).not.toHaveBeenCalled(); // Not called until we send an email

    consoleSpy.mockRestore();
  });

  test("console service logs verification emails", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const service = getEmailService();
    await service.sendVerificationEmail("test@example.com", "test-token-123");

    expect(consoleSpy).toHaveBeenCalled();
    const calls = consoleSpy.mock.calls.flat().join("\n");
    expect(calls).toContain("test@example.com");
    expect(calls).toContain("test-token-123");
    expect(calls).toContain("Verification");

    consoleSpy.mockRestore();
  });

  test("console service logs password reset emails", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const service = getEmailService();
    await service.sendPasswordResetEmail("user@example.com", "reset-token-456");

    expect(consoleSpy).toHaveBeenCalled();
    const calls = consoleSpy.mock.calls.flat().join("\n");
    expect(calls).toContain("user@example.com");
    expect(calls).toContain("reset-token-456");
    expect(calls).toContain("Password Reset");

    consoleSpy.mockRestore();
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
