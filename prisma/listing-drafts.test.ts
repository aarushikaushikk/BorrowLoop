import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismaClient } from "../src/lib/prisma";

vi.mock("server-only", () => ({}));

import { createDraftListing, publishDraftListing } from "@/server/dal/listing-drafts";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Runs only when TEST_DATABASE_URL is set. Never point it at Neon or any
// shared database. Everything here is real: the Prisma queries, the
// interactive transaction, and the relation filters in the where clauses.

const RUN = `cy11-${randomUUID().slice(0, 8)}`;

const PHOTO = {
  url: "https://res.cloudinary.com/demo/image/upload/v1/borrowloop/test/drill.png",
  publicId: `borrowloop/test/${RUN}-drill`,
  width: 1,
  height: 1,
};

const ORIGINAL = {
  title: "Cordless drill",
  description: "18V cordless drill with two batteries.",
  category: "TOOLS" as const,
  condition: "GOOD" as const,
};

const EDITED = {
  title: "Bosch cordless drill",
  description: "Lender's own description, with spare bits.",
  category: "TOOLS" as const,
  condition: "LIKE_NEW" as const,
};

describe.skipIf(!testDatabaseUrl)("draft listings (test database)", () => {
  const db = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : null!;
  const getClient = () => db;

  // Fixtures, recreated for every test:
  //   alice: MEMBER of Alpha (the lender)   bob: MEMBER of Alpha (another member)
  //   carol: MEMBER of Beta only (a non-member of Alpha)
  type Ref = { id: string };
  let alice: Ref, bob: Ref, carol: Ref;
  let alpha: Ref, beta: Ref;

  async function cleanUp() {
    // Only rows this file created: deleting its communities removes their
    // memberships, items and photos (onDelete: Cascade).
    await db.community.deleteMany({ where: { slug: { startsWith: RUN } } });
    await db.user.deleteMany({ where: { email: { startsWith: RUN } } });
  }

  /** Creates a draft for alice in Alpha through the real data layer. */
  async function aliceDraft(flagReason: "WEAPON" | "SAFETY_CHECK_FAILED" | null = null): Promise<string> {
    const created = await createDraftListing(
      alice,
      { communityId: alpha.id, ...ORIGINAL, flagReason, photo: PHOTO },
      getClient,
    );
    if (created === "not_found") throw new Error("fixture: alice should be a member of Alpha");
    return created.id;
  }

  async function readItem(id: string) {
    return db.item.findUniqueOrThrow({
      where: { id },
      select: {
        ownerId: true,
        communityId: true,
        status: true,
        flagReason: true,
        title: true,
        description: true,
        category: true,
        condition: true,
      },
    });
  }

  beforeEach(async () => {
    await cleanUp();

    [alice, bob, carol] = await Promise.all(
      ["alice", "bob", "carol"].map((name) =>
        db.user.create({ data: { email: `${RUN}-${name}@example.test`, name }, select: { id: true } }),
      ),
    );
    [alpha, beta] = await Promise.all(
      ["alpha", "beta"].map((name) =>
        db.community.create({ data: { slug: `${RUN}-${name}`, name: `${RUN} ${name}` }, select: { id: true } }),
      ),
    );
    await db.membership.createMany({
      data: [
        { userId: alice.id, communityId: alpha.id, role: "MEMBER" },
        { userId: bob.id, communityId: alpha.id, role: "MEMBER" },
        { userId: carol.id, communityId: beta.id, role: "MEMBER" },
      ],
    });
  });

  // afterEach runs even when an assertion fails, so no test leaves rows behind.
  afterEach(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await db.$disconnect();
  });

  it("creates a DRAFT for a member, with the session user as owner and the photo as the cover", async () => {
    const draftId = await aliceDraft();

    await expect(readItem(draftId)).resolves.toStrictEqual({
      ownerId: alice.id,
      communityId: alpha.id,
      status: "DRAFT",
      flagReason: null,
      ...ORIGINAL,
    });
    await expect(
      db.itemPhoto.findMany({ where: { itemId: draftId }, select: { publicId: true, position: true } }),
    ).resolves.toStrictEqual([{ publicId: PHOTO.publicId, position: 0 }]);
  });

  it("publishes the owner's clean draft with the edited fields", async () => {
    const draftId = await aliceDraft();

    await expect(publishDraftListing(alice, { itemId: draftId, ...EDITED }, getClient)).resolves.toStrictEqual({
      status: "PUBLISHED",
    });
    await expect(readItem(draftId)).resolves.toMatchObject({ status: "PUBLISHED", flagReason: null, ...EDITED });
  });

  it("returns 'not_found' when another member of the same community tries to publish the draft, and leaves it unchanged", async () => {
    const draftId = await aliceDraft();
    const before = await readItem(draftId);

    await expect(publishDraftListing(bob, { itemId: draftId, ...EDITED }, getClient)).resolves.toBe("not_found");
    await expect(readItem(draftId)).resolves.toStrictEqual(before);
  });

  it("returns 'not_found' for a draft that's already published, and keeps the first save", async () => {
    const draftId = await aliceDraft();
    await publishDraftListing(alice, { itemId: draftId, ...EDITED }, getClient);

    const secondEdit = { ...EDITED, title: "Second attempt" };
    await expect(publishDraftListing(alice, { itemId: draftId, ...secondEdit }, getClient)).resolves.toBe(
      "not_found",
    );
    await expect(readItem(draftId)).resolves.toMatchObject({ status: "PUBLISHED", title: EDITED.title });
  });

  it("returns 'not_found' when the owner has been removed from the community, and leaves the draft unchanged", async () => {
    const draftId = await aliceDraft();
    const before = await readItem(draftId);
    await db.membership.delete({ where: { userId_communityId: { userId: alice.id, communityId: alpha.id } } });

    await expect(publishDraftListing(alice, { itemId: draftId, ...EDITED }, getClient)).resolves.toBe("not_found");
    await expect(readItem(draftId)).resolves.toStrictEqual(before);
  });

  it.each(["WEAPON", "SAFETY_CHECK_FAILED"] as const)(
    "holds a draft flagged %s for review even though the form carries no flag, and keeps the flag",
    async (flagReason) => {
      const draftId = await aliceDraft(flagReason);

      await expect(publishDraftListing(alice, { itemId: draftId, ...EDITED }, getClient)).resolves.toStrictEqual({
        status: "PENDING_REVIEW",
      });
      await expect(readItem(draftId)).resolves.toMatchObject({ status: "PENDING_REVIEW", flagReason, ...EDITED });
    },
  );

  it("returns 'not_found' and writes no rows when a non-member tries to create a draft", async () => {
    const result = await createDraftListing(
      carol,
      { communityId: alpha.id, ...ORIGINAL, flagReason: null, photo: PHOTO },
      getClient,
    );

    expect(result).toBe("not_found");
    await expect(db.item.count({ where: { ownerId: carol.id } })).resolves.toBe(0);
    await expect(db.item.count({ where: { communityId: alpha.id } })).resolves.toBe(0);
    await expect(db.itemPhoto.count({ where: { publicId: PHOTO.publicId } })).resolves.toBe(0);
  });
});
