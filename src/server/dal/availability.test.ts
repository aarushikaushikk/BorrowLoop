import { beforeEach, describe, expect, it, vi } from "vitest";
import { toDbDate } from "@/lib/dates/calendar-date";
import { addBlockedRange, getItemAvailability, removeBlockedRange, type AvailabilityDb } from "@/server/dal/availability";

vi.mock("server-only", () => ({}));

const { findFirst, outerCreate, outerDeleteMany, txCreate, txDeleteMany, txQueryRaw, transaction } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  // Writes on the outer client: must never be used for mutations, which belong in the transaction.
  outerCreate: vi.fn(),
  outerDeleteMany: vi.fn(),
  // The transaction client.
  txCreate: vi.fn(),
  txDeleteMany: vi.fn(),
  txQueryRaw: vi.fn(),
  transaction: vi.fn(),
}));

const tx = { $queryRaw: txQueryRaw, availability: { create: txCreate, deleteMany: txDeleteMany } };

// Stand-in for the delegates the module uses; the generated client type is far
// larger than this fake, hence the cast.
const fakeDb = {
  item: { findFirst },
  availability: { create: outerCreate, deleteMany: outerDeleteMany },
  $transaction: transaction,
} as unknown as AvailabilityDb;
const getClient = vi.fn(() => fakeDb);

const USER = { id: "user-1" };
const OTHER_USER_ID = "owner-9";
const COMMUNITY_ID = "community-1";
const ITEM_ID = "item-1";
const TODAY = "2026-11-27";

/** The Prisma.Sql object passed to `$queryRaw` (the lock-and-authorize statement). */
function lockStatement(): { sql: string; values: unknown[] } {
  expect(txQueryRaw).toHaveBeenCalledTimes(1);
  const [statement] = txQueryRaw.mock.calls[0] as [{ sql: string; values: unknown[] }];
  return statement;
}

beforeEach(() => {
  for (const mock of [findFirst, outerCreate, outerDeleteMany, txCreate, txDeleteMany, txQueryRaw, transaction]) {
    mock.mockReset();
  }
  getClient.mockClear();
  transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));
});

const DRILL = {
  id: ITEM_ID,
  communityId: COMMUNITY_ID,
  title: "Cordless drill",
  description: "18V with two batteries",
  category: "TOOLS",
  condition: "GOOD",
};

function itemRow(ownerId: string) {
  return {
    ...DRILL,
    ownerId,
    availability: [
      { id: "block-a", startDate: toDbDate("2026-12-01"), endDate: toDbDate("2026-12-05"), note: "Away for a week" },
      // Overlaps block-a: overlapping blocks stay separate entries.
      { id: "block-b", startDate: toDbDate("2026-12-03"), endDate: toDbDate("2026-12-04"), note: null },
    ],
  };
}

describe("getItemAvailability", () => {
  it("scopes the read to a PUBLISHED item in the community, the session user's membership, and blocks that haven't ended", async () => {
    findFirst.mockResolvedValue(null);

    await getItemAvailability(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID }, TODAY, getClient);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: ITEM_ID,
        communityId: COMMUNITY_ID,
        status: "PUBLISHED",
        community: { memberships: { some: { userId: USER.id } } },
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
          where: { endDate: { gte: toDbDate(TODAY) } },
          select: { id: true, startDate: true, endDate: true, note: true },
          orderBy: [{ startDate: "asc" }, { id: "asc" }],
        },
      },
    });
  });

  it("returns null when the scoped query finds no item visible to the user", async () => {
    findFirst.mockResolvedValue(null);

    await expect(
      getItemAvailability(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID }, TODAY, getClient),
    ).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("gives the owner the item, calendar-date blocks, and private notes", async () => {
    findFirst.mockResolvedValue(itemRow(USER.id));

    await expect(
      getItemAvailability(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID }, TODAY, getClient),
    ).resolves.toEqual({
      viewer: "owner",
      item: DRILL,
      blocks: [
        { id: "block-a", startDate: "2026-12-01", endDate: "2026-12-05", note: "Away for a week" },
        { id: "block-b", startDate: "2026-12-03", endDate: "2026-12-04", note: null },
      ],
    });
  });

  it("gives other members the dates only: no notes and no owner ID", async () => {
    findFirst.mockResolvedValue(itemRow(OTHER_USER_ID));

    const view = await getItemAvailability(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID }, TODAY, getClient);

    expect(view).toEqual({
      viewer: "member",
      item: DRILL,
      blocks: [
        { id: "block-a", startDate: "2026-12-01", endDate: "2026-12-05" },
        { id: "block-b", startDate: "2026-12-03", endDate: "2026-12-04" },
      ],
    });
    for (const block of view?.blocks ?? []) {
      expect(block).not.toHaveProperty("note");
    }
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("Away for a week");
    expect(serialized).not.toContain(OTHER_USER_ID);
    expect(serialized).not.toContain("ownerId");
  });

  it("never returns the owner ID to the owner either", async () => {
    findFirst.mockResolvedValue(itemRow(USER.id));

    const view = await getItemAvailability(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID }, TODAY, getClient);

    expect(view).not.toBeNull();
    expect(JSON.stringify(view)).not.toContain("ownerId");
  });

  it("does not request a database client until called", () => {
    expect(getClient).not.toHaveBeenCalled();
  });
});

const RANGE = { startDate: "2026-12-01", endDate: "2026-12-03", note: "Away" };

describe("addBlockedRange", () => {
  it("locks and authorizes the item and membership in one parameterized statement inside a transaction", async () => {
    txQueryRaw.mockResolvedValue([{ id: ITEM_ID }]);
    txCreate.mockResolvedValue({ id: "block-new" });

    await addBlockedRange(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID, range: RANGE }, getClient);

    expect(transaction).toHaveBeenCalledTimes(1);
    const statement = lockStatement();
    // Row locks held until commit, so a concurrent membership removal or
    // ownership/status change either waits for this write or makes it fail.
    expect(statement.sql).toMatch(/FOR SHARE OF/i);
    expect(statement.sql).toMatch(/"Membership"/);
    expect(statement.sql).toMatch(/'PUBLISHED'/);
    expect(statement.sql).toMatch(/"ownerId"/);
    // Every ID is a bind parameter, never part of the SQL text.
    expect(statement.values).toEqual(expect.arrayContaining([USER.id, ITEM_ID, COMMUNITY_ID]));
    expect(statement.sql).not.toContain(USER.id);
    expect(statement.sql).not.toContain(ITEM_ID);
    expect(statement.sql).not.toContain(COMMUNITY_ID);
  });

  it("creates the block in the same transaction, after the lock, with only the validated fields", async () => {
    txQueryRaw.mockResolvedValue([{ id: ITEM_ID }]);
    txCreate.mockResolvedValue({ id: "block-new" });

    await expect(
      addBlockedRange(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID, range: RANGE }, getClient),
    ).resolves.toEqual({ id: "block-new" });

    expect(txCreate).toHaveBeenCalledWith({
      data: { itemId: ITEM_ID, startDate: toDbDate("2026-12-01"), endDate: toDbDate("2026-12-03"), note: "Away" },
      select: { id: true },
    });
    expect(txQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(txCreate.mock.invocationCallOrder[0]);
    expect(outerCreate).not.toHaveBeenCalled();
  });

  it("stores a block without a note as null", async () => {
    txQueryRaw.mockResolvedValue([{ id: ITEM_ID }]);
    txCreate.mockResolvedValue({ id: "block-new" });

    await addBlockedRange(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID, range: { ...RANGE, note: null } }, getClient);

    expect(txCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ note: null }) }));
  });

  it("returns not_found and writes nothing when the user doesn't own a matching PUBLISHED item they're a member for", async () => {
    txQueryRaw.mockResolvedValue([]);

    await expect(
      addBlockedRange(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID, range: RANGE }, getClient),
    ).resolves.toBe("not_found");

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(txCreate).not.toHaveBeenCalled();
    expect(outerCreate).not.toHaveBeenCalled();
  });

  it("fails closed, writing nothing, when the lock statement returns an unexpected row shape", async () => {
    txQueryRaw.mockResolvedValue([{ unexpected: 1 }]);

    await expect(
      addBlockedRange(USER, { communityId: COMMUNITY_ID, itemId: ITEM_ID, range: RANGE }, getClient),
    ).rejects.toThrow();

    expect(txCreate).not.toHaveBeenCalled();
  });

  it("does not request a database client until called", () => {
    expect(getClient).not.toHaveBeenCalled();
  });
});

describe("removeBlockedRange", () => {
  it("locks and authorizes the block's item and the membership in one parameterized statement inside a transaction", async () => {
    txQueryRaw.mockResolvedValue([{ id: "block-a" }]);
    txDeleteMany.mockResolvedValue({ count: 1 });

    await removeBlockedRange(USER, { communityId: COMMUNITY_ID, availabilityId: "block-a" }, getClient);

    expect(transaction).toHaveBeenCalledTimes(1);
    const statement = lockStatement();
    expect(statement.sql).toMatch(/FOR SHARE OF/i);
    expect(statement.sql).toMatch(/"Availability"/);
    expect(statement.sql).toMatch(/"Membership"/);
    expect(statement.sql).toMatch(/'PUBLISHED'/);
    expect(statement.sql).toMatch(/"ownerId"/);
    expect(statement.values).toEqual(expect.arrayContaining([USER.id, "block-a", COMMUNITY_ID]));
    expect(statement.sql).not.toContain(USER.id);
    expect(statement.sql).not.toContain("block-a");
    expect(statement.sql).not.toContain(COMMUNITY_ID);
  });

  it("deletes only the authorized block, re-checking its scope, in the same transaction, after the lock", async () => {
    txQueryRaw.mockResolvedValue([{ id: "block-a" }]);
    txDeleteMany.mockResolvedValue({ count: 1 });

    await expect(
      removeBlockedRange(USER, { communityId: COMMUNITY_ID, availabilityId: "block-a" }, getClient),
    ).resolves.toBe("removed");

    // Defence in depth on top of the row locks: the delete itself repeats the
    // block ID, community, session owner, PUBLISHED status and membership.
    expect(txDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "block-a",
        item: {
          communityId: COMMUNITY_ID,
          ownerId: USER.id,
          status: "PUBLISHED",
          community: { memberships: { some: { userId: USER.id } } },
        },
      },
    });
    expect(txQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(txDeleteMany.mock.invocationCallOrder[0]);
    expect(outerDeleteMany).not.toHaveBeenCalled();
  });

  it("returns not_found and deletes nothing when the block isn't on the user's own PUBLISHED item", async () => {
    txQueryRaw.mockResolvedValue([]);

    await expect(
      removeBlockedRange(USER, { communityId: COMMUNITY_ID, availabilityId: "block-a" }, getClient),
    ).resolves.toBe("not_found");

    expect(txDeleteMany).not.toHaveBeenCalled();
    expect(outerDeleteMany).not.toHaveBeenCalled();
  });

  it("returns not_found when the block was already removed by a concurrent request", async () => {
    txQueryRaw.mockResolvedValue([{ id: "block-a" }]);
    txDeleteMany.mockResolvedValue({ count: 0 });

    await expect(
      removeBlockedRange(USER, { communityId: COMMUNITY_ID, availabilityId: "block-a" }, getClient),
    ).resolves.toBe("not_found");
  });

  it("fails closed, deleting nothing, when the lock statement returns an unexpected row shape", async () => {
    txQueryRaw.mockResolvedValue([{ id: 42 }]);

    await expect(
      removeBlockedRange(USER, { communityId: COMMUNITY_ID, availabilityId: "block-a" }, getClient),
    ).rejects.toThrow();

    expect(txDeleteMany).not.toHaveBeenCalled();
  });

  it("does not request a database client until called", () => {
    expect(getClient).not.toHaveBeenCalled();
  });
});
