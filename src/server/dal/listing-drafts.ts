import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { ItemStatus, type ItemCategory, type ItemCondition } from "@/generated/prisma/enums";
import type { UploadedImage } from "@/lib/cloudinary";
import type { AuthenticatedUser } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import {
  statusForFlagReason,
  type ListingFlagReason,
  type ModeratedListingStatus,
} from "@/server/domain/listing-moderation";

/** The Prisma delegates draft listings use. */
type DraftDb = Pick<PrismaClient, "item" | "membership" | "$transaction">;

/** What the analyze step stores as a draft. `ownerId` is never part of it. */
export type DraftListingInput = {
  communityId: string;
  title: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
  flagReason: ListingFlagReason | null;
  photo: UploadedImage;
};

/** The lender's edited fields from the listing form. */
export type PublishDraftInput = {
  itemId: string;
  title: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
};

export type PublishDraftResult = { status: ModeratedListingStatus } | "not_found";

/**
 * Saves a DRAFT listing with its first photo for `user`, or returns
 * "not_found" when `user` isn't a member of the community.
 *
 * - `user` must come from the server session. `ownerId` is always `user.id`
 *   and the status is always DRAFT; only the named input fields are read, so
 *   extra fields such as `ownerId` or `status` are ignored.
 * - The membership check and the create run in one transaction, as defence in
 *   depth behind the caller's own access check.
 */
export async function createDraftListing(
  user: AuthenticatedUser,
  input: DraftListingInput,
  getClient: () => DraftDb = getDb,
): Promise<{ id: string } | "not_found"> {
  return getClient().$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { userId_communityId: { userId: user.id, communityId: input.communityId } },
      select: { id: true },
    });
    if (!membership) {
      return "not_found" as const;
    }

    return tx.item.create({
      data: {
        ownerId: user.id,
        communityId: input.communityId,
        title: input.title,
        description: input.description,
        category: input.category,
        condition: input.condition,
        status: ItemStatus.DRAFT,
        flagReason: input.flagReason,
        photos: {
          create: {
            url: input.photo.url,
            publicId: input.photo.publicId,
            width: input.photo.width,
            height: input.photo.height,
            position: 0,
          },
        },
      },
      select: { id: true },
    });
  });
}

/**
 * Publishes `user`'s draft with the edited fields, or holds it for review.
 * Returns "not_found" when no draft matches the scope.
 *
 * - Both queries are scoped to the draft id, `user` as owner, DRAFT status, and
 *   `user`'s membership of the item's community. Another user's draft, a draft
 *   that's already published, and a removed member all simply don't match.
 * - The status comes from the flagReason stored on the draft, never from input,
 *   and only the four edited fields plus that status are written.
 * - `updateMany` reports a count instead of throwing, so a draft that stops
 *   matching between the read and the update also gives "not_found".
 */
export async function publishDraftListing(
  user: AuthenticatedUser,
  input: PublishDraftInput,
  getClient: () => DraftDb = getDb,
): Promise<PublishDraftResult> {
  const where = {
    id: input.itemId,
    ownerId: user.id,
    status: ItemStatus.DRAFT,
    community: { memberships: { some: { userId: user.id } } },
  };
  const db = getClient();

  const draft = await db.item.findFirst({ where, select: { flagReason: true } });
  if (!draft) {
    return "not_found";
  }

  const status = statusForFlagReason(draft.flagReason);
  const { count } = await db.item.updateMany({
    where,
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      condition: input.condition,
      status,
    },
  });
  if (count === 0) {
    return "not_found";
  }
  return { status };
}
