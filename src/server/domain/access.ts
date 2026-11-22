import "server-only";

// Pure community access rules. No I/O, so they can be unit tested directly.
//
// The role and status values mirror the proposed Membership enums in
// docs/architecture.md §4. They must stay in sync with the Prisma schema once
// it exists (owned by Aarushi).

export type MembershipRole = "MEMBER" | "ADMIN";
export type MembershipStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type MembershipSnapshot = { role: MembershipRole; status: MembershipStatus };

/**
 * - `allow`: the user may access the resource.
 * - `not_found`: the user isn't an active member, so the community's existence
 *   isn't revealed.
 * - `forbidden`: the user is an active member but lacks the required role.
 */
export type AccessDecision = "allow" | "not_found" | "forbidden";
export type AccessLevel = "member" | "admin";

export function decideMemberAccess(membership: MembershipSnapshot | null): AccessDecision {
  return membership?.status === "ACTIVE" ? "allow" : "not_found";
}

export function decideAdminAccess(membership: MembershipSnapshot | null): AccessDecision {
  if (membership?.status !== "ACTIVE") {
    return "not_found";
  }
  return membership.role === "ADMIN" ? "allow" : "forbidden";
}

const STATUS_BY_DECISION = {
  allow: 200,
  forbidden: 403,
  not_found: 404,
} as const satisfies Record<AccessDecision, number>;

export function accessDecisionToStatus(
  decision: AccessDecision,
): (typeof STATUS_BY_DECISION)[AccessDecision] {
  return STATUS_BY_DECISION[decision];
}
