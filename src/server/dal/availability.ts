import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ItemCategory, ItemCondition } from "@/generated/prisma/enums";
import type { CalendarDate } from "@/lib/dates/calendar-date";
import type { BlockedRange } from "@/lib/validation/availability";
import type { AuthenticatedUser } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";

/** The Prisma delegates availability uses. */
export type AvailabilityDb = Pick<PrismaClient, "item" | "availability" | "$transaction">;

/** An item as shown on its detail page. No owner ID, email or other PII. */
export type ItemSummary = {
  id: string;
  communityId: string;
  title: string;
  description: string;
  category: ItemCategory;
  condition: ItemCondition;
};

/** A blocked range as any member sees it: dates only. */
export type AvailabilityBlock = { id: string; startDate: CalendarDate; endDate: CalendarDate };

/** A blocked range as its item's owner sees it, with the private note. */
export type OwnerAvailabilityBlock = AvailabilityBlock & { note: string | null };

export type ItemAvailabilityView =
  | { viewer: "owner"; item: ItemSummary; blocks: OwnerAvailabilityBlock[] }
  | { viewer: "member"; item: ItemSummary; blocks: AvailabilityBlock[] };

/**
 * Loads a PUBLISHED item and its current blocked ranges for `user`, or `null`
 * when it isn't visible to them.
 *
 * RED placeholder (cycle 2).
 */
export async function getItemAvailability(
  user: AuthenticatedUser,
  input: { communityId: string; itemId: string },
  today: CalendarDate,
  getClient: () => AvailabilityDb = getDb,
): Promise<ItemAvailabilityView | null> {
  void user;
  void input;
  void today;
  void getClient;
  return null;
}

/**
 * Adds a blocked range to `user`'s own PUBLISHED item.
 *
 * RED placeholder (cycle 2): fails closed.
 */
export async function addBlockedRange(
  user: AuthenticatedUser,
  input: { communityId: string; itemId: string; range: BlockedRange },
  getClient: () => AvailabilityDb = getDb,
): Promise<{ id: string } | "not_found"> {
  void user;
  void input;
  void getClient;
  return "not_found";
}

/**
 * Removes one blocked range from `user`'s own PUBLISHED item.
 *
 * RED placeholder (cycle 2): fails closed.
 */
export async function removeBlockedRange(
  user: AuthenticatedUser,
  input: { communityId: string; availabilityId: string },
  getClient: () => AvailabilityDb = getDb,
): Promise<"removed" | "not_found"> {
  void user;
  void input;
  void getClient;
  return "not_found";
}
