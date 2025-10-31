/**
 * Shared Pino logger instance for application-wide structured logging.
 * This logger is separate from the HTTP request logger (pino-http) and is used
 * for lifecycle events, background jobs, and service-level logging.
 */
import pino from "pino";

import { getConfig } from "../config/index.js";

let loggerInstance: pino.Logger | null = null;

/**
 * Get or create the application logger instance.
 * Returns a Pino logger configured based on NODE_ENV.
 * - Production: JSON output
 * - Development: Pretty-printed with pino-pretty
 */
export function getLogger(): pino.Logger {
  if (loggerInstance) {
    return loggerInstance;
  }

  const cfg = getConfig();

  const baseOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  loggerInstance = pino(
    cfg.NODE_ENV === "production"
      ? baseOptions
      : { ...baseOptions, transport: { target: "pino-pretty" } },
  );

  return loggerInstance;
}

/**
 * Reset the logger instance. Used for testing.
 * @internal
 */
export function resetLogger(): void {
  loggerInstance = null;
}
