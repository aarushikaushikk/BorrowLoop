import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie, isPublicPath, matchCommunityPath } from "@/lib/auth/proxy-rules";
import { signInPathFor } from "@/lib/auth/routes";
import { authorizeCommunity } from "@/server/auth/guards";
import { accessDeniedPage } from "@/server/auth/responses";
import { getCurrentUser } from "@/server/auth/session";
import { createMembershipLookup } from "@/server/dal/memberships";

/**
 * Request gate for protected paths.
 *
 * Everywhere: a request without a session cookie is redirected to /sign-in
 * with a safe callbackUrl (optimistic, cookie-only).
 *
 * Community paths (/c/<communityId>/...) are also authorized here, because
 * streamed pages always start with HTTP 200: a real 403/404 has to be decided
 * before rendering begins. For these paths only:
 * - the path is classified by `matchCommunityPath`; malformed paths are 404;
 * - the session is verified (`getCurrentUser`); an invalid or expired one
 *   redirects to sign-in;
 * - membership and role are read from PostgreSQL for the session user's ID
 *   (`authorizeCommunity` + the Prisma lookup), never from the JWT.
 * Non-members and nonexistent communities get the same 404; members on an
 * admin path get 403.
 *
 * This is not the only check: every page, Server Action, and route handler
 * still authorizes on its own (`requireUser` / `getCommunityAccess`).
 *
 * Next.js advises against database work in Proxy because it runs on every
 * matched route, including prefetches. The query here is limited to community
 * paths and is a single lookup by the (userId, communityId) unique key.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const signInRedirect = () => NextResponse.redirect(new URL(signInPathFor(`${pathname}${search}`), request.url));
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  if (!hasSessionCookie(cookieNames)) {
    return signInRedirect();
  }

  const route = matchCommunityPath(pathname);
  if (route.kind === "none") {
    return NextResponse.next();
  }
  if (route.kind === "invalid") {
    return denied("not_found");
  }

  const user = await getCurrentUser();
  if (!user) {
    return signInRedirect();
  }

  const access = await authorizeCommunity(
    { user: { id: user.id }, params: { communityId: route.communityId }, level: route.level },
    createMembershipLookup(),
  );
  return access.decision === "allow" ? NextResponse.next() : denied(access.decision);
}

/** The fixed 403/404 page as a NextResponse (same body, status, and headers). */
function denied(decision: "forbidden" | "not_found"): NextResponse {
  const page = accessDeniedPage(decision);
  return new NextResponse(page.body, { status: page.status, headers: page.headers });
}

export const config = {
  // Deny by default: run on everything except the sign-in page, Auth.js
  // routes, Next.js build assets, and static files from `public/`.
  matcher: [
    "/((?!api/auth(?:/|$)|sign-in(?:/|$)|_next/static|_next/image|favicon\\.ico$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
