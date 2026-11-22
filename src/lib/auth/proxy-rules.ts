import { SIGN_IN_PATH } from "@/lib/auth/routes";
import { communityIdSchema } from "@/lib/validation/community";

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

/** Community-scoped routes live under `/c/<communityId>/...`. */
export const COMMUNITY_ROUTE_PREFIX = "/c";

const ADMIN_SEGMENT = "admin";
const MAX_PATH_LENGTH = 2048;
/** A decoded segment containing either separator could be read as several segments. */
const PATH_SEPARATOR = /[/\\]/;

/**
 * The access a community route needs. Mirrors `AccessLevel` in
 * `src/server/domain/access.ts`, which can't be imported here because it's
 * server-only and the proxy imports this module.
 */
export type CommunityRouteLevel = "member" | "admin";

export type CommunityRouteMatch =
  /** Not a community route. */
  | { kind: "none" }
  /** Under `/c/` but malformed. The caller should answer not found. */
  | { kind: "invalid" }
  | { kind: "community"; communityId: string; level: CommunityRouteLevel };

/** Decodes one path segment, or returns `null` if its encoding is malformed. */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Classifies a request path for the community access check.
 *
 * Pure: it reads only the path, never the session or the database, and grants
 * nothing by itself. Callers still have to check membership on the server.
 *
 * - Each segment is decoded once, as Next does when routing, and the community
 *   ID is validated after decoding.
 * - Malformed paths under `/c/` are `invalid`, not `none`, so a gate built on
 *   this fails closed. That includes any segment that decodes to contain `/`
 *   or `\` (for example `%2F` or `%5C`), which could otherwise be read as a
 *   different route.
 * - "admin" as the first segment after the ID makes it an admin route in any
 *   letter case or encoding. Classifying more paths as admin only makes the
 *   check stricter.
 */
export function matchCommunityPath(pathname: string): CommunityRouteMatch {
  if (pathname !== COMMUNITY_ROUTE_PREFIX && !pathname.startsWith(`${COMMUNITY_ROUTE_PREFIX}/`)) {
    return { kind: "none" };
  }
  if (pathname.length > MAX_PATH_LENGTH) {
    return { kind: "invalid" };
  }

  const rawSegments = pathname.slice(COMMUNITY_ROUTE_PREFIX.length + 1).split("/");
  // Allow a single trailing slash: "/c/abc/" is the same page as "/c/abc".
  if (rawSegments.length > 1 && rawSegments.at(-1) === "") {
    rawSegments.pop();
  }

  const segments: string[] = [];
  for (const rawSegment of rawSegments) {
    const segment = decodeSegment(rawSegment);
    if (
      segment === null ||
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      PATH_SEPARATOR.test(segment)
    ) {
      return { kind: "invalid" };
    }
    segments.push(segment);
  }

  const [rawId, firstSubpath] = segments;
  const id = communityIdSchema.safeParse(rawId);
  if (!id.success) {
    return { kind: "invalid" };
  }

  const level: CommunityRouteLevel = firstSubpath?.toLowerCase() === ADMIN_SEGMENT ? "admin" : "member";
  return { kind: "community", communityId: id.data, level };
}
