import { describe, expect, it, vi } from "vitest";
import { ItemCategory, ItemCondition, ItemStatus } from "@/generated/prisma/enums";
import { PROHIBITED_ITEM_CODES, SAFETY_CHECK_FAILED } from "@/lib/items/prohibited";
import type { ListingSuggestionResult } from "@/server/ai/listing-suggestion";

vi.mock("server-only", () => ({}));

import { decideListingModeration } from "./listing-moderation";

// US-2 AC: a prohibited item is flagged for admin review instead of published.
// Team decision (#7): fail closed, so a failed or skipped AI check also holds
// the listing for review. Pure function: called directly, no mocks or database.

const SUGGESTION = {
  title: "Cordless drill",
  description: "18V cordless drill with two batteries and a charger.",
  category: ItemCategory.TOOLS,
  condition: ItemCondition.GOOD,
};

describe("decideListingModeration", () => {
  it("publishes when the AI check passed and nothing is prohibited", () => {
    const result: ListingSuggestionResult = { status: "ok", suggestion: SUGGESTION, prohibited: null };

    expect(decideListingModeration(result)).toStrictEqual({
      status: ItemStatus.PUBLISHED,
      flagReason: null,
    });
  });

  it.each(PROHIBITED_ITEM_CODES)("holds the listing for review with flagReason %s", (code) => {
    const result: ListingSuggestionResult = { status: "ok", suggestion: SUGGESTION, prohibited: code };

    expect(decideListingModeration(result)).toStrictEqual({
      status: ItemStatus.PENDING_REVIEW,
      flagReason: code,
    });
  });

  it("holds the listing for review with SAFETY_CHECK_FAILED when the AI check failed", () => {
    expect(decideListingModeration({ status: "failed" })).toStrictEqual({
      status: ItemStatus.PENDING_REVIEW,
      flagReason: SAFETY_CHECK_FAILED,
    });
  });

  it("holds the listing for review with SAFETY_CHECK_FAILED when there is no AI result, so skipping the check never publishes", () => {
    expect(decideListingModeration(null)).toStrictEqual({
      status: ItemStatus.PENDING_REVIEW,
      flagReason: SAFETY_CHECK_FAILED,
    });
  });
});
