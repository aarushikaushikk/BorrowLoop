import { beforeEach, describe, expect, it, vi } from "vitest";
import { joinCommunityAction, type JoinCommunityState } from "@/app/(app)/communities/actions";
import type { JoinCommunityResult } from "@/server/dal/memberships";

const { requireUserMock, joinMock, refreshMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn<(callbackPath?: unknown) => Promise<{ id: string; name: string | null; image: string | null }>>(),
  joinMock: vi.fn<(user: { id: string }, communityId: string) => Promise<JoinCommunityResult>>(),
  refreshMock: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({ requireUser: requireUserMock }));
vi.mock("@/server/dal/memberships", () => ({ joinCommunityAsMember: joinMock }));
vi.mock("next/cache", () => ({ refresh: refreshMock }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));

const SESSION_USER = { id: "session-user-id", name: "Member", image: null };
const COMMUNITY_ID = "clx0community0001";
const IDLE: JoinCommunityState = { status: "idle" };
const GENERIC_ERROR = { status: "error", message: "We couldn't join that community. Refresh the page and try again." };

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

beforeEach(() => {
  requireUserMock.mockReset();
  joinMock.mockReset();
  refreshMock.mockReset();
  requireUserMock.mockResolvedValue(SESSION_USER);
  joinMock.mockResolvedValue("joined");
});

describe("joinCommunityAction", () => {
  it("requires a session before reading the form, returning to /communities after sign-in", async () => {
    requireUserMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in?callbackUrl=%2Fcommunities"));

    await expect(joinCommunityAction(IDLE, form({ communityId: COMMUNITY_ID }))).rejects.toThrow("NEXT_REDIRECT");
    expect(requireUserMock).toHaveBeenCalledWith("/communities");
    expect(joinMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("joins the session user to the submitted community and refreshes the page", async () => {
    await expect(joinCommunityAction(IDLE, form({ communityId: COMMUNITY_ID }))).resolves.toEqual({ status: "joined" });

    expect(joinMock).toHaveBeenCalledWith({ id: SESSION_USER.id }, COMMUNITY_ID);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("never reads a client-supplied userId or role", async () => {
    await joinCommunityAction(
      IDLE,
      form({ communityId: COMMUNITY_ID, userId: "attacker-chosen-id", role: "ADMIN" }),
    );

    expect(joinMock).toHaveBeenCalledTimes(1);
    expect(joinMock).toHaveBeenCalledWith({ id: SESSION_USER.id }, COMMUNITY_ID);
  });

  it("treats an existing membership as success (idempotent)", async () => {
    joinMock.mockResolvedValue("already_member");

    await expect(joinCommunityAction(IDLE, form({ communityId: COMMUNITY_ID }))).resolves.toEqual({ status: "joined" });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an ID with a space", form({ communityId: "bad id" })],
    ["an empty ID", form({ communityId: "" })],
    ["an ID over 64 characters", form({ communityId: "a".repeat(65) })],
    ["a missing ID", form({})],
    ["a file instead of text", form({ communityId: new Blob(["x"]) })],
  ])("rejects %s without touching the database", async (_label, data) => {
    await expect(joinCommunityAction(IDLE, data)).resolves.toEqual(GENERIC_ERROR);
    expect(joinMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("reports a nonexistent community with the generic message", async () => {
    joinMock.mockResolvedValue("not_found");

    await expect(joinCommunityAction(IDLE, form({ communityId: COMMUNITY_ID }))).resolves.toEqual(GENERIC_ERROR);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("hides unexpected database errors behind the generic message", async () => {
    joinMock.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432 password="secret"'));

    const state = await joinCommunityAction(IDLE, form({ communityId: COMMUNITY_ID }));

    expect(state).toEqual(GENERIC_ERROR);
    expect(JSON.stringify(state)).not.toMatch(/ECONNREFUSED|secret|5432/);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
