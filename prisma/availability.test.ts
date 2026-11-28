import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "../src/generated/prisma/client";
import { fromDbDate, toDbDate, todayUtc } from "../src/lib/dates/calendar-date";
import { createPrismaClient } from "../src/lib/prisma";

vi.mock("server-only", () => ({}));

import { addBlockedRange, getItemAvailability, removeBlockedRange } from "@/server/dal/availability";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Runs only when TEST_DATABASE_URL is set. Never point it at Neon or any
// shared database. Everything here is real: the Prisma queries, the
// parameterized lock statement, the row locks, and @db.Date round-trips.

const RUN = `us3-${randomUUID().slice(0, 8)}`;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar date `offset` days from today (UTC). */
function day(offset: number): string {
  return fromDbDate(new Date(toDbDate(todayUtc(new Date())).getTime() + offset * DAY_MS));
}

function range(startOffset: number, endOffset: number, note: string | null = null) {
  return { startDate: day(startOffset), endDate: day(endOffset), note };
}

describe.skipIf(!testDatabaseUrl)("availability (test database)", () => {
  const db = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : null!;
  const getClient = () => db;

  // Fixtures, recreated for every test:
  //   alice: MEMBER of Alpha and Beta, owns `drill` (PUBLISHED) and `draft` (DRAFT) in Alpha
  //   bob:   MEMBER of Alpha (another member)
  //   dave:  ADMIN of Alpha, not an owner
  //   carol: MEMBER of Beta only
  type Ref = { id: string };
  let alice: Ref, bob: Ref, dave: Ref, carol: Ref;
  let alpha: Ref, beta: Ref;
  let drill: Ref, draft: Ref;

  async function cleanUp() {
    // Only rows this file created: deleting its communities removes their
    // memberships, items and availability (onDelete: Cascade).
    await db.community.deleteMany({ where: { slug: { startsWith: RUN } } });
    await db.user.deleteMany({ where: { email: { startsWith: RUN } } });
  }

  beforeEach(async () => {
    await cleanUp();
    const user = (name: string) =>
      db.user.create({ data: { email: `${RUN}-${name}@example.test`, name }, select: { id: true } });
    [alice, bob, dave, carol] = await Promise.all([user("alice"), user("bob"), user("dave"), user("carol")]);
    alpha = await db.community.create({ data: { name: "Alpha", slug: `${RUN}-alpha` }, select: { id: true } });
    beta = await db.community.create({ data: { name: "Beta", slug: `${RUN}-beta` }, select: { id: true } });
    await db.membership.createMany({
      data: [
        { userId: alice.id, communityId: alpha.id, role: "MEMBER" },
        { userId: alice.id, communityId: beta.id, role: "MEMBER" },
        { userId: bob.id, communityId: alpha.id, role: "MEMBER" },
        { userId: dave.id, communityId: alpha.id, role: "ADMIN" },
        { userId: carol.id, communityId: beta.id, role: "MEMBER" },
      ],
    });
    const item = (status: "PUBLISHED" | "DRAFT") =>
      db.item.create({
        data: {
          ownerId: alice.id,
          communityId: alpha.id,
          title: `Cordless drill (${status})`,
          description: "18V cordless drill with two batteries.",
          category: "TOOLS",
          condition: "GOOD",
          status,
        },
        select: { id: true },
      });
    drill = await item("PUBLISHED");
    draft = await item("DRAFT");
  });

  afterEach(cleanUp);
  afterAll(async () => {
    await db.$disconnect();
  });

  const inAlpha = (itemId: string) => ({ communityId: alpha.id, itemId });

  async function addAsAlice(start: number, end: number, note: string | null = null): Promise<string> {
    const result = await addBlockedRange(alice, { ...inAlpha(drill.id), range: range(start, end, note) }, getClient);
    if (result === "not_found") throw new Error("fixture: alice could not add a block");
    return result.id;
  }

  const blockCount = () => db.availability.count({ where: { itemId: drill.id } });
  const removeMembership = (tx: Prisma.TransactionClient, userId: string) =>
    tx.membership.delete({ where: { userId_communityId: { userId, communityId: alpha.id } } });

  /**
   * Starts a transaction that applies `revoke` and holds its row locks without
   * committing, runs `action` while it's pending, then commits the revocation.
   * An implementation without row locks reads the old, still-visible rows and
   * succeeds before the commit; a locking one waits and then sees the change.
   */
  async function whileRevocationIsPending<T>(
    revoke: (tx: Prisma.TransactionClient) => Promise<unknown>,
    action: () => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let markApplied!: () => void;
    const applied = new Promise<void>((resolve) => (markApplied = resolve));
    const revocation = db.$transaction(
      async (tx) => {
        await revoke(tx);
        markApplied();
        await released;
      },
      { timeout: 15_000 },
    );
    await applied;
    const pending = action();
    // Give the action time to reach its lock statement and block on the revocation's row lock.
    await new Promise((resolve) => setTimeout(resolve, 500));
    release();
    await revocation;
    return pending;
  }

  describe("getItemAvailability", () => {
    it("gives the owner current blocks with notes, as calendar dates", async () => {
      const id = await addAsAlice(3, 5, "Away");

      await expect(getItemAvailability(alice, inAlpha(drill.id), day(0), getClient)).resolves.toMatchObject({
        viewer: "owner",
        item: { id: drill.id, communityId: alpha.id, category: "TOOLS", condition: "GOOD" },
        blocks: [{ id, startDate: day(3), endDate: day(5), note: "Away" }],
      });
    });

    it.each([
      ["another member", () => bob],
      ["a non-owner admin", () => dave],
    ])("gives %s the dates without the note or the owner", async (_label, viewer) => {
      const id = await addAsAlice(3, 5, "Away");

      const view = await getItemAvailability(viewer(), inAlpha(drill.id), day(0), getClient);

      expect(view).toMatchObject({ viewer: "member", blocks: [{ id, startDate: day(3), endDate: day(5) }] });
      expect(view?.blocks[0]).not.toHaveProperty("note");
      expect(JSON.stringify(view)).not.toContain("Away");
      expect(JSON.stringify(view)).not.toContain(alice.id);
    });

    it("round-trips a leap day through @db.Date without shifting it", async () => {
      await addBlockedRange(
        alice,
        { ...inAlpha(drill.id), range: { startDate: "2400-02-28", endDate: "2400-02-29", note: null } },
        getClient,
      );

      const view = await getItemAvailability(alice, inAlpha(drill.id), day(0), getClient);

      expect(view?.blocks).toMatchObject([{ startDate: "2400-02-28", endDate: "2400-02-29" }]);
    });

    it("hides blocks that ended before today but keeps them in the database", async () => {
      // Written directly: the data layer never accepts past ranges.
      await db.availability.create({ data: { itemId: drill.id, startDate: toDbDate(day(-5)), endDate: toDbDate(day(-1)) } });
      await db.availability.create({ data: { itemId: drill.id, startDate: toDbDate(day(-2)), endDate: toDbDate(day(0)) } });

      const view = await getItemAvailability(bob, inAlpha(drill.id), day(0), getClient);

      // Ending today is still current (inclusive).
      expect(view?.blocks).toMatchObject([{ startDate: day(-2), endDate: day(0) }]);
      await expect(blockCount()).resolves.toBe(2);
    });

    it("keeps overlapping blocks as separate entries, sorted by start date", async () => {
      const later = await addAsAlice(5, 9);
      const earlier = await addAsAlice(3, 6);

      const view = await getItemAvailability(bob, inAlpha(drill.id), day(0), getClient);

      expect(view?.blocks.map((block) => block.id)).toEqual([earlier, later]);
    });

    it.each([
      ["a member of another community only", () => carol, () => inAlpha(drill.id)],
      ["the owner, through another community's ID", () => alice, () => ({ communityId: beta.id, itemId: drill.id })],
      ["the owner, for a DRAFT item", () => alice, () => inAlpha(draft.id)],
    ])("returns null for %s", async (_label, viewer, input) => {
      await expect(getItemAvailability(viewer(), input(), day(0), getClient)).resolves.toBeNull();
    });

    it("returns null once the viewer's membership is removed", async () => {
      await db.membership.delete({ where: { userId_communityId: { userId: bob.id, communityId: alpha.id } } });

      await expect(getItemAvailability(bob, inAlpha(drill.id), day(0), getClient)).resolves.toBeNull();
    });
  });

  describe("addBlockedRange", () => {
    it("stores the owner's block with its dates and note", async () => {
      const id = await addAsAlice(1, 2, "Lent to my sister");

      const row = await db.availability.findUniqueOrThrow({ where: { id } });
      expect(row.itemId).toBe(drill.id);
      expect(fromDbDate(row.startDate)).toBe(day(1));
      expect(fromDbDate(row.endDate)).toBe(day(2));
      expect(row.note).toBe("Lent to my sister");
    });

    it("stores overlapping blocks independently", async () => {
      await addAsAlice(1, 5);
      await addAsAlice(3, 7);

      await expect(blockCount()).resolves.toBe(2);
    });

    it.each([
      ["another member", () => bob, () => inAlpha(drill.id)],
      ["a non-owner admin", () => dave, () => inAlpha(drill.id)],
      ["a member of another community", () => carol, () => inAlpha(drill.id)],
      ["the owner, through another community's ID", () => alice, () => ({ communityId: beta.id, itemId: drill.id })],
      ["the owner, on a DRAFT item", () => alice, () => inAlpha(draft.id)],
    ])("rejects %s and writes nothing", async (_label, actor, input) => {
      await expect(addBlockedRange(actor(), { ...input(), range: range(1, 2) }, getClient)).resolves.toBe("not_found");
      await expect(db.availability.count({ where: { item: { ownerId: alice.id } } })).resolves.toBe(0);
    });

    it("rejects the owner after their membership is removed", async () => {
      await db.membership.delete({ where: { userId_communityId: { userId: alice.id, communityId: alpha.id } } });

      await expect(addBlockedRange(alice, { ...inAlpha(drill.id), range: range(1, 2) }, getClient)).resolves.toBe("not_found");
      await expect(blockCount()).resolves.toBe(0);
    });

    it("follows an ownership change: the old owner is rejected and the new owner may add", async () => {
      await db.item.update({ where: { id: drill.id }, data: { ownerId: bob.id } });

      await expect(addBlockedRange(alice, { ...inAlpha(drill.id), range: range(1, 2) }, getClient)).resolves.toBe("not_found");
      await expect(addBlockedRange(bob, { ...inAlpha(drill.id), range: range(1, 2) }, getClient)).resolves.toEqual({
        id: expect.any(String),
      });
    });

    it("waits for a concurrent membership removal and then rejects the add", async () => {
      const result = await whileRevocationIsPending(
        (tx) => removeMembership(tx, alice.id),
        () => addBlockedRange(alice, { ...inAlpha(drill.id), range: range(1, 2) }, getClient),
      );

      expect(result).toBe("not_found");
      await expect(blockCount()).resolves.toBe(0);
    });

    it("waits for a concurrent ownership transfer and then rejects the old owner's add", async () => {
      const result = await whileRevocationIsPending(
        (tx) => tx.item.update({ where: { id: drill.id }, data: { ownerId: bob.id } }),
        () => addBlockedRange(alice, { ...inAlpha(drill.id), range: range(1, 2) }, getClient),
      );

      expect(result).toBe("not_found");
      await expect(blockCount()).resolves.toBe(0);
    });

    it("waits for a concurrent unpublish and then rejects the add", async () => {
      const result = await whileRevocationIsPending(
        (tx) => tx.item.update({ where: { id: drill.id }, data: { status: "ARCHIVED" } }),
        () => addBlockedRange(alice, { ...inAlpha(drill.id), range: range(1, 2) }, getClient),
      );

      expect(result).toBe("not_found");
      await expect(blockCount()).resolves.toBe(0);
    });
  });

  describe("removeBlockedRange", () => {
    it("removes one block and leaves an overlapping block in place", async () => {
      const first = await addAsAlice(1, 5);
      const second = await addAsAlice(3, 7);

      await expect(removeBlockedRange(alice, { communityId: alpha.id, availabilityId: first }, getClient)).resolves.toBe(
        "removed",
      );

      const remaining = await db.availability.findMany({ where: { itemId: drill.id }, select: { id: true } });
      expect(remaining).toEqual([{ id: second }]);
    });

    it("returns not_found when the block was already removed", async () => {
      const id = await addAsAlice(1, 2);
      await removeBlockedRange(alice, { communityId: alpha.id, availabilityId: id }, getClient);

      await expect(removeBlockedRange(alice, { communityId: alpha.id, availabilityId: id }, getClient)).resolves.toBe(
        "not_found",
      );
    });

    it.each([
      ["another member", () => bob, () => alpha.id],
      ["a non-owner admin", () => dave, () => alpha.id],
      ["a member of another community", () => carol, () => alpha.id],
      ["the owner, through another community's ID", () => alice, () => beta.id],
    ])("rejects %s and keeps the block", async (_label, actor, communityId) => {
      const id = await addAsAlice(1, 2);

      await expect(removeBlockedRange(actor(), { communityId: communityId(), availabilityId: id }, getClient)).resolves.toBe(
        "not_found",
      );
      await expect(blockCount()).resolves.toBe(1);
    });

    it("rejects the owner after their membership is removed", async () => {
      const id = await addAsAlice(1, 2);
      await db.membership.delete({ where: { userId_communityId: { userId: alice.id, communityId: alpha.id } } });

      await expect(removeBlockedRange(alice, { communityId: alpha.id, availabilityId: id }, getClient)).resolves.toBe(
        "not_found",
      );
      await expect(blockCount()).resolves.toBe(1);
    });

    it("rejects removal once the item is no longer PUBLISHED", async () => {
      const id = await addAsAlice(1, 2);
      await db.item.update({ where: { id: drill.id }, data: { status: "ARCHIVED" } });

      await expect(removeBlockedRange(alice, { communityId: alpha.id, availabilityId: id }, getClient)).resolves.toBe(
        "not_found",
      );
      await expect(blockCount()).resolves.toBe(1);
    });

    it("waits for a concurrent membership removal and then rejects the removal", async () => {
      const id = await addAsAlice(1, 2);

      const result = await whileRevocationIsPending(
        (tx) => removeMembership(tx, alice.id),
        () => removeBlockedRange(alice, { communityId: alpha.id, availabilityId: id }, getClient),
      );

      expect(result).toBe("not_found");
      await expect(blockCount()).resolves.toBe(1);
    });
  });
});
