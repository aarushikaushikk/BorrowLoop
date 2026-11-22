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
 * Identity: `src/auth.ts` adds the Prisma adapter, so each Google account is
 * linked to one `User` row through `Account(provider, providerAccountId)` and
 * the JWT `sub` is that user's stable database ID. Sessions stay JWT (no
 * Session table); membership is still checked against the database on each
 * request, never stored in the token. Accounts are never linked by matching
 * email alone (`allowDangerousEmailAccountLinking` is not set).
 */

export { SIGN_IN_PATH };

/**
 * Chooses which OAuth token fields Auth.js stores on the `Account` row.
 *
 * BorrowLoop never calls Google APIs, so no access, refresh, or ID tokens are
 * kept. Auth.js still stores `provider`, `type`, and `providerAccountId` (the
 * Google `sub`), which is all account linking uses.
 */
export function discardOAuthTokens(tokens: object): Record<string, never> {
  void tokens;
  return {};
}

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
  providers: [Google({ account: discardOAuthTokens })],
  pages: { signIn: SIGN_IN_PATH },
  session: { strategy: "jwt" },
  callbacks: {
    signIn: allowGoogleSignIn,
    jwt: keepServerIssuedToken,
    session: exposeSessionUserId,
  },
} satisfies NextAuthConfig;
