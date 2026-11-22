import "server-only";
import { authorizeCommunity, type CommunityAccessResult } from "@/server/auth/guards";
import { requireUser, type CurrentUser } from "@/server/auth/session";
import { createMembershipLookup } from "@/server/dal/memberships";
import type { AccessLevel } from "@/server/domain/access";

/**
 * Server-side community access check for pages, Server Actions, and route
 * handlers.
 *
 * 1. `requireUser` resolves the user from the session, or redirects to sign-in
 *    (returning to `callbackPath`, which is validated there).
 * 2. `authorizeCommunity` validates `params` with Zod (strict: extra fields
 *    such as a client-supplied `userId` or `role` are rejected) and looks up
 *    the membership for the session user's ID only.
 * 3. The membership comes from the database on every call. Nothing about
 *    membership or role is read from, or stored in, the JWT.
 *
 * Returns the session user and an allow/not_found/forbidden decision. Turning
 * the decision into a 404/403 response is the caller's job.
 */
export async function getCommunityAccess(input: {
  params: unknown;
  level: AccessLevel;
  callbackPath: string;
}): Promise<{ user: CurrentUser; access: CommunityAccessResult }> {
  const user = await requireUser(input.callbackPath);
  const access = await authorizeCommunity(
    { user: { id: user.id }, params: input.params, level: input.level },
    createMembershipLookup(),
  );
  return { user, access };
}
