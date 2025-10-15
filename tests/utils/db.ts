/**
 * Test utility: reset the database to a clean state.
 * WHY: Integration tests should not leak state across runs.
 */
import { prisma } from "../../src/lib/prisma.js";

/**
 * Truncate known tables and reset identity counters.
 * NOTE: quoted names match Prisma's generated table names.
 */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Session","User" RESTART IDENTITY CASCADE;'
  );
}
