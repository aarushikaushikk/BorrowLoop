import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MembershipSnapshot } from "@/server/domain/access";
import { getCommunityAccess } from "@/server/auth/community-access";

vi.mock("server-only", () => ({}));

const { requireUserMock, getMembershipMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn<(callbackPath?: unknown) => Promise<{ id: string; name: string | null; image: string | null }>>(),
  getMembershipMock: vi.fn<(userId: string, communityId: string) => Promise<MembershipSnapshot | null>>(),
}));

vi.mock("@/server/auth/session", () => ({ requireUser: requireUserMock }));
vi.mock("@/server/dal/memberships", () => ({
  createMembershipLookup: () => ({ getMembership: getMembershipMock }),
}));

const SESSION_USER = { id: "session-user-id", name: "Session User", image: null };
const COMMUNITY_ID = "clx0community0001";

beforeEach(() => {
  requireUserMock.mockReset();
  getMembershipMock.mockReset();
  requireUserMock.mockResolvedValue(SESSION_USER);
});

describe("getCommunityAccess", () => {
  it("requires a session first, returning to the given path after sign-in", async () => {
    requireUserMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in?callbackUrl=%2Fc%2Fclx0community0001"));

    await expect(
      getCommunityAccess({ params: { communityId: COMMUNITY_ID }, level: "member", callbackPath: `/c/${COMMUNITY_ID}` }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(requireUserMock).toHaveBeenCalledWith(`/c/${COMMUNITY_ID}`);
    expect(getMembershipMock).not.toHaveBeenCalled();
  });

  it("looks up the membership for the session user's ID", async () => {
    getMembershipMock.mockResolvedValue({ role: "MEMBER", status: "ACTIVE" });

    const result = await getCommunityAccess({
      params: { communityId: COMMUNITY_ID },
      level: "member",
      callbackPath: `/c/${COMMUNITY_ID}`,
    });

    expect(getMembershipMock).toHaveBeenCalledWith(SESSION_USER.id, COMMUNITY_ID);
    expect(result).toEqual({ user: SESSION_USER, access: { decision: "allow", communityId: COMMUNITY_ID } });
  });

  it.each([
    ["a client-supplied userId", { communityId: COMMUNITY_ID, userId: "attacker-chosen-id" }],
    ["a client-supplied role", { communityId: COMMUNITY_ID, role: "ADMIN" }],
    ["an invalid community ID", { communityId: "bad id" }],
    ["a missing community ID", {}],
    ["non-object params", "clx0community0001"],
  ])("rejects %s as not_found without a lookup", async (_description, params) => {
    const result = await getCommunityAccess({ params, level: "member", callbackPath: "/communities" });

    expect(result.access).toEqual({ decision: "not_found" });
    expect(getMembershipMock).not.toHaveBeenCalled();
  });

  it.each([
    ["member", null, "not_found"],
    ["member", { role: "MEMBER", status: "ACTIVE" }, "allow"],
    ["member", { role: "ADMIN", status: "ACTIVE" }, "allow"],
    ["admin", null, "not_found"],
    ["admin", { role: "MEMBER", status: "ACTIVE" }, "forbidden"],
    ["admin", { role: "ADMIN", status: "ACTIVE" }, "allow"],
  ] as const)("at %s level with membership %j decides %s", async (level, membership, decision) => {
    getMembershipMock.mockResolvedValue(membership);

    const { access } = await getCommunityAccess({
      params: { communityId: COMMUNITY_ID },
      level,
      callbackPath: `/c/${COMMUNITY_ID}`,
    });

    expect(access.decision).toBe(decision);
  });
});
