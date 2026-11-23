import "server-only";
import { ItemStatus } from "@/generated/prisma/enums";
import type { ProhibitedItemCode, SAFETY_CHECK_FAILED } from "@/lib/items/prohibited";
import type { ListingSuggestionResult } from "@/server/ai/listing-suggestion";

// Pure listing moderation rules (US-2 / US-8). No I/O and no Prisma client, so
// they can be unit tested directly.

export type ListingFlagReason = ProhibitedItemCode | typeof SAFETY_CHECK_FAILED;

export type ListingModeration = {
  status: ItemStatus;
  flagReason: ListingFlagReason | null;
};

/**
 * Decides the status a new listing is saved with, from the AI check's result
 * (`null` when there is no AI result at all).
 *
 * RED placeholder (US-2 cycle 7): returns DRAFT, which is never a correct
 * answer here, so every case fails on an assertion.
 */
export function decideListingModeration(result: ListingSuggestionResult | null): ListingModeration {
  void result;
  return { status: ItemStatus.DRAFT, flagReason: null };
}
