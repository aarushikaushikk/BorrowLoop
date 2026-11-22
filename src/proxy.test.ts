import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MembershipSnapshot } from "@/server/domain/access";
import { config, proxy } from "@/proxy";

vi.mock("server-only", () => ({}));

const { getCurrentUserMock, getMembershipMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn<() => Promise<{ id: string; name: string | null; image: string | null } | null>>(),
  getMembershipMock: vi.fn<(userId: string, communityId: string) => Promise<MembershipSnapshot | null>>(),
}));

vi.mock("@/server/auth/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/dal/memberships", () => ({
  createMembershipLookup: () => ({ getMembership: getMembershipMock }),
}));

const ORIGIN = "http://localhost:3000";
const COMMUNITY_ID = "clx0community0001";
const SESSION_USER = { id: "session-user-id", name: "Member", image: null };
const SESSION_COOKIE = { "authjs.session-token": "any-value" };

beforeEach(() => {
  getCurrentUserMock.mockReset();
  getMembershipMock.mockReset();
  getCurrentUserMock.mockResolvedValue(SESSION_USER);
  getMembershipMock.mockResolvedValue(null);
});

function requestFor(path: string, cookies: Record<string, string> = {}) {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

function passesThrough(response: Response) {
  return response.headers.get("x-middleware-next") === "1";
}

describe("proxy matcher", () => {
  it.each([
    "/",
    "/communities",
    "/c/clx0community0001",
    "/c/clx0community0001/admin",
    "/sign-in-later",
    "/api/authx",
    "/api/other",
  ])("runs on the protected path %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each([
    "/sign-in",
    "/sign-in?callbackUrl=%2Fcommunities",
    "/api/auth/session",
    "/api/auth/callback/google",
    "/api/auth/signin/google",
    "/_next/static/chunks/main.js",
    "/_next/image?url=%2Fnext.svg&w=64&q=75",
    "/favicon.ico",
    "/next.svg",
    "/robots.txt",
  ])("skips the public path or static asset %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

describe("proxy", () => {
  it.each([
    ["/", "/sign-in?callbackUrl=%2F"],
    ["/communities", "/sign-in?callbackUrl=%2Fcommunities"],
    ["/communities?tab=mine", "/sign-in?callbackUrl=%2Fcommunities%3Ftab%3Dmine"],
    ["/c/clx0community0001/admin", "/sign-in?callbackUrl=%2Fc%2Fclx0community0001%2Fadmin"],
  ])("redirects an unauthenticated request for %s to sign-in", async (path, expected) => {
    const response = await proxy(requestFor(path));

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(`${ORIGIN}${expected}`);
  });

  it("redirects when only non-session Auth.js cookies are present", async () => {
    const response = await proxy(
      requestFor("/communities", { "authjs.csrf-token": "x", "authjs.callback-url": "y" }),
    );

    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/sign-in?callbackUrl=%2Fcommunities`);
  });

  it("never builds a callbackUrl that points to another origin", async () => {
    const response = await proxy(requestFor("//evil.example"));

    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/sign-in?callbackUrl=%2Fcommunities`);
  });

  it.each([
    ["authjs.session-token"],
    ["__Secure-authjs.session-token"],
    ["authjs.session-token.0"],
  ])("lets a request with the %s cookie continue to server-side checks", async (cookieName) => {
    const response = await proxy(requestFor("/communities", { [cookieName]: "any-value" }));

    expect(getRedirectUrl(response)).toBeNull();
    expect(passesThrough(response)).toBe(true);
  });

  it.each(["/sign-in", "/api/auth/session"])(
    "never redirects the public path %s, even when called directly",
    async (path) => {
      const response = await proxy(requestFor(path));

      expect(getRedirectUrl(response)).toBeNull();
      expect(passesThrough(response)).toBe(true);
    },
  );
});

describe("proxy community authorization", () => {
  it("does no session or database work outside community paths", async () => {
    const response = await proxy(requestFor("/communities", SESSION_COOKIE));

    expect(passesThrough(response)).toBe(true);
    expect(getCurrentUserMock).not.toHaveBeenCalled();
    expect(getMembershipMock).not.toHaveBeenCalled();
  });

  it("redirects a community request without a session cookie, without verifying anything", async () => {
    const response = await proxy(requestFor(`/c/${COMMUNITY_ID}`));

    expect(response.status).toBe(307);
    expect(getCurrentUserMock).not.toHaveBeenCalled();
  });

  it("redirects to sign-in when the session cookie doesn't verify", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await proxy(requestFor(`/c/${COMMUNITY_ID}/admin`, SESSION_COOKIE));

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/sign-in?callbackUrl=${encodeURIComponent(`/c/${COMMUNITY_ID}/admin`)}`);
    expect(getMembershipMock).not.toHaveBeenCalled();
  });

  it.each([
    ["member page", `/c/${COMMUNITY_ID}`, "member", null, 404],
    ["member page", `/c/${COMMUNITY_ID}`, "member", { role: "MEMBER", status: "ACTIVE" }, "next"],
    ["member page", `/c/${COMMUNITY_ID}/items/1`, "admin", { role: "ADMIN", status: "ACTIVE" }, "next"],
    ["admin page", `/c/${COMMUNITY_ID}/admin`, "non-member", null, 404],
    ["admin page", `/c/${COMMUNITY_ID}/admin`, "member", { role: "MEMBER", status: "ACTIVE" }, 403],
    ["admin page", `/c/${COMMUNITY_ID}/admin/reports`, "member", { role: "MEMBER", status: "ACTIVE" }, 403],
    ["admin page", `/c/${COMMUNITY_ID}/admin`, "admin", { role: "ADMIN", status: "ACTIVE" }, "next"],
  ] as const)("on a %s (%s) answers a %s with %s", async (_page, path, _who, membership, expected) => {
    getMembershipMock.mockResolvedValue(membership);

    const response = await proxy(requestFor(path, SESSION_COOKIE));

    if (expected === "next") {
      expect(passesThrough(response)).toBe(true);
    } else {
      expect(response.status).toBe(expected);
      expect(passesThrough(response)).toBe(false);
    }
  });

  it("looks up the session user's membership in the community from the path", async () => {
    await proxy(requestFor(`/c/${COMMUNITY_ID}/admin?userId=attacker&role=ADMIN`, SESSION_COOKIE));

    expect(getMembershipMock).toHaveBeenCalledTimes(1);
    expect(getMembershipMock).toHaveBeenCalledWith(SESSION_USER.id, COMMUNITY_ID);
  });

  it.each(["/c", "/c/", "/c/bad%20id", "/c/a.b", `/c/${COMMUNITY_ID}/admin%2Freports`, `/c/${COMMUNITY_ID}//admin`])(
    "answers the malformed community path %s with 404 before any lookup",
    async (path) => {
      const response = await proxy(requestFor(path, SESSION_COOKIE));

      expect(response.status).toBe(404);
      expect(getCurrentUserMock).not.toHaveBeenCalled();
      expect(getMembershipMock).not.toHaveBeenCalled();
    },
  );

  it("returns identical 404 bodies whatever the reason, with no-store and noindex", async () => {
    const malformed = await proxy(requestFor("/c/bad%20id", SESSION_COOKIE));
    const nonMember = await proxy(requestFor(`/c/${COMMUNITY_ID}`, SESSION_COOKIE));

    expect(await malformed.text()).toBe(await nonMember.text());
    expect(nonMember.headers.get("cache-control")).toBe("no-store");
    expect(nonMember.headers.get("x-robots-tag")).toBe("noindex");
    expect(nonMember.headers.get("content-type")).toMatch(/^text\/html/);
  });

  it("returns a 403 page that names no community or user", async () => {
    getMembershipMock.mockResolvedValue({ role: "MEMBER", status: "ACTIVE" });

    const response = await proxy(requestFor(`/c/${COMMUNITY_ID}/admin`, SESSION_COOKIE));
    const body = await response.text();

    expect(response.status).toBe(403);
    expect(body).toContain("Only community admins can open this page.");
    expect(body).not.toContain(COMMUNITY_ID);
    expect(body).not.toContain(SESSION_USER.id);
  });
});
