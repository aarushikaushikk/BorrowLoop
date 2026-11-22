import { describe, expect, it, vi } from "vitest";
import { authorizeCommunity } from "@/server/auth/guards";
import type { MembershipLookup } from "@/server/auth/membership";
import type { MembershipSnapshot } from "@/server/domain/access";

vi.mock("server-only", () => ({}));

const SESSION_USER = { id: "session-user-1" };
const COMMUNITY_ID = "clx0community0001";

function fakeLookup(membership: MembershipSnapshot | null) {
  const getMembership = vi.fn<MembershipLookup["getMembership"]>(
    async () => membership,
  );
  const lookup: MembershipLookup = { getMembership };
  return { lookup, getMembership };
}

describe("authorizeCommunity", () => {
  it("looks up membership with the authenticated user's ID and the validated community ID", async () => {
    const { lookup, getMembership } = fakeLookup({ role: "MEMBER", status: "ACTIVE" });

    await authorizeCommunity(
      { user: SESSION_USER, params: { communityId: COMMUNITY_ID }, level: "member" },
      lookup,
    );

    expect(getMembership).toHaveBeenCalledTimes(1);
    expect(getMembership).toHaveBeenCalledWith(SESSION_USER.id, COMMUNITY_ID);
  });

  it("rejects client-supplied user IDs instead of passing them to the lookup", async () => {
    const { lookup, getMembership } = fakeLookup({ role: "ADMIN", status: "ACTIVE" });

    const result = await authorizeCommunity(
      {
        user: SESSION_USER,
        params: { communityId: COMMUNITY_ID, userId: "attacker-user" },
        level: "admin",
      },
      lookup,
    );

    expect(result).toEqual({ decision: "not_found" });
    expect(getMembership).not.toHaveBeenCalled();
  });

  it.each([
    ["an empty string", { communityId: "" }],
    ["a path traversal attempt", { communityId: "../other-community" }],
    ["a non-string value", { communityId: 42 }],
    ["a missing community ID", {}],
    ["a non-object params value", "clx0community0001"],
    ["null params", null],
  ])("treats %s as not found without querying membership", async (_label, params) => {
    const { lookup, getMembership } = fakeLookup({ role: "ADMIN", status: "ACTIVE" });

    const result = await authorizeCommunity(
      { user: SESSION_USER, params, level: "member" },
      lookup,
    );

    expect(result).toEqual({ decision: "not_found" });
    expect(getMembership).not.toHaveBeenCalled();
  });

  it("allows an active member at member level and returns the validated community ID", async () => {
    const { lookup } = fakeLookup({ role: "MEMBER", status: "ACTIVE" });

    const result = await authorizeCommunity(
      { user: SESSION_USER, params: { communityId: COMMUNITY_ID }, level: "member" },
      lookup,
    );

    expect(result).toEqual({ decision: "allow", communityId: COMMUNITY_ID });
  });

  it("forbids an active member at admin level", async () => {
    const { lookup } = fakeLookup({ role: "MEMBER", status: "ACTIVE" });

    const result = await authorizeCommunity(
      { user: SESSION_USER, params: { communityId: COMMUNITY_ID }, level: "admin" },
      lookup,
    );

    expect(result).toEqual({ decision: "forbidden" });
  });

  it("allows an active admin at admin level", async () => {
    const { lookup } = fakeLookup({ role: "ADMIN", status: "ACTIVE" });

    const result = await authorizeCommunity(
      { user: SESSION_USER, params: { communityId: COMMUNITY_ID }, level: "admin" },
      lookup,
    );

    expect(result).toEqual({ decision: "allow", communityId: COMMUNITY_ID });
  });

  it("treats a non-member as not found at admin level", async () => {
    const { lookup } = fakeLookup(null);

    const result = await authorizeCommunity(
      { user: SESSION_USER, params: { communityId: COMMUNITY_ID }, level: "admin" },
      lookup,
    );

    expect(result).toEqual({ decision: "not_found" });
  });

  it("treats a suspended member as not found", async () => {
    const { lookup } = fakeLookup({ role: "MEMBER", status: "SUSPENDED" });

    const result = await authorizeCommunity(
      { user: SESSION_USER, params: { communityId: COMMUNITY_ID }, level: "member" },
      lookup,
    );

    expect(result).toEqual({ decision: "not_found" });
  });
});
