import { afterEach, expect, test } from "vitest";
import { assertSafeTestDatabaseUrl } from "./setup-env.js";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

test("guard rejects production-like database url", () => {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@prod-db.internal:5432/app?schema=public";

  expect(() =>
    assertSafeTestDatabaseUrl(process.env.DATABASE_URL),
  ).toThrowError(/host must be localhost/i);
});
