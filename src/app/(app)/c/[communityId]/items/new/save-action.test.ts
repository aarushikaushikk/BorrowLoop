import { beforeEach, describe, expect, it, vi } from "vitest";
import { ItemCategory, ItemCondition, ItemStatus } from "@/generated/prisma/enums";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/validation/listing";
import type { CommunityAccessResult } from "@/server/auth/guards";
import type { PublishDraftInput, PublishDraftResult } from "@/server/dal/listing-drafts";
import type { ModeratedListingStatus } from "@/server/domain/listing-moderation";

const { getCommunityAccessMock, publishDraftListingMock } = vi.hoisted(() => ({
  getCommunityAccessMock: vi.fn<
    (input: { params: unknown; level: "member" | "admin"; callbackPath: string }) => Promise<{
      user: { id: string; name: string | null; image: string | null };
      access: CommunityAccessResult;
    }>
  >(),
  publishDraftListingMock: vi.fn<(user: { id: string }, input: PublishDraftInput) => Promise<PublishDraftResult>>(),
}));

vi.mock("server-only", () => ({}));
// The existing US-1 guard: session (requireUser) plus membership check.
vi.mock("@/server/auth/community-access", () => ({ getCommunityAccess: getCommunityAccessMock }));
vi.mock("@/server/dal/listing-drafts", () => ({
  publishDraftListing: publishDraftListingMock,
  createDraftListing: vi.fn(),
}));
// Used only by the analyze action in the same file; stubbed so nothing real loads.
vi.mock("@/lib/cloudinary", () => ({ uploadImage: vi.fn() }));
vi.mock("@/server/ai/listing-suggestion", () => ({ suggestListing: vi.fn() }));

import { saveListingAction, type SaveListingState } from "./actions";

// US-2 save step: the lender's edits are saved to their own draft, and the
// listing is published or held according to the flag stored on the draft.

const SESSION_USER = { id: "session-user-id", name: "Member", image: null };
const COMMUNITY_ID = "clx0community0001";
const DRAFT_ID = "clx0draft000001";
const IDLE: SaveListingState = { status: "idle" };
const GENERIC_ERROR = { status: "error", message: "We couldn't save your listing. Refresh the page and try again." };

/** What the lender typed. Deliberately different from anything Claude suggested. */
const EDITED = {
  title: "Bosch cordless drill",
  description: "My own description, with spare bits.",
  category: ItemCategory.TOOLS,
  condition: ItemCondition.LIKE_NEW,
};

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

function validFields(): Record<string, string | Blob> {
  return { communityId: COMMUNITY_ID, draftId: DRAFT_ID, ...EDITED };
}

beforeEach(() => {
  getCommunityAccessMock.mockReset();
  publishDraftListingMock.mockReset();

  getCommunityAccessMock.mockResolvedValue({
    user: SESSION_USER,
    access: { decision: "allow", communityId: COMMUNITY_ID },
  });
  publishDraftListingMock.mockResolvedValue({ status: ItemStatus.PUBLISHED });
});

describe("saveListingAction access", () => {
  it("lets the sign-in redirect propagate and doesn't save anything", async () => {
    getCommunityAccessMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in"));

    await expect(saveListingAction(IDLE, form(validFields()))).rejects.toThrow("NEXT_REDIRECT");
    expect(getCommunityAccessMock).toHaveBeenCalledTimes(1);
    expect(publishDraftListingMock).not.toHaveBeenCalled();
  });

  it("returns the generic error for a non-member and doesn't save anything", async () => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: { decision: "not_found" } });

    await expect(saveListingAction(IDLE, form(validFields()))).resolves.toStrictEqual(GENERIC_ERROR);
    expect(publishDraftListingMock).not.toHaveBeenCalled();
  });

  it("checks membership through the US-1 guard with only the submitted communityId", async () => {
    await saveListingAction(IDLE, form(validFields()));

    expect(getCommunityAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({ params: { communityId: COMMUNITY_ID }, level: "member" }),
    );
  });
});

describe("saveListingAction data passed to publishDraftListing", () => {
  it("passes the session user, the draftId, and the lender's trimmed form values", async () => {
    await saveListingAction(
      IDLE,
      form({ ...validFields(), title: "  Bosch cordless drill \n", description: "\tMy own description, with spare bits.  " }),
    );

    expect(publishDraftListingMock).toHaveBeenCalledTimes(1);
    expect(publishDraftListingMock).toHaveBeenCalledWith({ id: SESSION_USER.id }, { itemId: DRAFT_ID, ...EDITED });
  });

  it("ignores extra form fields named status, flagReason, ownerId and communityId", async () => {
    const tampered = form({
      ...validFields(),
      status: ItemStatus.PUBLISHED,
      flagReason: "",
      ownerId: "attacker-id",
    });

    await saveListingAction(IDLE, tampered);

    expect(publishDraftListingMock).toHaveBeenCalledTimes(1);
    const input = publishDraftListingMock.mock.calls[0]?.[1];
    expect(input).toStrictEqual({ itemId: DRAFT_ID, ...EDITED });
    for (const key of ["status", "flagReason", "ownerId", "communityId"]) {
      expect(input).not.toHaveProperty(key);
    }
  });
});

describe("saveListingAction field validation", () => {
  it.each<[string, Record<string, string | Blob>, string]>([
    ["a title that's empty after trimming", { title: "   " }, "title"],
    ["an empty title", { title: "" }, "title"],
    [`a title over ${TITLE_MAX} characters`, { title: "a".repeat(TITLE_MAX + 1) }, "title"],
    ["a description that's empty after trimming", { description: "\n\t " }, "description"],
    [`a description over ${DESCRIPTION_MAX} characters`, { description: "a".repeat(DESCRIPTION_MAX + 1) }, "description"],
    ["an unknown category", { category: "WEAPONS" }, "category"],
    ["an unknown condition", { condition: "MINT" }, "condition"],
    ["a malformed draftId", { draftId: "bad id" }, "draftId"],
    ["a draftId over 64 characters", { draftId: "a".repeat(65) }, "draftId"],
    ["a file instead of a draftId", { draftId: new Blob(["x"]) }, "draftId"],
  ])("returns a field error for %s and doesn't save", async (_label, overrides, field) => {
    const state = await saveListingAction(IDLE, form({ ...validFields(), ...overrides }));

    expect(state).toMatchObject({ status: "error", fieldErrors: { [field]: expect.any(String) } });
    expect(publishDraftListingMock).not.toHaveBeenCalled();
  });

  it("returns a field error for a missing draftId and doesn't save", async () => {
    const fields = validFields();
    delete fields.draftId;

    const state = await saveListingAction(IDLE, form(fields));

    expect(state).toMatchObject({ status: "error", fieldErrors: { draftId: expect.any(String) } });
    expect(publishDraftListingMock).not.toHaveBeenCalled();
  });
});

describe("saveListingAction results", () => {
  it.each<[string, ModeratedListingStatus, string]>([
    ["published", ItemStatus.PUBLISHED, "published"],
    ["held for review", ItemStatus.PENDING_REVIEW, "pending_review"],
  ])("tells the lender the listing was %s, without saying why", async (_label, status, outcome) => {
    publishDraftListingMock.mockResolvedValue({ status });

    await expect(saveListingAction(IDLE, form(validFields()))).resolves.toStrictEqual({ status: "saved", outcome });
  });

  it("returns the generic error for 'not_found', without saying whether the draft exists", async () => {
    publishDraftListingMock.mockResolvedValue("not_found");

    await expect(saveListingAction(IDLE, form(validFields()))).resolves.toStrictEqual(GENERIC_ERROR);
  });

  it("hides database errors behind the same generic message", async () => {
    publishDraftListingMock.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432 password="secret"'));

    const state = await saveListingAction(IDLE, form(validFields()));

    expect(state).toStrictEqual(GENERIC_ERROR);
    expect(JSON.stringify(state)).not.toMatch(/ECONNREFUSED|secret|5432/);
  });
});
