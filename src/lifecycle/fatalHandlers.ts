import type { Logger } from "pino";

type FatalEvent = {
  reason: "unhandledRejection" | "uncaughtException";
  error: unknown;
};

type ShutdownCallback = (event: FatalEvent) => void;

const toError = (value: unknown): Error => {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  if (value && typeof value === "object") {
    try {
      return new Error(JSON.stringify(value));
    } catch {
      return new Error("[non-serializable rejection]");
    }
  }
  return new Error(String(value));
};

/**
 * Registers process-level handlers for unhandled promise rejections and uncaught exceptions.
 * Ensures the provided shutdown callback is invoked at most once.
 * Returns a disposer that removes the listeners.
 */
export function registerFatalHandlers(
  logger: Logger,
  shutdown: ShutdownCallback,
): () => void {
  let handled = false;

  const handleUnhandledRejection = (reason: unknown) => {
    if (handled) return;
    handled = true;
    logger.fatal(
      {
        err: toError(reason),
        detail: reason,
      },
      "Unhandled promise rejection",
    );
    shutdown({ reason: "unhandledRejection", error: reason });
  };

  const handleUncaughtException = (error: Error) => {
    if (handled) return;
    handled = true;
    logger.fatal(
      {
        err: error,
      },
      "Uncaught exception",
    );
    shutdown({ reason: "uncaughtException", error });
  };

  process.on("unhandledRejection", handleUnhandledRejection);
  process.on("uncaughtException", handleUncaughtException);

  return () => {
    process.off("unhandledRejection", handleUnhandledRejection);
    process.off("uncaughtException", handleUncaughtException);
  };
}
