import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { CommunityRole } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/server/auth/guards";
import type { MembershipLookup } from "@/server/auth/membership";
import { getDb } from "@/server/db/client";
import type { MembershipRole, MembershipSnapshot } from "@/server/domain/access";

/** The Prisma delegates membership reads use. */
type MembershipDb = Pick<PrismaClient, "membership">;
/** Discovery and joining also read communities. */
type CommunityMembershipDb = Pick<PrismaClient, "membership" | "community">;

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

/**
 * The community `user` administers, or `null` when it doesn't exist or `user`
 * isn't an ADMIN of it. Scoped in the query by the session user's ID and the
 * ADMIN role, as defence in depth behind `getCommunityAccess(level: "admin")`.
 */
export async function getAdministeredCommunity(
  user: AuthenticatedUser,
  communityId: string,
  getClient: () => MembershipDb = getDb,
): Promise<{ id: string; name: string } | null> {
  const membership = await getClient().membership.findFirst({
    where: { userId: user.id, communityId, role: "ADMIN" },
    select: { community: { select: { id: true, name: true } } },
  });
  return membership?.community ?? null;
}

/** A community open to join: only what the Discover list needs. */
export type JoinableCommunity = { id: string; name: string; description: string | null };

/**
 * Communities `user` hasn't joined, sorted by name.
 *
 * Communities are open in v1 (decision D-1): any signed-in user may discover
 * and join any community. Only the name and description are exposed, never
 * members, roles, or listings.
 */
export async function listJoinableCommunities(
  user: AuthenticatedUser,
  getClient: () => CommunityMembershipDb = getDb,
): Promise<JoinableCommunity[]> {
  return getClient().community.findMany({
    where: { memberships: { none: { userId: user.id } } },
    select: { id: true, name: true, description: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export type JoinCommunityResult = "joined" | "already_member" | "not_found";

/** Prisma's error code for a foreign key violation. */
const FOREIGN_KEY_VIOLATION = "P2003";

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === FOREIGN_KEY_VIOLATION;
}

/**
 * Adds `user` to a community as a MEMBER.
 *
 * - `user` must come from the server session; the role is always MEMBER.
 * - A missing community creates nothing (`not_found`).
 * - The insert is `INSERT … ON CONFLICT DO NOTHING` on the (userId,
 *   communityId) unique key (`skipDuplicates`), so duplicate or concurrent
 *   joins can't create a second row or fail, and an existing membership,
 *   including an ADMIN one, is never modified (`already_member`).
 * - If the community is deleted between the check and the insert, the foreign
 *   key rejects the row and the result is `not_found`.
 */
export async function joinCommunityAsMember(
  user: AuthenticatedUser,
  communityId: string,
  getClient: () => CommunityMembershipDb = getDb,
): Promise<JoinCommunityResult> {
  const db = getClient();
  const community = await db.community.findUnique({ where: { id: communityId }, select: { id: true } });
  if (!community) {
    return "not_found";
  }
  try {
    const { count } = await db.membership.createMany({
      data: [{ userId: user.id, communityId: community.id, role: "MEMBER" }],
      skipDuplicates: true,
    });
    return count === 1 ? "joined" : "already_member";
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return "not_found";
    }
    throw error;
  }
}

// Compile-time contract: Prisma's CommunityRole enum and the role type used by
// the pure access rules must stay identical. A new or renamed role in either
// place fails `tsc` here.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type MembershipRoleContract = Assert<Same<CommunityRole, MembershipRole>>;
