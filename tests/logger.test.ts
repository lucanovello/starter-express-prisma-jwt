import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { getLogger, resetLogger } from "../src/lib/logger.js";

describe("Logger", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    resetLogger();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetLogger();
  });

  test("returns a logger instance", () => {
    const logger = getLogger();

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  test("returns same instance on subsequent calls (singleton)", () => {
    const logger1 = getLogger();
    const logger2 = getLogger();

    expect(logger1).toBe(logger2);
  });

  test("creates new instance after reset", () => {
    const logger1 = getLogger();
    resetLogger();
    const logger2 = getLogger();

    // Different instances
    expect(logger1).not.toBe(logger2);
  });

  test("respects LOG_LEVEL environment variable", () => {
    process.env.LOG_LEVEL = "error";
    resetLogger();

    const logger = getLogger();

    // Pino logger should have the level set
    expect(logger.level).toBe("error");
  });

  test("defaults to info level when LOG_LEVEL not set", () => {
    delete process.env.LOG_LEVEL;
    resetLogger();

    const logger = getLogger();

    expect(logger.level).toBe("info");
  });
});
