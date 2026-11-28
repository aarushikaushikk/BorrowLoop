"use server";

import { refresh } from "next/cache";
import { COMMUNITIES_PATH } from "@/lib/auth/routes";
import { todayUtc } from "@/lib/dates/calendar-date";
import {
  availabilityIdSchema,
  itemIdSchema,
  parseBlockedRange,
  type BlockedRangeField,
} from "@/lib/validation/availability";
import { getCommunityAccess } from "@/server/auth/community-access";
import { addBlockedRange, removeBlockedRange } from "@/server/dal/availability";

/** The result shown by the lender's "Block dates" form. */
export type AddBlockedRangeState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<BlockedRangeField, string>> }
  | { status: "added" };

/** The result shown by a block's "Remove" button. */
export type RemoveBlockedRangeState = { status: "idle" } | { status: "error"; message: string } | { status: "removed" };

const ADD_FAILED_MESSAGE = "We couldn't block those dates. Refresh the page and try again.";
const REMOVE_FAILED_MESSAGE = "We couldn't remove those dates. Refresh the page and try again.";
const FIX_FIELDS_MESSAGE = "Please fix the highlighted fields.";

/**
 * Blocks a date range on the signed-in lender's own item.
 *
 * Server Actions are public POST endpoints, so this checks everything itself:
 * 1. Session and membership through the US-1 guard (`getCommunityAccess`),
 *    outside any try/catch so its sign-in redirect propagates. Only
 *    `communityId` is read from the form for it.
 * 2. `itemId` and the range are validated with the shared Zod schemas, against
 *    today's UTC date. Only the named fields are read; `ownerId`, `userId`,
 *    `role` and the like never are.
 * 3. The data layer derives ownership from the session user and locks the
 *    authorizing rows (see `addBlockedRange`).
 * Every failure after the access check, other than field errors, returns one
 * generic message. `refresh()` runs once, only after a successful add.
 */
export async function addBlockedRangeAction(
  _previousState: AddBlockedRangeState,
  formData: FormData,
): Promise<AddBlockedRangeState> {
  const { user, access } = await getCommunityAccess({
    params: { communityId: formData.get("communityId") },
    level: "member",
    callbackPath: COMMUNITIES_PATH,
  });
  if (access.decision !== "allow") {
    return { status: "error", message: ADD_FAILED_MESSAGE };
  }

  const itemId = itemIdSchema.safeParse(formData.get("itemId"));
  if (!itemId.success) {
    return { status: "error", message: ADD_FAILED_MESSAGE };
  }

  const range = parseBlockedRange(
    {
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      note: formData.get("note"),
    },
    todayUtc(new Date()),
  );
  if (!range.ok) {
    return { status: "error", message: FIX_FIELDS_MESSAGE, fieldErrors: range.fieldErrors };
  }

  let result: Awaited<ReturnType<typeof addBlockedRange>>;
  try {
    result = await addBlockedRange(
      { id: user.id },
      { communityId: access.communityId, itemId: itemId.data, range: range.value },
    );
  } catch {
    return { status: "error", message: ADD_FAILED_MESSAGE };
  }
  if (result === "not_found") {
    return { status: "error", message: ADD_FAILED_MESSAGE };
  }

  refresh();
  return { status: "added" };
}

/**
 * Removes one blocked range from the signed-in lender's own item.
 *
 * Same checks as `addBlockedRangeAction`: the access guard first (its redirect
 * propagates), then only `availabilityId` is read and validated. The data
 * layer scopes the delete to the session user's own PUBLISHED item in the
 * authorized community. Failures return one generic message, and `refresh()`
 * runs once, only after a successful removal.
 */
export async function removeBlockedRangeAction(
  _previousState: RemoveBlockedRangeState,
  formData: FormData,
): Promise<RemoveBlockedRangeState> {
  const { user, access } = await getCommunityAccess({
    params: { communityId: formData.get("communityId") },
    level: "member",
    callbackPath: COMMUNITIES_PATH,
  });
  if (access.decision !== "allow") {
    return { status: "error", message: REMOVE_FAILED_MESSAGE };
  }

  const availabilityId = availabilityIdSchema.safeParse(formData.get("availabilityId"));
  if (!availabilityId.success) {
    return { status: "error", message: REMOVE_FAILED_MESSAGE };
  }

  let result: Awaited<ReturnType<typeof removeBlockedRange>>;
  try {
    result = await removeBlockedRange(
      { id: user.id },
      { communityId: access.communityId, availabilityId: availabilityId.data },
    );
  } catch {
    return { status: "error", message: REMOVE_FAILED_MESSAGE };
  }
  if (result === "not_found") {
    return { status: "error", message: REMOVE_FAILED_MESSAGE };
  }

  refresh();
  return { status: "removed" };
}
