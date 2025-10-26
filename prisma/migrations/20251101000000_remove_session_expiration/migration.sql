-- Remove legacy session expiration column in favor of TTL derived from config.
DROP INDEX IF EXISTS "Session_expiresAt_idx";

ALTER TABLE "Session" DROP COLUMN IF EXISTS "expiresAt";
