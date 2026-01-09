// Centralized Prisma client (prevents creating multiple instances during hot-reload)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const prismaPool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaPool = prismaPool;
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaPg(prismaPool) });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
