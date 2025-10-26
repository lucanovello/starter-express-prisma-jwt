import { beforeAll, beforeEach, expect, test } from "vitest";

import { prisma } from "../src/lib/prisma.js";
import { resetDb } from "./utils/db.js";

let cleanupExpiredSessions: (reference?: Date) => Promise<number>;

beforeAll(async () => {
  process.env.JWT_REFRESH_EXPIRY = "30m";
  ({ cleanupExpiredSessions } = await import("../src/jobs/sessionCleanup.js"));
});

beforeEach(async () => {
  await resetDb();
});

test("cleanup removes expired and invalid sessions", async () => {
  const user = await prisma.user.create({
    data: {
      email: `cleanup-${Date.now()}@example.com`,
      password: "hashed",
    },
  });

  const validSession = await prisma.session.create({
    data: {
      userId: user.id,
      token: "valid-token",
      valid: true,
    },
  });

  await prisma.session.create({
    data: {
      userId: user.id,
      token: "invalid-token",
      valid: false,
    },
  });

  const stale = await prisma.session.create({
    data: {
      userId: user.id,
      token: "expired-token",
      valid: true,
    },
  });

  await prisma.$executeRawUnsafe(
    `UPDATE "Session" SET "updatedAt" = NOW() - INTERVAL '2 hours' WHERE "id" = '${stale.id}'`
  );

  const removed = await cleanupExpiredSessions(new Date());
  expect(removed).toBe(2);

  const remaining = await prisma.session.findMany();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].id).toBe(validSession.id);
});
