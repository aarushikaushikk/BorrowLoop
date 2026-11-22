import { describe, expect, it } from "vitest";
import { hasSessionCookie, isPublicPath } from "@/lib/auth/proxy-rules";

describe("isPublicPath", () => {
  it.each(["/sign-in", "/sign-in/", "/api/auth", "/api/auth/session", "/api/auth/callback/google"])(
    "treats %s as public",
    (pathname) => {
      expect(isPublicPath(pathname)).toBe(true);
    },
  );

  it.each([
    "/",
    "/communities",
    "/c/clx0community0001",
    "/c/clx0community0001/admin",
    "/sign-in-later",
    "/api/authx",
    "/api/other",
    "/SIGN-IN",
  ])("treats %s as protected", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("hasSessionCookie", () => {
  it.each([
    [["authjs.session-token"]],
    [["__Secure-authjs.session-token"]],
    [["authjs.session-token.0", "authjs.session-token.1"]],
    [["__Secure-authjs.session-token.0"]],
    [["authjs.csrf-token", "authjs.session-token"]],
  ])("detects an Auth.js session cookie in %j", (names) => {
    expect(hasSessionCookie(names)).toBe(true);
  });

  it.each([
    [[]],
    [["authjs.csrf-token", "authjs.callback-url"]],
    [["__Host-authjs.csrf-token"]],
    [["next-auth.session-token"]],
    [["authjs.session-token.x"]],
    [["xauthjs.session-token"]],
    [["authjs.session-token-fake"]],
  ])("finds no session cookie in %j", (names) => {
    expect(hasSessionCookie(names)).toBe(false);
  });
});
