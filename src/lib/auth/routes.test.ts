import { describe, expect, it } from "vitest";
import { COMMUNITIES_PATH, communityPathFor, SIGN_IN_PATH, signInPathFor } from "@/lib/auth/routes";

describe("signInPathFor", () => {
  it("uses /sign-in as the sign-in route", () => {
    expect(SIGN_IN_PATH).toBe("/sign-in");
  });

  it.each([
    ["/", "/sign-in?callbackUrl=%2F"],
    ["/communities", "/sign-in?callbackUrl=%2Fcommunities"],
    ["/c/clx0community0001?tab=items", "/sign-in?callbackUrl=%2Fc%2Fclx0community0001%3Ftab%3Ditems"],
  ])("preserves the safe internal destination %s", (callbackPath, expected) => {
    expect(signInPathFor(callbackPath)).toBe(expected);
  });

  it.each([
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a missing value", undefined],
  ])("falls back to /communities for %s", (_label, callbackPath) => {
    expect(signInPathFor(callbackPath)).toBe("/sign-in?callbackUrl=%2Fcommunities");
  });
});

describe("communityPathFor", () => {
  it("builds the community and admin paths from a valid ID", () => {
    expect(communityPathFor({ communityId: "clx0community0001" })).toBe("/c/clx0community0001");
    expect(communityPathFor({ communityId: "clx0community0001" }, "/admin")).toBe("/c/clx0community0001/admin");
  });

  it.each([
    [{ communityId: "bad id" }],
    [{ communityId: "//evil.example" }],
    [{ communityId: "x", userId: "y" }],
    [{}],
    [null],
    ["clx0community0001"],
  ])("falls back to /communities for %j", (params) => {
    expect(communityPathFor(params, "/admin")).toBe(COMMUNITIES_PATH);
  });
});
