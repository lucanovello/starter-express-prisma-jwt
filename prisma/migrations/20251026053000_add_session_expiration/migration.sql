-- AlterTable
ALTER TABLE "Session" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Backfill existing sessions with a 7 day TTL relative to creation time.
-- If your deployment uses a different refresh token TTL, adjust this interval accordingly.
UPDATE "Session"
SET "expiresAt" = "createdAt" + INTERVAL '7 days'
WHERE "expiresAt" IS NULL;

ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET NOT NULL;

-- Index for cleanup queries
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
