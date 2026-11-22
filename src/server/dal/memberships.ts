import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CommunityRole } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/server/auth/guards";
import type { MembershipLookup } from "@/server/auth/membership";
import { getDb } from "@/server/db/client";
import type { MembershipRole, MembershipSnapshot } from "@/server/domain/access";

/** The only Prisma delegate this module touches. */
type MembershipDb = Pick<PrismaClient, "membership">;

/**
 * Prisma-backed `MembershipLookup` for `authorizeCommunity`.
 *
 * The schema has no membership status (decision D-2): a Membership row means
 * an active member, and no row means no access. Removing a member deletes the
 * row, and because this runs on every request (nothing is stored in the JWT
 * or a shared cache), access ends on the next request.
 *
 * The client is requested only when a lookup runs, never at creation, so
 * importing this module needs no DATABASE_URL.
 */
export function createMembershipLookup(getClient: () => MembershipDb = getDb): MembershipLookup {
  return {
    async getMembership(userId, communityId) {
      const membership = await getClient().membership.findUnique({
        where: { userId_communityId: { userId, communityId } },
        select: { role: true },
      });
      return membership ? { role: membership.role, status: "ACTIVE" } satisfies MembershipSnapshot : null;
    },
  };
}

/** A community the signed-in user belongs to, with their role in it. */
export type UserCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: MembershipRole;
};

/**
 * Lists the communities `user` belongs to, sorted by name.
 *
 * `user` must come from the server session (`requireUser`), never from
 * request input. The query is scoped to that user's memberships, so other
 * users' communities can't appear.
 */
export async function listCommunitiesForUser(
  user: AuthenticatedUser,
  getClient: () => MembershipDb = getDb,
): Promise<UserCommunity[]> {
  const memberships = await getClient().membership.findMany({
    where: { userId: user.id },
    select: {
      role: true,
      community: { select: { id: true, name: true, slug: true, description: true } },
    },
    orderBy: { community: { name: "asc" } },
  });
  return memberships.map(({ role, community }) => ({ ...community, role }));
}

// Compile-time contract: Prisma's CommunityRole enum and the role type used by
// the pure access rules must stay identical. A new or renamed role in either
// place fails `tsc` here.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type MembershipRoleContract = Assert<Same<CommunityRole, MembershipRole>>;
