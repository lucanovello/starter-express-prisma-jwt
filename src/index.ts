/**
 * Server entrypoint. Keep process boot isolated from tests.
 */
import "dotenv/config";
import { beginShutdown } from "./lifecycle/state.js";
import { prisma } from "./lib/prisma.js";
import app from "./app.js";

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Capture the server so we can close it on signals.
const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

/**
 * Begin graceful shutdown:
 * - Stop accepting new connections.
 * - Let inflight requests finish up to a safety timeout.
 * - Disconnect Prisma and exit.
 */

const GRACEFUL_TIMEOUT_MS = 10_000;

function onSignal(sig: NodeJS.Signals) {
  console.log(`[lifecycle] received ${sig}, beginning graceful shutdown`);
  beginShutdown();

  // Stop accepting new connections; keep existing ones until they complete.
  server.close(async (err) => {
    if (err) {
      console.error("[lifecycle] server close error:", err);
    }
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.error("[lifecycle] prisma disconnect error:", e);
    } finally {
      process.exit(0);
    }
  });

  // Force exit if things hang.
  setTimeout(() => {
    console.error("[lifecycle] forced shutdown after timeout");
    process.exit(1);
  }, GRACEFUL_TIMEOUT_MS).unref();
}

process.on("SIGTERM", onSignal);
process.on("SIGINT", onSignal);
