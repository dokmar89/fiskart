import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/lib/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one client across hot reloads in development, or each reload opens a new connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * Prisma's Json input type wants an index signature our typed JSON shapes do not declare. Values
 * passed here are plain JSON (parsed request bodies or literals), so the cast loses nothing.
 */
export function asJson<T extends object>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
