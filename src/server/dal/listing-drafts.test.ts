import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { ItemCategory, ItemCondition, ItemStatus } from "@/generated/prisma/enums";
import { SAFETY_CHECK_FAILED } from "@/lib/items/prohibited";

vi.mock("server-only", () => ({}));

import {
  createDraftListing,
  publishDraftListing,
  type DraftListingInput,
  type PublishDraftInput,
} from "./listing-drafts";

const { create, findFirst, updateMany } = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
}));

// Stand-in for the one delegate the module uses; the generated client type is
// far larger than this fake, hence the cast (same pattern as listings.test.ts).
const fakeDb = { item: { create, findFirst, updateMany } } as unknown as Pick<PrismaClient, "item">;
const getClient = () => fakeDb;

const SESSION_USER = { id: "session-user-1" };
const COMMUNITY_ID = "community-1";
const DRAFT_ID = "draft-1";

const PHOTO = {
  url: "https://res.cloudinary.com/demo/image/upload/v1/borrowloop/items/drill.jpg",
  publicId: "borrowloop/items/drill",
  width: 1200,
  height: 900,
};

const DRAFT_INPUT: DraftListingInput = {
  communityId: COMMUNITY_ID,
  title: "Cordless drill",
  description: "18V cordless drill with two batteries.",
  category: ItemCategory.TOOLS,
  condition: ItemCondition.GOOD,
  flagReason: null,
  photo: PHOTO,
};

const EDITED: PublishDraftInput = {
  itemId: DRAFT_ID,
  title: "Bosch cordless drill",
  description: "Lender's own description.",
  category: ItemCategory.TOOLS,
  condition: ItemCondition.LIKE_NEW,
};

/** The scope every draft query for SESSION_USER must carry. */
const DRAFT_SCOPE = {
  id: DRAFT_ID,
  ownerId: SESSION_USER.id,
  status: ItemStatus.DRAFT,
  community: { memberships: { some: { userId: SESSION_USER.id } } },
};

beforeEach(() => {
  create.mockReset();
  findFirst.mockReset();
  updateMany.mockReset();
  create.mockResolvedValue({ id: DRAFT_ID });
  findFirst.mockResolvedValue({ flagReason: null });
  updateMany.mockResolvedValue({ count: 1 });
});

describe("createDraftListing", () => {
  it("sets ownerId from the session user, never from input", async () => {
    // Extra fields a tampered caller might pass. Assigned through a variable so
    // TypeScript allows them, the way untyped runtime input would arrive.
    const tampered = { ...DRAFT_INPUT, ownerId: "attacker-id", status: ItemStatus.PUBLISHED };

    await createDraftListing(SESSION_USER, tampered, getClient);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: SESSION_USER.id }) }),
    );
  });

  it("saves status DRAFT, the given flagReason, the fields, and the photo as the cover", async () => {
    const tampered = { ...DRAFT_INPUT, flagReason: "WEAPON" as const, status: ItemStatus.PUBLISHED };

    await createDraftListing(SESSION_USER, tampered, getClient);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communityId: COMMUNITY_ID,
          title: DRAFT_INPUT.title,
          description: DRAFT_INPUT.description,
          category: DRAFT_INPUT.category,
          condition: DRAFT_INPUT.condition,
          status: ItemStatus.DRAFT,
          flagReason: "WEAPON",
          photos: { create: expect.objectContaining({ ...PHOTO, position: 0 }) },
        }),
      }),
    );
  });

  it("returns the new draft's id", async () => {
    await expect(createDraftListing(SESSION_USER, DRAFT_INPUT, getClient)).resolves.toEqual({ id: DRAFT_ID });
  });
});

describe("publishDraftListing", () => {
  it("scopes every query to the draft id, the session user as owner, DRAFT status, and their membership", async () => {
    await publishDraftListing(SESSION_USER, EDITED, getClient);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: DRAFT_SCOPE }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: DRAFT_SCOPE }));
  });

  it("writes the lender's edited fields, and nothing else from the input", async () => {
    // Fields the form must never be able to set.
    const tampered = {
      ...EDITED,
      ownerId: "attacker-id",
      communityId: "other-community",
      flagReason: null,
      status: ItemStatus.PUBLISHED,
    };

    await publishDraftListing(SESSION_USER, tampered, getClient);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0]?.[0]?.data).toStrictEqual({
      title: EDITED.title,
      description: EDITED.description,
      category: EDITED.category,
      condition: EDITED.condition,
      status: ItemStatus.PUBLISHED,
    });
  });

  it("publishes when the stored draft has no flagReason", async () => {
    findFirst.mockResolvedValue({ flagReason: null });

    const result = await publishDraftListing(SESSION_USER, EDITED, getClient);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: ItemStatus.PUBLISHED }) }),
    );
    expect(result).toStrictEqual({ status: ItemStatus.PUBLISHED });
  });

  it.each(["WEAPON", SAFETY_CHECK_FAILED])(
    "holds the listing for review when the stored draft has flagReason %s, whatever the input says",
    async (storedFlag) => {
      findFirst.mockResolvedValue({ flagReason: storedFlag });
      const tampered = { ...EDITED, flagReason: null, status: ItemStatus.PUBLISHED };

      const result = await publishDraftListing(SESSION_USER, tampered, getClient);

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ItemStatus.PENDING_REVIEW }) }),
      );
      expect(result).toStrictEqual({ status: ItemStatus.PENDING_REVIEW });
    },
  );

  // With the scoped where clause, each of these is simply "no matching row".
  // prisma/listing-drafts.test.ts (cycle 11) checks the same cases against a real database.
  it.each([
    ["another user's draft"],
    ["a draft that's already published"],
    ["a draft in a community the user has left or been removed from"],
  ])("returns 'not_found' and updates nothing for %s", async () => {
    findFirst.mockResolvedValue(null);

    await expect(publishDraftListing(SESSION_USER, EDITED, getClient)).resolves.toBe("not_found");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("returns 'not_found' when the draft stops matching between the read and the update", async () => {
    findFirst.mockResolvedValue({ flagReason: null });
    updateMany.mockResolvedValue({ count: 0 });

    await expect(publishDraftListing(SESSION_USER, EDITED, getClient)).resolves.toBe("not_found");
  });
});
