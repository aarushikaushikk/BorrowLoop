"use client";

import { useActionState } from "react";
import { joinCommunityAction, type JoinCommunityState } from "@/app/(app)/communities/actions";

const INITIAL_STATE: JoinCommunityState = { status: "idle" };

/**
 * The Join button for one community. It submits only the community ID; who
 * joins, and with which role, is decided on the server.
 */
export function JoinCommunityForm({ communityId, communityName }: { communityId: string; communityName: string }) {
  const [state, formAction, pending] = useActionState(joinCommunityAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:items-end">
      <input type="hidden" name="communityId" value={communityId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Join ${communityName}`}
        className="h-9 rounded-full bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join community"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
