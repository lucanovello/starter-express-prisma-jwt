/**
 * Server entrypoint. Keep process boot isolated from tests.
 */
import "dotenv/config";
import { ConfigError, getConfig } from "./config/index.js";
import { getLogger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { registerFatalHandlers } from "./lifecycle/fatalHandlers.js";
import { beginShutdown } from "./lifecycle/state.js";

const GRACEFUL_TIMEOUT_MS = 10_000;

async function main() {
  const logger = getLogger();
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Lazy-load app so config validation errors thrown during module init are catchable here.
  const { default: app, disposeSecurity } = await import("./app.js");
  const { scheduleSessionCleanup } = await import("./jobs/sessionCleanup.js");

  const server = app.listen(port, () => {
    logger.info({ port }, "API server listening");
  });
  const cfg = getConfig();
  server.keepAliveTimeout = cfg.HTTP_SERVER_KEEPALIVE_TIMEOUT_MS;
  server.headersTimeout = cfg.HTTP_SERVER_HEADERS_TIMEOUT_MS;
  server.requestTimeout = cfg.HTTP_SERVER_REQUEST_TIMEOUT_MS;

  let stopSessionCleanup = scheduleSessionCleanup({ logger });
  let shutdownInitiated = false;
  let forceExitTimer: NodeJS.Timeout | null = null;
  let detachFatalHandlers: () => void = () => {};

  const initiateShutdown = (options: {
    exitCode: number;
    source: "signal" | "unhandledRejection" | "uncaughtException";
    detail?: unknown;
  }) => {
    if (shutdownInitiated) {
      logger.warn({ source: options.source }, "Shutdown already in progress");
      return;
    }

    shutdownInitiated = true;
    detachFatalHandlers();
    beginShutdown();
    stopSessionCleanup();
    stopSessionCleanup = () => {};

    if (options.source === "signal" && options.detail) {
      logger.info({ signal: options.detail }, "Received signal, beginning graceful shutdown");
    }

    const cleanup = async () => {
      try {
        await disposeSecurity();
      } catch (e) {
        logger.error({ err: e }, "Rate limiter disconnect error");
      }

      try {
        await prisma.$disconnect();
        logger.info("Database disconnected successfully");
      } catch (e) {
        logger.error({ err: e }, "Prisma disconnect error");
      } finally {
        if (forceExitTimer) {
          clearTimeout(forceExitTimer);
          forceExitTimer = null;
        }
        process.exit(options.exitCode);
      }
    };

    server.close((err) => {
      if (err) {
        logger.error({ err }, "Server close error");
      } else {
        logger.info("HTTP server closed");
      }
      void cleanup();
    });

    forceExitTimer = setTimeout(() => {
      logger.error(
        { timeoutMs: GRACEFUL_TIMEOUT_MS, source: options.source },
        "Graceful shutdown timeout exceeded, forcing exit",
      );
      process.exit(1);
    }, GRACEFUL_TIMEOUT_MS);
    forceExitTimer.unref();
  };

  detachFatalHandlers = registerFatalHandlers(logger, ({ reason, error }) => {
    initiateShutdown({ exitCode: 1, source: reason, detail: error });
  });

  const onSignal = (sig: NodeJS.Signals) => {
    initiateShutdown({ exitCode: 0, source: "signal", detail: sig });
  };

  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
}

main().catch((err) => {
  const logger = getLogger();
  if (err instanceof ConfigError) {
    logger.fatal({ errors: err.errors }, "Invalid configuration");
    process.exit(1);
  }
  logger.fatal({ err }, "Unhandled error during startup");
  process.exit(1);
});
