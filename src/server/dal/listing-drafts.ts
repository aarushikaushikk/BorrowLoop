import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { ItemStatus, type ItemCategory, type ItemCondition } from "@/generated/prisma/enums";
import type { UploadedImage } from "@/lib/cloudinary";
import type { AuthenticatedUser } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import type { ListingFlagReason, ModeratedListingStatus } from "@/server/domain/listing-moderation";

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
 * RED placeholder (US-2 cycle 8): no database access yet.
 */
export async function createDraftListing(
  user: AuthenticatedUser,
  input: DraftListingInput,
  getClient: () => DraftDb = getDb,
): Promise<{ id: string } | "not_found"> {
  void user;
  void input;
  void getClient;
  return { id: "" };
}

/**
 * Publishes `user`'s draft with the edited fields, or holds it for review.
 *
 * RED placeholder (US-2 cycle 8): no database access yet.
 */
export async function publishDraftListing(
  user: AuthenticatedUser,
  input: PublishDraftInput,
  getClient: () => DraftDb = getDb,
): Promise<PublishDraftResult> {
  void user;
  void input;
  void getClient;
  return { status: ItemStatus.PUBLISHED };
}
