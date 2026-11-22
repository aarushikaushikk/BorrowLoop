import { SIGN_IN_PATH } from "@/lib/auth/routes";

// Rules for the optimistic proxy check. No secrets and no `server-only`, so
// the proxy can import them.

const PUBLIC_PATH_PREFIXES = [SIGN_IN_PATH, "/api/auth"] as const;

/** Paths reachable without a session: the sign-in page and Auth.js routes. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Auth.js session cookie names, from @auth/core's default cookies:
// `authjs.session-token`, with a `__Secure-` prefix over HTTPS. Large values
// are split into chunks named `<name>.0`, `<name>.1`, and so on.
const SESSION_COOKIE_NAME = /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/;

/**
 * Whether an Auth.js session cookie is present. This says nothing about
 * whether the session is valid: that's checked on the server by `auth()`.
 */
export function hasSessionCookie(cookieNames: readonly string[]): boolean {
  return cookieNames.some((name) => SESSION_COOKIE_NAME.test(name));
}
