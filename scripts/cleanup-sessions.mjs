import "dotenv/config";

import { cleanupExpiredSessions } from "../src/jobs/sessionCleanup.js";
import { prisma } from "../src/lib/prisma.js";

try {
  const removed = await cleanupExpiredSessions();
  console.log(`[sessionCleanup] removed ${removed} expired/invalid session(s)`);
} catch (err) {
  console.error("[sessionCleanup] failed", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
