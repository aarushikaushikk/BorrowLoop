import "server-only";
import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import { SIGN_IN_PATH } from "@/lib/auth/routes";

/**
 * Auth.js configuration for BorrowLoop.
 *
 * - Google is the only sign-in method (US-1). Any Google account may sign in.
 *   There is no university-domain or hosted-domain (`hd`) restriction.
 *   Community access is controlled by membership instead.
 * - Credentials come from the environment, never from code: Auth.js reads
 *   `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` at runtime.
 *
 * TEMPORARY: JWT sessions without a database adapter. Without an adapter,
 * Auth.js assigns a fresh random user ID at each sign-in (it deliberately
 * doesn't use the Google account ID). That ID is not stable and must not be
 * stored or used as a database key. When the Prisma schema and Auth.js
 * adapter land (Aarushi), the ID becomes the database `User.id` and the
 * session strategy is revisited.
 */

export { SIGN_IN_PATH };

/** Only Google sign-ins are accepted, whatever the account's email domain. */
export function allowGoogleSignIn(params: {
  account?: { provider: string } | null;
  profile?: { email?: string | null };
}): boolean {
  return params.account?.provider === "google";
}

/**
 * Keeps the server-issued token as is.
 *
 * On `trigger: "update"`, Auth.js passes data sent from the client as
 * `session`. It's deliberately ignored so the client can never change the
 * token's subject or any other claim.
 */
export function keepServerIssuedToken(params: {
  token: JWT;
  trigger?: "signIn" | "signUp" | "update";
  session?: unknown;
}): JWT {
  return params.token;
}

/**
 * Sets `session.user.id` from the server-issued token subject, replacing any
 * value already present on the session object.
 */
export function exposeSessionUserId({ session, token }: { session: Session; token: JWT }): Session {
  if (!session.user) {
    return session;
  }
  const id = typeof token.sub === "string" && token.sub.length > 0 ? token.sub : undefined;
  return { ...session, user: { ...session.user, id } };
}

export const authConfig = {
  providers: [Google],
  pages: { signIn: SIGN_IN_PATH },
  session: { strategy: "jwt" },
  callbacks: {
    signIn: allowGoogleSignIn,
    jwt: keepServerIssuedToken,
    session: exposeSessionUserId,
  },
} satisfies NextAuthConfig;
