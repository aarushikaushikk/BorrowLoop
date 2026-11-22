import "server-only";
import { accessDecisionToStatus, type AccessDecision } from "@/server/domain/access";

const DENIED_MESSAGES = {
  forbidden: "Forbidden",
  not_found: "Not found",
} as const satisfies Record<Exclude<AccessDecision, "allow">, string>;

/**
 * A generic denial response for route handlers: a real HTTP 403 or 404 that
 * needs no experimental framework settings.
 *
 * It takes only the decision, so it has no way to include community, user,
 * or role details in the body.
 */
export function accessDeniedResponse(decision: Exclude<AccessDecision, "allow">): Response {
  return Response.json(
    { error: DENIED_MESSAGES[decision] },
    {
      status: accessDecisionToStatus(decision),
      headers: { "Cache-Control": "no-store" },
    },
  );
}
