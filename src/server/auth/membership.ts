import "server-only";
import type { MembershipSnapshot } from "@/server/domain/access";

/**
 * Database integration boundary for community membership.
 *
 * Authorization code depends only on this interface, so the guards stay
 * testable with fakes. The Prisma-backed implementation is
 * `createMembershipLookup` in `src/server/dal/memberships.ts`.
 *
 * Implementations must look up the membership for exactly the given user and
 * community, and return `null` when none exists.
 */
export interface MembershipLookup {
  getMembership(userId: string, communityId: string): Promise<MembershipSnapshot | null>;
}
