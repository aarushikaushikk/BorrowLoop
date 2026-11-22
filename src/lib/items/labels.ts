import type { ItemCategory, ItemCondition } from "@/generated/prisma/enums";

// Display labels for item enums. `satisfies` makes `tsc` fail if a category or
// condition is added to the schema without a label.

export const ITEM_CATEGORY_LABELS = {
  TOOLS: "Tools",
  ELECTRONICS: "Electronics",
  KITCHEN: "Kitchen",
  OUTDOOR: "Outdoor",
  SPORTS: "Sports",
  BOOKS: "Books",
  GAMES: "Games",
  PARTY: "Party",
  BABY_KIDS: "Baby & kids",
  OTHER: "Other",
} as const satisfies Record<ItemCategory, string>;

export const ITEM_CONDITION_LABELS = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
} as const satisfies Record<ItemCondition, string>;
