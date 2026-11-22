import "server-only";
import type { MembershipSnapshot } from "@/server/domain/access";

/**
 * Database integration boundary for community membership.
 *
 * US-1 code depends only on this interface. The real implementation (a
 * Prisma-backed data access function) belongs to the database integration
 * work coordinated with Aarushi and is not part of this module.
 *
 * Implementations must look up the membership for exactly the given user and
 * community, and return `null` when none exists.
 */
export interface MembershipLookup {
  getMembership(userId: string, communityId: string): Promise<MembershipSnapshot | null>;
}
