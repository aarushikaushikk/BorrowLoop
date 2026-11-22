import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const ORIGIN = "http://localhost:3000";

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
  ])("redirects an unauthenticated request for %s to sign-in", (path, expected) => {
    const response = proxy(requestFor(path));

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(`${ORIGIN}${expected}`);
  });

  it("redirects when only non-session Auth.js cookies are present", () => {
    const response = proxy(
      requestFor("/communities", { "authjs.csrf-token": "x", "authjs.callback-url": "y" }),
    );

    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/sign-in?callbackUrl=%2Fcommunities`);
  });

  it("never builds a callbackUrl that points to another origin", () => {
    const response = proxy(requestFor("//evil.example"));

    expect(getRedirectUrl(response)).toBe(`${ORIGIN}/sign-in?callbackUrl=%2Fcommunities`);
  });

  it.each([
    ["authjs.session-token"],
    ["__Secure-authjs.session-token"],
    ["authjs.session-token.0"],
  ])("lets a request with the %s cookie continue to server-side checks", (cookieName) => {
    const response = proxy(requestFor("/communities", { [cookieName]: "any-value" }));

    expect(getRedirectUrl(response)).toBeNull();
    expect(passesThrough(response)).toBe(true);
  });

  it.each(["/sign-in", "/api/auth/session"])(
    "never redirects the public path %s, even when called directly",
    (path) => {
      const response = proxy(requestFor(path));

      expect(getRedirectUrl(response)).toBeNull();
      expect(passesThrough(response)).toBe(true);
    },
  );
});
