"use client";

import { useActionState, type ReactElement } from "react";
import {
  removeBlockedRangeAction,
  type RemoveBlockedRangeState,
} from "@/app/(app)/c/[communityId]/items/[itemId]/actions";

const INITIAL_STATE: RemoveBlockedRangeState = { status: "idle" };

/**
 * The "Remove" button for one blocked range. It submits only the community and
 * block IDs; whether the user may remove it is decided on the server
 * (`removeBlockedRangeAction`). On success the page refreshes and the range
 * disappears, so there's no separate success message.
 */
export function RemoveBlockButton({
  communityId,
  availabilityId,
  rangeLabel,
}: {
  communityId: string;
  availabilityId: string;
  rangeLabel: string;
}): ReactElement {
  const [state, formAction, pending] = useActionState(removeBlockedRangeAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="availabilityId" value={availabilityId} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-medium text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60 dark:text-red-400"
      >
        {pending ? "Removing…" : "Remove"}
        <span className="sr-only">{` blocked dates ${rangeLabel}`}</span>
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
