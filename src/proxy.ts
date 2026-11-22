import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie, isPublicPath } from "@/lib/auth/proxy-rules";
import { signInPathFor } from "@/lib/auth/routes";

/**
 * Optimistic redirect for signed-out visitors. This is UX only, never the
 * authorization check.
 *
 * - Without a session cookie, protected paths redirect to /sign-in and keep a
 *   safe callbackUrl.
 * - With a session cookie, the request continues. The cookie isn't verified
 *   here. Every protected page, Server Action, and route handler validates the
 *   session itself (`requireUser` / `getCurrentUser`), so a fake cookie grants
 *   nothing.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);

  if (isPublicPath(pathname) || hasSessionCookie(cookieNames)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL(signInPathFor(`${pathname}${search}`), request.url));
}

export const config = {
  // Deny by default: run on everything except the sign-in page, Auth.js
  // routes, Next.js build assets, and static files from `public/`.
  matcher: [
    "/((?!api/auth(?:/|$)|sign-in(?:/|$)|_next/static|_next/image|favicon\\.ico$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
