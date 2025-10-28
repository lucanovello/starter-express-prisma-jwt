import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

const envPath =
  process.env.TEST_ENV_FILE ??
  process.env.TEST_ENV_PATH ??
  ".env.test";

loadEnv({ path: resolve(process.cwd(), envPath) });

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/postgres_test?schema=public";
delete process.env.RATE_LIMIT_REDIS_URL;

export function assertSafeTestDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set for tests. Provide a safe test database URL.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `DATABASE_URL is not a valid URL. Value: ${databaseUrl}. Reason: ${reason}`,
    );
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const databaseName = parsedUrl.pathname.replace(/^\//, "");

  if (!allowedHosts.has(parsedUrl.hostname)) {
    throw new Error(
      `DATABASE_URL host must be localhost/127.0.0.1/::1 for tests. Received: ${parsedUrl.hostname}`,
    );
  }

  if (!databaseName.toLowerCase().endsWith("_test")) {
    throw new Error(
      `DATABASE_URL database name must end with _test. Received: ${databaseName}`,
    );
  }
}

assertSafeTestDatabaseUrl(process.env.DATABASE_URL);

process.env.JWT_ACCESS_SECRET ??= "0123456789abcdef0123456789abcdef";
process.env.JWT_REFRESH_SECRET ??= "fedcba9876543210fedcba9876543210";
process.env.JWT_ACCESS_EXPIRY ??= "15m";
process.env.JWT_REFRESH_EXPIRY ??= "30d";
