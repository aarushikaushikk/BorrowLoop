import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma";

declare global {
  // Survives Next.js dev hot reloads so edits don't open a new connection pool
  // each time. `var` is required for a global declaration.
  var borrowLoopPrisma: PrismaClient | undefined;
}

/**
 * Returns the process-wide Prisma client, creating it on first use.
 *
 * Lazy on purpose: importing this module never reads `DATABASE_URL` or opens a
 * connection, so builds and pages that don't touch the database (including CI
 * builds without database variables) keep working. The first call throws if
 * `DATABASE_URL` is not set.
 */
export function getDb(): PrismaClient {
  globalThis.borrowLoopPrisma ??= createPrismaClient();
  return globalThis.borrowLoopPrisma;
}
