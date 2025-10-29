-- Introduce user roles for authorization checks
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'USER';
