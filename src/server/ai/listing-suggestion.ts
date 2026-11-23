import "server-only";
import type { ItemCategory, ItemCondition } from "@/generated/prisma/enums";
import type { ProhibitedItemCode } from "@/lib/items/prohibited";
import type { AllowedImageMime } from "@/server/images/validate-upload";

/** Editable listing fields Claude suggests from a photo (US-2). */
export type ListingSuggestion = {
  title: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
};

export type ListingSuggestionResult =
  | { status: "ok"; suggestion: ListingSuggestion; prohibited: ProhibitedItemCode | null }
  | { status: "failed" };

/**
 * Asks Claude for listing fields from an already-validated photo.
 *
 * RED placeholder (US-2 cycle 3): no logic yet.
 */
export async function suggestListing(photo: {
  bytes: Uint8Array;
  mime: AllowedImageMime;
}): Promise<ListingSuggestionResult> {
  void photo;
  return { status: "failed" };
}
