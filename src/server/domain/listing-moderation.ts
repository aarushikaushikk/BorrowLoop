import "server-only";
import { ItemStatus } from "@/generated/prisma/enums";
import { SAFETY_CHECK_FAILED, type ProhibitedItemCode } from "@/lib/items/prohibited";
import type { ListingSuggestionResult } from "@/server/ai/listing-suggestion";

// Pure listing moderation rules (US-2 / US-8). No I/O and no Prisma client, so
// they can be unit tested directly.

export type ListingFlagReason = ProhibitedItemCode | typeof SAFETY_CHECK_FAILED;

/**
 * The statuses moderation can assign to a new listing. DRAFT and ARCHIVED are
 * excluded by the type, so they can't be returned by mistake.
 */
export type ModeratedListingStatus = typeof ItemStatus.PUBLISHED | typeof ItemStatus.PENDING_REVIEW;

export type ListingModeration = {
  status: ModeratedListingStatus;
  flagReason: ListingFlagReason | null;
};

/**
 * Decides the status a new listing is saved with, from the AI check's result
 * (`null` when there is no AI result at all).
 *
 * Fails closed: only a successful check with nothing prohibited publishes.
 * A prohibited code holds the listing for review with that code; a failed or
 * missing check holds it with SAFETY_CHECK_FAILED.
 */
export function decideListingModeration(result: ListingSuggestionResult | null): ListingModeration {
  if (result === null || result.status === "failed") {
    return { status: ItemStatus.PENDING_REVIEW, flagReason: SAFETY_CHECK_FAILED };
  }
  if (result.prohibited !== null) {
    return { status: ItemStatus.PENDING_REVIEW, flagReason: result.prohibited };
  }
  return { status: ItemStatus.PUBLISHED, flagReason: null };
}
