/**
 * Server entrypoint. Keep process boot isolated from tests.
 */
import "dotenv/config";
import { ConfigError, getConfig } from "./config/index.js";
import { getLogger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
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

  const stopSessionCleanup = scheduleSessionCleanup();

  function onSignal(sig: NodeJS.Signals) {
    logger.info({ signal: sig }, "Received signal, beginning graceful shutdown");
    beginShutdown();
    stopSessionCleanup();

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
        process.exit(0);
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

    setTimeout(() => {
      logger.error(
        { timeoutMs: GRACEFUL_TIMEOUT_MS },
        "Graceful shutdown timeout exceeded, forcing exit",
      );
      process.exit(1);
    }, GRACEFUL_TIMEOUT_MS).unref();
  }

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
