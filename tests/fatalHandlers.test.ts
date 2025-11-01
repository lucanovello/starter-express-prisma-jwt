import { afterEach, describe, expect, test, vi } from "vitest";

import { registerFatalHandlers } from "../src/lifecycle/fatalHandlers.js";

describe("registerFatalHandlers", () => {
  const ORIGINAL_LISTENERS = {
    unhandledRejection: process.listeners("unhandledRejection"),
    uncaughtException: process.listeners("uncaughtException"),
  };

  afterEach(() => {
    for (const listener of process.listeners("unhandledRejection")) {
      if (!ORIGINAL_LISTENERS.unhandledRejection.includes(listener)) {
        process.off("unhandledRejection", listener);
      }
    }
    for (const listener of process.listeners("uncaughtException")) {
      if (!ORIGINAL_LISTENERS.uncaughtException.includes(listener)) {
        process.off("uncaughtException", listener);
      }
    }
    vi.restoreAllMocks();
  });

  test("invokes shutdown on first unhandled rejection and logs fatal error", () => {
    const logger = { fatal: vi.fn() } as unknown as import("pino").Logger;
    const shutdown = vi.fn();

    const detach = registerFatalHandlers(logger, shutdown);

    const rejection = new Error("boom");
    const dispatched = process.emit("unhandledRejection", rejection, Promise.resolve());
    expect(dispatched).toBe(true);

    expect(logger.fatal).toHaveBeenCalledTimes(1);
    const [meta, message] = logger.fatal.mock.calls[0]!;
    expect(message).toMatch(/Unhandled promise rejection/);
    expect(meta.err).toBe(rejection);
    expect(shutdown).toHaveBeenCalledWith({
      reason: "unhandledRejection",
      error: rejection,
    });

    // Second fatal event should be ignored
    process.emit("uncaughtException", new Error("secondary"));
    expect(logger.fatal).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledTimes(1);

    detach();
  });

  test("detacher removes listeners", () => {
    const logger = { fatal: vi.fn() } as unknown as import("pino").Logger;
    const shutdown = vi.fn();

    const originalExceptionHandlers = [...process.listeners("uncaughtException")];
    const originalRejectionHandlers = [...process.listeners("unhandledRejection")];

    const detach = registerFatalHandlers(logger, shutdown);
    detach();

    expect(process.listeners("uncaughtException")).toEqual(originalExceptionHandlers);
    expect(process.listeners("unhandledRejection")).toEqual(originalRejectionHandlers);
    expect(logger.fatal).not.toHaveBeenCalled();
    expect(shutdown).not.toHaveBeenCalled();
  });
});
