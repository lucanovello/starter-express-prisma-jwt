import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { resetConfigCache } from "../src/config/index.js";
import { getLogger, resetLogger } from "../src/lib/logger.js";

describe("Logger", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    resetLogger();
    resetConfigCache();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetLogger();
    resetConfigCache();
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

    expect(logger1).not.toBe(logger2);
  });

  test("uses validated LOG_LEVEL from config", () => {
    process.env.LOG_LEVEL = "error";
    resetLogger();
    resetConfigCache();

    const logger = getLogger();

    expect(logger.level).toBe("error");
  });

  test("defaults to info level when LOG_LEVEL not set", () => {
    delete process.env.LOG_LEVEL;
    resetLogger();
    resetConfigCache();

    const logger = getLogger();

    expect(logger.level).toBe("info");
  });

  test("rejects invalid LOG_LEVEL via config validation", () => {
    process.env.LOG_LEVEL = "invalid-level";
    resetLogger();
    resetConfigCache();

    expect(() => getLogger()).toThrow();
  });
});
