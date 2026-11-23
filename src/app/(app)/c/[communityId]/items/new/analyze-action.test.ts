import { beforeEach, describe, expect, it, vi } from "vitest";
import { ItemCategory, ItemCondition } from "@/generated/prisma/enums";
import { SAFETY_CHECK_FAILED } from "@/lib/items/prohibited";
import { MAX_UPLOAD_BYTES } from "@/lib/validation/listing";
import type { ListingSuggestionResult } from "@/server/ai/listing-suggestion";
import type { CommunityAccessResult } from "@/server/auth/guards";

const { getCommunityAccessMock, uploadImageMock, suggestListingMock, createDraftListingMock } = vi.hoisted(() => ({
  getCommunityAccessMock: vi.fn<
    (input: { params: unknown; level: "member" | "admin"; callbackPath: string }) => Promise<{
      user: { id: string; name: string | null; image: string | null };
      access: CommunityAccessResult;
    }>
  >(),
  uploadImageMock: vi.fn(),
  suggestListingMock: vi.fn<(photo: { bytes: Uint8Array; mime: string }) => Promise<ListingSuggestionResult>>(),
  createDraftListingMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
// The existing US-1 guard: session (requireUser) plus membership check.
vi.mock("@/server/auth/community-access", () => ({ getCommunityAccess: getCommunityAccessMock }));
vi.mock("@/lib/cloudinary", () => ({ uploadImage: uploadImageMock }));
vi.mock("@/server/ai/listing-suggestion", () => ({ suggestListing: suggestListingMock }));
vi.mock("@/server/dal/listing-drafts", () => ({ createDraftListing: createDraftListingMock }));

import { analyzePhotoAction, type AnalyzePhotoState } from "./actions";

// US-2 photo step. Real validateUpload and decideListingModeration run inside
// the action; only I/O (session, Cloudinary, Claude, database) is mocked.

const SESSION_USER = { id: "session-user-id", name: "Member", image: null };
const COMMUNITY_ID = "clx0community0001";
const DRAFT_ID = "draft-1";
const IDLE: AnalyzePhotoState = { status: "idle" };
const GENERIC_ERROR = { status: "error", message: "We couldn't process that photo. Refresh the page and try again." };

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const GIF_BYTES = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const UPLOADED = {
  url: "https://res.cloudinary.com/demo/image/upload/v1/borrowloop/items/drill.png",
  publicId: "borrowloop/items/drill",
  width: 1,
  height: 1,
};

const SUGGESTION = {
  title: "Cordless drill",
  description: "18V cordless drill with two batteries.",
  category: ItemCategory.TOOLS,
  condition: ItemCondition.GOOD,
};

function photoFile(bytes: Uint8Array, name = "drill.png", type = "image/png"): File {
  return new File([Uint8Array.from(bytes)], name, { type });
}

function paddedPng(size: number): Uint8Array {
  const out = new Uint8Array(size);
  out.set(PNG_BYTES);
  return out;
}

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

function validForm(extra: Record<string, string | Blob> = {}): FormData {
  return form({ communityId: COMMUNITY_ID, photo: photoFile(PNG_BYTES), ...extra });
}

function expectNoWork() {
  expect(uploadImageMock).not.toHaveBeenCalled();
  expect(suggestListingMock).not.toHaveBeenCalled();
  expect(createDraftListingMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  getCommunityAccessMock.mockReset();
  uploadImageMock.mockReset();
  suggestListingMock.mockReset();
  createDraftListingMock.mockReset();

  getCommunityAccessMock.mockResolvedValue({
    user: SESSION_USER,
    access: { decision: "allow", communityId: COMMUNITY_ID },
  });
  uploadImageMock.mockResolvedValue(UPLOADED);
  suggestListingMock.mockResolvedValue({ status: "ok", suggestion: SUGGESTION, prohibited: null });
  createDraftListingMock.mockResolvedValue({ id: DRAFT_ID });
});

describe("analyzePhotoAction access", () => {
  it("redirects a signed-out user to sign-in before doing anything else", async () => {
    getCommunityAccessMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in"));

    await expect(analyzePhotoAction(IDLE, validForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(getCommunityAccessMock).toHaveBeenCalledTimes(1);
    expectNoWork();
  });

  it("checks membership through the US-1 guard with only the submitted communityId", async () => {
    await analyzePhotoAction(IDLE, validForm({ userId: "attacker-id", role: "ADMIN" }));

    expect(getCommunityAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({ params: { communityId: COMMUNITY_ID }, level: "member" }),
    );
  });

  it.each<[string, CommunityAccessResult]>([
    ["a non-member of the community", { decision: "not_found" }],
    ["an invalid or unknown communityId", { decision: "not_found" }],
  ])("returns the generic error for %s, with no upload, no Claude call, and no draft", async (_label, access) => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access });

    await expect(analyzePhotoAction(IDLE, validForm())).resolves.toStrictEqual(GENERIC_ERROR);
    expectNoWork();
  });
});

describe("analyzePhotoAction file validation", () => {
  it.each<[string, () => FormData, RegExp]>([
    ["a GIF", () => validForm({ photo: photoFile(GIF_BYTES, "drill.gif", "image/gif") }), /JPEG.*PNG|PNG.*JPEG/],
    ["a file of exactly 5 MB", () => validForm({ photo: photoFile(paddedPng(MAX_UPLOAD_BYTES)) }), /5 MB/],
    ["an empty file", () => validForm({ photo: photoFile(new Uint8Array(0)) }), /JPEG.*PNG|PNG.*JPEG/],
    ["a missing photo field", () => form({ communityId: COMMUNITY_ID }), /JPEG.*PNG|PNG.*JPEG/],
    ["text instead of a file", () => form({ communityId: COMMUNITY_ID, photo: "not a file" }), /JPEG.*PNG|PNG.*JPEG/],
  ])("rejects %s with the validation message, without uploading or calling Claude", async (_label, makeForm, message) => {
    const state = await analyzePhotoAction(IDLE, makeForm());

    expect(state).toStrictEqual({ status: "error", message: expect.stringMatching(message) });
    expectNoWork();
  });
});

describe("analyzePhotoAction with a valid photo", () => {
  it("uploads the photo, asks Claude, creates the draft, and returns the draft id and suggestion only", async () => {
    const state = await analyzePhotoAction(IDLE, validForm());

    expect(uploadImageMock).toHaveBeenCalledTimes(1);
    const uploaded = uploadImageMock.mock.calls[0]?.[0] as Buffer;
    expect(Buffer.isBuffer(uploaded) && uploaded.equals(PNG_BYTES)).toBe(true);
    expect(suggestListingMock).toHaveBeenCalledWith(expect.objectContaining({ mime: "image/png" }));
    expect(createDraftListingMock).toHaveBeenCalledWith(
      { id: SESSION_USER.id },
      expect.objectContaining({ communityId: COMMUNITY_ID, ...SUGGESTION, flagReason: null, photo: UPLOADED }),
    );
    expect(state).toStrictEqual({ status: "ready", draftId: DRAFT_ID, suggestion: SUGGESTION, manualEntry: false });
  });

  it("stores Claude's prohibited code as the draft's flagReason, never from the form, and keeps it out of the state", async () => {
    suggestListingMock.mockResolvedValue({ status: "ok", suggestion: SUGGESTION, prohibited: "WEAPON" });

    const state = await analyzePhotoAction(IDLE, validForm({ flagReason: "", status: "PUBLISHED", ownerId: "attacker-id" }));

    expect(createDraftListingMock).toHaveBeenCalledWith(
      { id: SESSION_USER.id },
      expect.objectContaining({ flagReason: "WEAPON" }),
    );
    expect(state).toStrictEqual({ status: "ready", draftId: DRAFT_ID, suggestion: SUGGESTION, manualEntry: false });
    expect(JSON.stringify(state)).not.toContain("WEAPON");
  });

  it("asks for manual entry and stores SAFETY_CHECK_FAILED when Claude failed", async () => {
    suggestListingMock.mockResolvedValue({ status: "failed" });

    const state = await analyzePhotoAction(IDLE, validForm());

    expect(createDraftListingMock).toHaveBeenCalledWith(
      { id: SESSION_USER.id },
      expect.objectContaining({ communityId: COMMUNITY_ID, flagReason: SAFETY_CHECK_FAILED, photo: UPLOADED }),
    );
    expect(state).toStrictEqual({ status: "ready", draftId: DRAFT_ID, suggestion: null, manualEntry: true });
    expect(JSON.stringify(state)).not.toContain(SAFETY_CHECK_FAILED);
  });
});

describe("analyzePhotoAction errors", () => {
  it("hides upload errors behind the generic message and creates no draft", async () => {
    uploadImageMock.mockRejectedValue(new Error("Cloudinary upload failed: Invalid API key cloudinary-secret-marker"));

    const state = await analyzePhotoAction(IDLE, validForm());

    expect(state).toStrictEqual(GENERIC_ERROR);
    expect(JSON.stringify(state)).not.toMatch(/Cloudinary|cloudinary-secret-marker/);
    expect(createDraftListingMock).not.toHaveBeenCalled();
  });

  it("hides database errors behind the generic message", async () => {
    createDraftListingMock.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432 password="secret"'));

    const state = await analyzePhotoAction(IDLE, validForm());

    expect(state).toStrictEqual(GENERIC_ERROR);
    expect(JSON.stringify(state)).not.toMatch(/ECONNREFUSED|secret|5432/);
  });

  it("returns the generic message when the draft layer finds no membership", async () => {
    createDraftListingMock.mockResolvedValue("not_found");

    await expect(analyzePhotoAction(IDLE, validForm())).resolves.toStrictEqual(GENERIC_ERROR);
  });
});
