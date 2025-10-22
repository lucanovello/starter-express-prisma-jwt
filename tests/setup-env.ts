import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/postgres?schema=public";
process.env.JWT_ACCESS_SECRET ??= "test_access_secret";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret";
process.env.JWT_ACCESS_EXPIRY ??= "15m";
process.env.JWT_REFRESH_EXPIRY ??= "30d";
