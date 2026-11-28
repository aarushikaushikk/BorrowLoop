import "server-only";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { ItemStatus, type ItemCategory, type ItemCondition } from "@/generated/prisma/enums";
import { fromDbDate, toDbDate, type CalendarDate } from "@/lib/dates/calendar-date";
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
 * - Scoped in the query: the item must be PUBLISHED, in `communityId`, and
 *   that community must have a membership for `user.id` (from the session).
 *   Other communities' items, drafts and removed members all give `null`.
 * - Only blocks that haven't ended (`endDate >= today`, inclusive) are
 *   returned. Ended blocks stay in the database.
 * - Overlapping blocks are separate entries, sorted by start date.
 * - The private note is returned only when `user` owns the item. The owner ID
 *   is used for that comparison and never returned.
 */
export async function getItemAvailability(
  user: AuthenticatedUser,
  input: { communityId: string; itemId: string },
  today: CalendarDate,
  getClient: () => AvailabilityDb = getDb,
): Promise<ItemAvailabilityView | null> {
  const row = await getClient().item.findFirst({
    where: {
      id: input.itemId,
      communityId: input.communityId,
      status: ItemStatus.PUBLISHED,
      community: { memberships: { some: { userId: user.id } } },
    },
    select: {
      id: true,
      communityId: true,
      title: true,
      description: true,
      category: true,
      condition: true,
      ownerId: true,
      availability: {
        where: { endDate: { gte: toDbDate(today) } },
        select: { id: true, startDate: true, endDate: true, note: true },
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!row) {
    return null;
  }

  const { ownerId, availability, ...item } = row;
  if (ownerId === user.id) {
    return {
      viewer: "owner",
      item,
      blocks: availability.map((block) => ({
        id: block.id,
        startDate: fromDbDate(block.startDate),
        endDate: fromDbDate(block.endDate),
        note: block.note,
      })),
    };
  }
  return {
    viewer: "member",
    item,
    blocks: availability.map((block) => ({
      id: block.id,
      startDate: fromDbDate(block.startDate),
      endDate: fromDbDate(block.endDate),
    })),
  };
}

/** Rows returned by the lock-and-authorize statements. Anything else fails closed. */
const lockedRowsSchema = z.array(z.object({ id: z.string() }));

// Concurrency strategy (approved 2026-11-28):
//
// Each mutation runs in one transaction that starts with a single
// `SELECT … FOR SHARE OF <item>, <membership>` statement. That statement both
// checks authorization (owner = session user, PUBLISHED, community matches,
// membership exists) and takes share locks on the rows that grant it, held
// until commit:
// - A membership removal, ownership transfer or unpublish that committed
//   first makes the statement wait, then re-check the new row versions and
//   return nothing, so the mutation is rejected.
// - One that starts later waits for the mutation to commit.
// Prisma's query API has no row-locking reads, so this one statement is a
// parameterized `Prisma.sql` template: every value is a bind parameter, and
// only fixed identifiers and the 'PUBLISHED' literal are SQL text.

/**
 * Adds a blocked range to `user`'s own PUBLISHED item.
 *
 * Returns "not_found" (and writes nothing) unless `user` owns the item, it's
 * PUBLISHED and in `communityId`, and `user` is a member of that community.
 * Admin status grants nothing here. Overlapping blocks are allowed.
 */
export async function addBlockedRange(
  user: AuthenticatedUser,
  input: { communityId: string; itemId: string; range: BlockedRange },
  getClient: () => AvailabilityDb = getDb,
): Promise<{ id: string } | "not_found"> {
  return getClient().$transaction(async (tx) => {
    const locked = lockedRowsSchema.parse(
      await tx.$queryRaw(Prisma.sql`
        SELECT i."id"
        FROM "Item" i
        JOIN "Membership" m ON m."communityId" = i."communityId" AND m."userId" = ${user.id}
        WHERE i."id" = ${input.itemId}
          AND i."communityId" = ${input.communityId}
          AND i."ownerId" = ${user.id}
          AND i."status" = 'PUBLISHED'
        FOR SHARE OF i, m
      `),
    );
    const item = locked[0];
    if (!item) {
      return "not_found" as const;
    }

    return tx.availability.create({
      data: {
        itemId: item.id,
        startDate: toDbDate(input.range.startDate),
        endDate: toDbDate(input.range.endDate),
        note: input.range.note,
      },
      select: { id: true },
    });
  });
}

/**
 * Removes one blocked range from `user`'s own PUBLISHED item.
 *
 * Returns "not_found" (and deletes nothing) unless the block belongs to an
 * item `user` owns, that's PUBLISHED and in `communityId`, and `user` is a
 * member of that community. The delete repeats that scope as defence in depth
 * on top of the row locks, and a block already removed by a concurrent request
 * (no rows affected) is also "not_found".
 */
export async function removeBlockedRange(
  user: AuthenticatedUser,
  input: { communityId: string; availabilityId: string },
  getClient: () => AvailabilityDb = getDb,
): Promise<"removed" | "not_found"> {
  return getClient().$transaction(async (tx) => {
    const locked = lockedRowsSchema.parse(
      await tx.$queryRaw(Prisma.sql`
        SELECT a."id"
        FROM "Availability" a
        JOIN "Item" i ON i."id" = a."itemId"
        JOIN "Membership" m ON m."communityId" = i."communityId" AND m."userId" = ${user.id}
        WHERE a."id" = ${input.availabilityId}
          AND i."communityId" = ${input.communityId}
          AND i."ownerId" = ${user.id}
          AND i."status" = 'PUBLISHED'
        FOR SHARE OF i, m
      `),
    );
    const block = locked[0];
    if (!block) {
      return "not_found" as const;
    }

    const { count } = await tx.availability.deleteMany({
      where: {
        id: block.id,
        item: {
          communityId: input.communityId,
          ownerId: user.id,
          status: ItemStatus.PUBLISHED,
          community: { memberships: { some: { userId: user.id } } },
        },
      },
    });
    return count === 0 ? "not_found" : "removed";
  });
}
