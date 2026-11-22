import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ItemCategory, ItemCondition } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";

type ListingsDb = Pick<PrismaClient, "community">;

/** A listing as shown to community members. No owner email or other PII. */
export type CommunityListing = {
  id: string;
  title: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
};

export type CommunityWithListings = {
  id: string;
  name: string;
  description: string | null;
  listings: CommunityListing[];
};

/**
 * Loads a community and its visible listings for `user`, or `null` when the
 * community doesn't exist or `user` isn't a member.
 *
 * Callers must already have authorized the request (`getCommunityAccess`).
 * This query scopes again on its own, in the database, as defence in depth:
 * - the community must have a membership for `user.id` (from the session), and
 * - items come only through that community's relation, so items from any
 *   other community can't be returned.
 *
 * Only PUBLISHED items are visible. DRAFT isn't published yet,
 * PENDING_REVIEW is held for admin review, and ARCHIVED is retired.
 */
export async function getCommunityWithListings(
  user: AuthenticatedUser,
  communityId: string,
  getClient: () => ListingsDb = getDb,
): Promise<CommunityWithListings | null> {
  const community = await getClient().community.findFirst({
    where: { id: communityId, memberships: { some: { userId: user.id } } },
    select: {
      id: true,
      name: true,
      description: true,
      items: {
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, description: true, category: true, condition: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      },
    },
  });
  if (!community) {
    return null;
  }
  const { items, ...rest } = community;
  return { ...rest, listings: items };
}
