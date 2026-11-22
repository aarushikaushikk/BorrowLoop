import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "./prisma";

// One PrismaClient per process. In dev, Next.js hot reload re-evaluates
// modules, so we cache the client on globalThis to avoid opening a new
// connection pool on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
