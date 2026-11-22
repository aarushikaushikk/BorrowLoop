"use server";

import { refresh } from "next/cache";
import { signOut } from "@/auth";
import { COMMUNITIES_PATH, SIGN_IN_PATH } from "@/lib/auth/routes";
import { communityIdSchema } from "@/lib/validation/community";
import { requireUser } from "@/server/auth/session";
import { joinCommunityAsMember } from "@/server/dal/memberships";

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: SIGN_IN_PATH });
}

/** The result shown by the Join button (see join-community-form.tsx). */
export type JoinCommunityState = { status: "idle" } | { status: "joined" } | { status: "error"; message: string };

const JOIN_FAILED_MESSAGE = "We couldn't join that community. Refresh the page and try again.";

/**
 * Joins the signed-in user to a community as a MEMBER.
 *
 * Server Actions are public POST endpoints, so this checks everything itself:
 * - the session is verified here (`requireUser`); signed-out callers are
 *   redirected to sign-in before anything else runs;
 * - only the `communityId` field is read, and it's validated with Zod. Any
 *   other submitted field (for example `userId` or `role`) is never read;
 * - the user ID comes from the session, and the role is always MEMBER;
 * - errors are reported with one generic message, never database details.
 */
export async function joinCommunityAction(
  _previousState: JoinCommunityState,
  formData: FormData,
): Promise<JoinCommunityState> {
  const user = await requireUser(COMMUNITIES_PATH);

  const parsed = communityIdSchema.safeParse(formData.get("communityId"));
  if (!parsed.success) {
    return { status: "error", message: JOIN_FAILED_MESSAGE };
  }

  let result;
  try {
    result = await joinCommunityAsMember({ id: user.id }, parsed.data);
  } catch {
    return { status: "error", message: JOIN_FAILED_MESSAGE };
  }
  if (result === "not_found") {
    return { status: "error", message: JOIN_FAILED_MESSAGE };
  }

  // "joined" and "already_member" both mean the user is now a member.
  refresh();
  return { status: "joined" };
}
