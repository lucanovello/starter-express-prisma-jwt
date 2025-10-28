/**
 * Server entrypoint. Keep process boot isolated from tests.
 */
import "dotenv/config";
import { ConfigError, getConfig } from "./config/index.js";
import { prisma } from "./lib/prisma.js";
import { beginShutdown } from "./lifecycle/state.js";

const GRACEFUL_TIMEOUT_MS = 10_000;

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Lazy-load app so config validation errors thrown during module init are catchable here.
  const { default: app } = await import("./app.js");
  const { scheduleSessionCleanup } = await import("./jobs/sessionCleanup.js");

  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
  const cfg = getConfig();
  server.keepAliveTimeout = cfg.HTTP_SERVER_KEEPALIVE_TIMEOUT_MS;
  server.headersTimeout = cfg.HTTP_SERVER_HEADERS_TIMEOUT_MS;
  server.requestTimeout = cfg.HTTP_SERVER_REQUEST_TIMEOUT_MS;

  const stopSessionCleanup = scheduleSessionCleanup();

  function onSignal(sig: NodeJS.Signals) {
    console.log(`[lifecycle] received ${sig}, beginning graceful shutdown`);
    beginShutdown();
    stopSessionCleanup();

    const cleanup = async () => {
      try {
        await prisma.$disconnect();
      } catch (e) {
        console.error("[lifecycle] prisma disconnect error:", e);
      } finally {
        process.exit(0);
      }
    };

    server.close((err) => {
      if (err) console.error("[lifecycle] server close error:", err);
      void cleanup();
    });

    setTimeout(() => {
      console.error("[lifecycle] forced shutdown after timeout");
      process.exit(1);
    }, GRACEFUL_TIMEOUT_MS).unref();
  }

  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
}

main().catch((err) => {
  if (err instanceof ConfigError) {
    console.error("Invalid configuration:", err.errors);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
