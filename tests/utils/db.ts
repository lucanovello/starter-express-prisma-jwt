/**
 * Test utility helpers for preparing the Postgres database.
 */
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Pool } from "pg";

import { prisma } from "../../src/lib/prisma.js";

const execFileAsync = promisify(execFile);

let ensureDbPromise: Promise<void> | null = null;
let resetQueue: Promise<void> = Promise.resolve();

const prismaCliPath = fileURLToPath(
  new URL("../../node_modules/prisma/build/index.js", import.meta.url),
);

const runPrismaCommand = async (args: string[], env: NodeJS.ProcessEnv) => {
  await execFileAsync(process.execPath, [prismaCliPath, ...args], {
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
};

const quoteIdent = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

const getAdminPool = (dbUrl: string): Pool => {
  const adminUrl = new URL(dbUrl);
  adminUrl.pathname = "/postgres";
  return new Pool({ connectionString: adminUrl.toString() });
};

const databaseExists = async (admin: Pool, name: string): Promise<boolean> => {
  const result = await admin.query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS "exists";',
    [name],
  );
  return result.rows[0]?.exists === true;
};

const createDatabase = async (admin: Pool, name: string) => {
  await admin.query(`CREATE DATABASE ${quoteIdent(name)}`);
};

const terminateConnections = (admin: Pool, name: string) =>
  admin.query(
    "\n    SELECT pg_terminate_backend(pid)\n    FROM pg_stat_activity\n    WHERE datname = $1 AND pid <> pg_backend_pid();\n  ",
    [name],
  );

const dropDatabase = async (admin: Pool, name: string) => {
  if (await databaseExists(admin, name)) {
    await terminateConnections(admin, name);
    await admin.query(`DROP DATABASE ${quoteIdent(name)}`);
  }
};

const shouldRetryMigrate = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err);
  return /P3009|P3018|failed migrations/i.test(message);
};

async function ensureDatabase(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set; cannot prepare test database");
  }

  const url = new URL(dbUrl);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("DATABASE_URL is missing a database name");
  }

  const admin = getAdminPool(dbUrl);
  try {
    if (!(await databaseExists(admin, dbName))) {
      await createDatabase(admin, dbName);
    }
  } finally {
    await admin.end();
  }

  const runMigrate = () =>
    runPrismaCommand(["migrate", "deploy"], {
      ...process.env,
      DATABASE_URL: dbUrl,
    });

  try {
    await runMigrate();
  } catch (err) {
    if (!shouldRetryMigrate(err)) {
      throw err;
    }

    const adminRetry = getAdminPool(dbUrl);
    try {
      await prisma.$disconnect().catch(() => undefined);
      await dropDatabase(adminRetry, dbName);
      await createDatabase(adminRetry, dbName);
    } finally {
      await adminRetry.end();
    }

    await runMigrate();
  }

  await prisma.$connect().catch(() => undefined);
}

async function ensureDatabaseReady(): Promise<void> {
  if (!ensureDbPromise) {
    ensureDbPromise = ensureDatabase().catch((err) => {
      ensureDbPromise = null;
      throw err;
    });
  }
  return ensureDbPromise;
}

/**
 * Truncate known tables and reset identity counters.
 * NOTE: quoted names match Prisma's generated table names.
 */
export async function resetDb() {
  const run = async () => {
    await ensureDatabaseReady();
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "LoginAttempt","PasswordResetToken","VerificationToken","Session","User" RESTART IDENTITY CASCADE;',
    );
  };

  const next = resetQueue.then(run, run);
  resetQueue = next.catch(() => undefined);
  return next;
}
