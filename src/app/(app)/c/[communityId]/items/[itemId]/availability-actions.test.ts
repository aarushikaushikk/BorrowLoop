import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBlockedRangeAction,
  removeBlockedRangeAction,
  type AddBlockedRangeState,
  type RemoveBlockedRangeState,
} from "@/app/(app)/c/[communityId]/items/[itemId]/actions";
import { BLOCKED_RANGE_MESSAGES, type BlockedRange } from "@/lib/validation/availability";
import type { CommunityAccessResult } from "@/server/auth/guards";

const { getCommunityAccessMock, addMock, removeMock, refreshMock } = vi.hoisted(() => ({
  getCommunityAccessMock: vi.fn<
    (input: { params: unknown; level: "member" | "admin"; callbackPath: string }) => Promise<{
      user: { id: string; name: string | null; image: string | null };
      access: CommunityAccessResult;
    }>
  >(),
  addMock: vi.fn<
    (user: { id: string }, input: { communityId: string; itemId: string; range: BlockedRange }) => Promise<
      { id: string } | "not_found"
    >
  >(),
  removeMock: vi.fn<
    (user: { id: string }, input: { communityId: string; availabilityId: string }) => Promise<"removed" | "not_found">
  >(),
  refreshMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/community-access", () => ({ getCommunityAccess: getCommunityAccessMock }));
vi.mock("@/server/dal/availability", () => ({ addBlockedRange: addMock, removeBlockedRange: removeMock }));
vi.mock("next/cache", () => ({ refresh: refreshMock }));

const SESSION_USER = { id: "session-user-id", name: "Lender", image: null };
const COMMUNITY_ID = "clx0community0001";
const ITEM_ID = "clx0item000000001";
const BLOCK_ID = "clx0block00000001";
const ALLOW = { decision: "allow", communityId: COMMUNITY_ID } as const;

const ADD_FAILED = "We couldn't block those dates. Refresh the page and try again.";
const REMOVE_FAILED = "We couldn't remove those dates. Refresh the page and try again.";
const FIX_FIELDS = "Please fix the highlighted fields.";

const ADD_IDLE: AddBlockedRangeState = { status: "idle" };
const REMOVE_IDLE: RemoveBlockedRangeState = { status: "idle" };

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

function addForm(overrides: Record<string, string | Blob> = {}): FormData {
  return form({
    communityId: COMMUNITY_ID,
    itemId: ITEM_ID,
    startDate: "2026-12-01",
    endDate: "2026-12-03",
    note: "  Away  ",
    ...overrides,
  });
}

function removeForm(overrides: Record<string, string | Blob> = {}): FormData {
  return form({ communityId: COMMUNITY_ID, availabilityId: BLOCK_ID, ...overrides });
}

beforeEach(() => {
  // Only Date is faked: "today" comes from the clock, in UTC.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-27T23:59:00.000Z"));
  getCommunityAccessMock.mockReset();
  addMock.mockReset();
  removeMock.mockReset();
  refreshMock.mockReset();
  getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: ALLOW });
  addMock.mockResolvedValue({ id: "block-new" });
  removeMock.mockResolvedValue("removed");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("addBlockedRangeAction: authentication and authorization", () => {
  it("requires a session before anything else, returning to /communities after sign-in", async () => {
    getCommunityAccessMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in?callbackUrl=%2Fcommunities"));

    await expect(addBlockedRangeAction(ADD_IDLE, addForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(addMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("checks member access with only the submitted communityId, ignoring client-supplied identity fields", async () => {
    await addBlockedRangeAction(ADD_IDLE, addForm({ ownerId: "attacker", userId: "attacker", role: "ADMIN" }));

    expect(getCommunityAccessMock).toHaveBeenCalledWith({
      params: { communityId: COMMUNITY_ID },
      level: "member",
      callbackPath: "/communities",
    });
  });

  it.each([
    ["a non-member (not_found)", { decision: "not_found" } as const],
    ["a forbidden decision", { decision: "forbidden" } as const],
  ])("returns the generic error for %s without validating or writing", async (_label, access) => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access });

    // Invalid dates too: a non-member never learns about field rules.
    await expect(addBlockedRangeAction(ADD_IDLE, addForm({ startDate: "nope" }))).resolves.toEqual({
      status: "error",
      message: ADD_FAILED,
    });
    expect(addMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("passes the session user, never a submitted ownerId or userId, to the data layer", async () => {
    await addBlockedRangeAction(ADD_IDLE, addForm({ ownerId: "attacker", userId: "attacker" }));

    expect(addMock).toHaveBeenCalledTimes(1);
    const [user, input] = addMock.mock.calls[0];
    expect(user).toEqual({ id: SESSION_USER.id });
    expect(JSON.stringify(input)).not.toContain("attacker");
  });
});

describe("addBlockedRangeAction: validation", () => {
  it.each([
    ["missing", null],
    ["a path traversal attempt", "../other-item"],
    ["too long", "a".repeat(65)],
  ])("returns the generic error when the itemId is %s", async (_label, itemId) => {
    const data = addForm();
    data.delete("itemId");
    if (itemId !== null) data.append("itemId", itemId);

    await expect(addBlockedRangeAction(ADD_IDLE, data)).resolves.toEqual({ status: "error", message: ADD_FAILED });
    expect(addMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("returns field errors for a start date before today (UTC) without writing", async () => {
    await expect(
      addBlockedRangeAction(ADD_IDLE, addForm({ startDate: "2026-11-26", endDate: "2026-11-30" })),
    ).resolves.toEqual({
      status: "error",
      message: FIX_FIELDS,
      fieldErrors: { startDate: BLOCKED_RANGE_MESSAGES.startDatePast },
    });
    expect(addMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("accepts a range starting today (UTC) at 23:59", async () => {
    await expect(
      addBlockedRangeAction(ADD_IDLE, addForm({ startDate: "2026-11-27", endDate: "2026-11-27" })),
    ).resolves.toEqual({ status: "added" });
  });

  it("treats yesterday as past once the UTC day has rolled over", async () => {
    vi.setSystemTime(new Date("2026-11-28T00:00:00.000Z"));

    await expect(
      addBlockedRangeAction(ADD_IDLE, addForm({ startDate: "2026-11-27", endDate: "2026-11-30" })),
    ).resolves.toEqual({
      status: "error",
      message: FIX_FIELDS,
      fieldErrors: { startDate: BLOCKED_RANGE_MESSAGES.startDatePast },
    });
    expect(addMock).not.toHaveBeenCalled();
  });

  it("returns field errors for a reversed range, an impossible date, and an over-long note", async () => {
    await expect(
      addBlockedRangeAction(ADD_IDLE, addForm({ startDate: "2027-02-29", endDate: "2026-12-01", note: "n".repeat(201) })),
    ).resolves.toEqual({
      status: "error",
      message: FIX_FIELDS,
      fieldErrors: {
        startDate: BLOCKED_RANGE_MESSAGES.startDateInvalid,
        note: BLOCKED_RANGE_MESSAGES.noteTooLong,
      },
    });
    await expect(
      addBlockedRangeAction(ADD_IDLE, addForm({ startDate: "2026-12-05", endDate: "2026-12-04" })),
    ).resolves.toEqual({
      status: "error",
      message: FIX_FIELDS,
      fieldErrors: { endDate: BLOCKED_RANGE_MESSAGES.endDateBeforeStart },
    });
    expect(addMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("returns field errors when the date fields are missing", async () => {
    const data = addForm();
    data.delete("startDate");
    data.delete("endDate");

    await expect(addBlockedRangeAction(ADD_IDLE, data)).resolves.toEqual({
      status: "error",
      message: FIX_FIELDS,
      fieldErrors: {
        startDate: BLOCKED_RANGE_MESSAGES.startDateInvalid,
        endDate: BLOCKED_RANGE_MESSAGES.endDateInvalid,
      },
    });
    expect(addMock).not.toHaveBeenCalled();
  });
});

describe("addBlockedRangeAction: outcome", () => {
  it("adds the validated range for the authorized community and item, then refreshes once", async () => {
    await expect(addBlockedRangeAction(ADD_IDLE, addForm())).resolves.toEqual({ status: "added" });

    expect(addMock).toHaveBeenCalledWith(
      { id: SESSION_USER.id },
      {
        communityId: COMMUNITY_ID,
        itemId: ITEM_ID,
        range: { startDate: "2026-12-01", endDate: "2026-12-03", note: "Away" },
      },
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("uses the community ID returned by the access check", async () => {
    getCommunityAccessMock.mockResolvedValue({
      user: SESSION_USER,
      access: { decision: "allow", communityId: "clx0community0002" },
    });

    await addBlockedRangeAction(ADD_IDLE, addForm());

    expect(addMock).toHaveBeenCalledWith(
      { id: SESSION_USER.id },
      expect.objectContaining({ communityId: "clx0community0002" }),
    );
  });

  it("returns the generic error, without refreshing, when the item isn't the user's own PUBLISHED item", async () => {
    addMock.mockResolvedValue("not_found");

    await expect(addBlockedRangeAction(ADD_IDLE, addForm())).resolves.toEqual({ status: "error", message: ADD_FAILED });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("returns the generic error, with no internal details, when the data layer throws", async () => {
    addMock.mockRejectedValue(new Error('P2034 write conflict on "Membership" at postgres://internal'));

    await expect(addBlockedRangeAction(ADD_IDLE, addForm())).resolves.toEqual({ status: "error", message: ADD_FAILED });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("removeBlockedRangeAction: authentication and authorization", () => {
  it("requires a session before anything else", async () => {
    getCommunityAccessMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in?callbackUrl=%2Fcommunities"));

    await expect(removeBlockedRangeAction(REMOVE_IDLE, removeForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(removeMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("checks member access with only the submitted communityId", async () => {
    await removeBlockedRangeAction(REMOVE_IDLE, removeForm({ ownerId: "attacker", role: "ADMIN" }));

    expect(getCommunityAccessMock).toHaveBeenCalledWith({
      params: { communityId: COMMUNITY_ID },
      level: "member",
      callbackPath: "/communities",
    });
  });

  it("returns the generic error for a non-member without writing", async () => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: { decision: "not_found" } });

    await expect(removeBlockedRangeAction(REMOVE_IDLE, removeForm())).resolves.toEqual({
      status: "error",
      message: REMOVE_FAILED,
    });
    expect(removeMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null],
    ["a path traversal attempt", "../other-block"],
    ["empty", ""],
  ])("returns the generic error when the availabilityId is %s", async (_label, availabilityId) => {
    const data = removeForm();
    data.delete("availabilityId");
    if (availabilityId !== null) data.append("availabilityId", availabilityId);

    await expect(removeBlockedRangeAction(REMOVE_IDLE, data)).resolves.toEqual({
      status: "error",
      message: REMOVE_FAILED,
    });
    expect(removeMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("removeBlockedRangeAction: outcome", () => {
  it("removes the block for the session user and authorized community, then refreshes once", async () => {
    await expect(removeBlockedRangeAction(REMOVE_IDLE, removeForm({ userId: "attacker" }))).resolves.toEqual({
      status: "removed",
    });

    expect(removeMock).toHaveBeenCalledWith({ id: SESSION_USER.id }, { communityId: COMMUNITY_ID, availabilityId: BLOCK_ID });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("returns the generic error, without refreshing, when the block isn't on the user's own PUBLISHED item", async () => {
    removeMock.mockResolvedValue("not_found");

    await expect(removeBlockedRangeAction(REMOVE_IDLE, removeForm())).resolves.toEqual({
      status: "error",
      message: REMOVE_FAILED,
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("returns the generic error, with no internal details, when the data layer throws", async () => {
    removeMock.mockRejectedValue(new Error("connection terminated unexpectedly"));

    await expect(removeBlockedRangeAction(REMOVE_IDLE, removeForm())).resolves.toEqual({
      status: "error",
      message: REMOVE_FAILED,
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
