/**
 * Server entrypoint. Keep process boot isolated from tests.
 */
import "dotenv/config";
import { beginShutdown } from "./lifecycle/state.js";
import { prisma } from "./lib/prisma.js";
import { ConfigError } from "./config/index.js";

const GRACEFUL_TIMEOUT_MS = 10_000;

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Lazy-load app so config validation errors thrown during module init are catchable here.
  const { default: app } = await import("./app.js");

  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });

  function onSignal(sig: NodeJS.Signals) {
    console.log(`[lifecycle] received ${sig}, beginning graceful shutdown`);
    beginShutdown();

    server.close(async (err) => {
      if (err) console.error("[lifecycle] server close error:", err);
      try {
        await prisma.$disconnect();
      } catch (e) {
        console.error("[lifecycle] prisma disconnect error:", e);
      } finally {
        process.exit(0);
      }
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
