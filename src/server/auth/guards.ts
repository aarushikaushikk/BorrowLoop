import "server-only";
import { communityParamsSchema } from "@/lib/validation/community";
import type { MembershipLookup } from "@/server/auth/membership";
import {
  decideAdminAccess,
  decideMemberAccess,
  type AccessLevel,
} from "@/server/domain/access";

/** The signed-in user, resolved on the server from the session. */
export type AuthenticatedUser = { id: string };

export type CommunityAccessResult =
  | { decision: "allow"; communityId: string }
  | { decision: "not_found" }
  | { decision: "forbidden" };

/**
 * Decides whether the authenticated user can access a community at the given
 * level.
 *
 * - `params` is untrusted input (route params or form data). It's validated
 *   before any lookup, and unknown fields such as a client-supplied `userId`
 *   cause rejection.
 * - The lookup always receives `user.id` from the server-side session.
 * - Invalid input and missing or inactive memberships both return
 *   `not_found`, so other communities' existence isn't revealed.
 */
export async function authorizeCommunity(
  input: { user: AuthenticatedUser; params: unknown; level: AccessLevel },
  lookup: MembershipLookup,
): Promise<CommunityAccessResult> {
  const parsed = communityParamsSchema.safeParse(input.params);
  if (!parsed.success) {
    return { decision: "not_found" };
  }

  const { communityId } = parsed.data;
  const membership = await lookup.getMembership(input.user.id, communityId);
  const decision =
    input.level === "admin" ? decideAdminAccess(membership) : decideMemberAccess(membership);

  return decision === "allow" ? { decision, communityId } : { decision };
}
