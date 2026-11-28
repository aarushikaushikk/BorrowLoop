"use server";

import type { BlockedRangeField } from "@/lib/validation/availability";

/** The result shown by the lender's "Block dates" form. */
export type AddBlockedRangeState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<BlockedRangeField, string>> }
  | { status: "added" };

/** The result shown by a block's "Remove" button. */
export type RemoveBlockedRangeState = { status: "idle" } | { status: "error"; message: string } | { status: "removed" };

/**
 * Blocks a date range on the signed-in lender's own item.
 *
 * RED placeholder (cycle 2).
 */
export async function addBlockedRangeAction(
  _previousState: AddBlockedRangeState,
  formData: FormData,
): Promise<AddBlockedRangeState> {
  void formData;
  return { status: "idle" };
}

/**
 * Removes one blocked range from the signed-in lender's own item.
 *
 * RED placeholder (cycle 2).
 */
export async function removeBlockedRangeAction(
  _previousState: RemoveBlockedRangeState,
  formData: FormData,
): Promise<RemoveBlockedRangeState> {
  void formData;
  return { status: "idle" };
}
