import { describe, expect, it } from "vitest";
import { SIGN_IN_PATH, signInPathFor } from "@/lib/auth/routes";

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
