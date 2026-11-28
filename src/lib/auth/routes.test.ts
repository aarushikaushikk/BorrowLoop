import { describe, expect, it } from "vitest";
import { COMMUNITIES_PATH, communityPathFor, itemPathFor, SIGN_IN_PATH, signInPathFor } from "@/lib/auth/routes";

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

describe("itemPathFor", () => {
  it("builds the item path from a valid community ID and item ID", () => {
    expect(itemPathFor({ communityId: "clx0community0001", itemId: "clx0item000000001" })).toBe(
      "/c/clx0community0001/items/clx0item000000001",
    );
  });

  it.each([
    [{ communityId: "clx0community0001", itemId: "bad id" }],
    [{ communityId: "clx0community0001", itemId: "../admin" }],
    [{ communityId: "//evil.example", itemId: "clx0item000000001" }],
    [{ communityId: "clx0community0001", itemId: "clx0item000000001", ownerId: "u1" }],
    [{ communityId: "clx0community0001" }],
    [null],
  ])("falls back to /communities for %j", (params) => {
    expect(itemPathFor(params)).toBe(COMMUNITIES_PATH);
  });
});
