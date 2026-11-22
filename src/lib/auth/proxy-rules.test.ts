import { describe, expect, it } from "vitest";
import { hasSessionCookie, isPublicPath, matchCommunityPath } from "@/lib/auth/proxy-rules";

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

describe("matchCommunityPath", () => {
  const ID = "clx0community0001";

  it.each([
    "/",
    "/communities",
    "/communities/",
    "/sign-in",
    "/api/auth/session",
    "/api/c/abc",
    "/cx/abc",
    "/c-abc",
    "/C/abc",
  ])("ignores %s, which is not a community route", (pathname) => {
    expect(matchCommunityPath(pathname)).toEqual({ kind: "none" });
  });

  it.each([
    ["/c/abc", "abc"],
    ["/c/abc/", "abc"],
    [`/c/${ID}`, ID],
    [`/c/${ID}/items`, ID],
    [`/c/${ID}/items/123`, ID],
    [`/c/${ID}/loans/abc/chat`, ID],
    [`/c/${ID}/administrator`, ID],
    [`/c/${ID}/admins`, ID],
    [`/c/${ID}/items/admin`, ID],
    ["/c/ab%63", "abc"],
  ])("treats %s as a member page of community %s", (pathname, communityId) => {
    expect(matchCommunityPath(pathname)).toEqual({ kind: "community", communityId, level: "member" });
  });

  it.each([
    `/c/${ID}/admin`,
    `/c/${ID}/admin/`,
    `/c/${ID}/admin/reports`,
    `/c/${ID}/admin/reports/1`,
    `/c/${ID}/ADMIN`,
    `/c/${ID}/Admin/members`,
    `/c/${ID}/%61dmin`,
    `/c/${ID}/%41DMIN`,
  ])("treats %s as an admin page (fails closed on case and encoding)", (pathname) => {
    expect(matchCommunityPath(pathname)).toEqual({ kind: "community", communityId: ID, level: "admin" });
  });

  it.each([
    ["the bare prefix", "/c"],
    ["the prefix with a trailing slash", "/c/"],
    ["an empty community ID", "/c//admin"],
    ["an ID with a space", "/c/bad%20id"],
    ["an ID with a dot", "/c/a.b"],
    ["an ID with an encoded slash", "/c/abc%2Fadmin"],
    ["an ID over 64 characters", `/c/${"a".repeat(65)}`],
    ["a dot-dot ID", "/c/%2E%2E"],
    ["an empty segment after the ID", `/c/${ID}//admin`],
    ["an empty segment deeper in the path", `/c/${ID}/admin//reports`],
    ["a double trailing slash", `/c/${ID}//`],
    ["an encoded dot segment", `/c/${ID}/%2e/admin`],
    ["an encoded dot-dot segment", `/c/${ID}/%2e%2e/admin`],
    ["malformed percent-encoding in the ID", "/c/%E0%A4%A"],
    ["malformed percent-encoding after the ID", `/c/${ID}/%zz`],
    ["a path over 2048 characters", `/c/${ID}/items/${"x".repeat(2048)}`],
  ])("rejects %s as invalid", (_description, pathname) => {
    expect(matchCommunityPath(pathname)).toEqual({ kind: "invalid" });
  });

  it.each([
    ["an encoded slash in the ID (lowercase)", "/c/abc%2fadmin"],
    ["an encoded backslash in the ID", "/c/abc%5Cadmin"],
    ["an encoded backslash in the ID (lowercase)", "/c/abc%5cadmin"],
    ["an encoded slash joining admin to a subpath", `/c/${ID}/admin%2Freports`],
    ["an encoded slash that would hide admin", `/c/${ID}/items%2F..%2Fadmin`],
    ["an encoded slash as a whole segment", `/c/${ID}/%2F/admin`],
    ["an encoded slash deeper in the path", `/c/${ID}/items/a%2fb`],
    ["an encoded backslash joining admin to a subpath", `/c/${ID}/admin%5Creports`],
    ["an encoded backslash that would hide admin", `/c/${ID}/items%5C..%5Cadmin`],
    ["an encoded backslash deeper in the path", `/c/${ID}/items/a%5cb`],
    ["a raw backslash in a segment", `/c/${ID}/admin\\reports`],
  ])("rejects %s, a path separator inside a segment, as invalid", (_description, pathname) => {
    expect(matchCommunityPath(pathname)).toEqual({ kind: "invalid" });
  });

  it("returns only the kind, the validated community ID, and the level", () => {
    expect(Object.keys(matchCommunityPath(`/c/${ID}/admin/reports/1`)).sort()).toEqual([
      "communityId",
      "kind",
      "level",
    ]);
  });
});
