"use client";

import { useActionState, type ReactElement } from "react";
import { addBlockedRangeAction, type AddBlockedRangeState } from "@/app/(app)/c/[communityId]/items/[itemId]/actions";
import { NOTE_MAX } from "@/lib/validation/availability";

const INITIAL_STATE: AddBlockedRangeState = { status: "idle" };

const inputClass =
  "w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 aria-invalid:border-red-600 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-100";
const buttonClass =
  "h-10 self-start rounded-full bg-emerald-700 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60";

const START_ID = "block-start-date";
const END_ID = "block-end-date";
const NOTE_ID = "block-note";
const NOTE_HINT_ID = "block-note-hint";

/**
 * The lender's "Block dates" form. It submits only the community and item IDs
 * and the range; who may block dates, and on which item, is decided on the
 * server (`addBlockedRangeAction`).
 *
 * `today` (UTC, from the server) is the date pickers' minimum. That's a
 * convenience only: the server validates the range again.
 */
export function BlockedDatesForm({
  communityId,
  itemId,
  today,
}: {
  communityId: string;
  itemId: string;
  today: string;
}): ReactElement {
  const [state, formAction, pending] = useActionState(addBlockedRangeAction, INITIAL_STATE);
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const noteErrorId = `${NOTE_ID}-error`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="itemId" value={itemId} />

      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        <span aria-hidden="true">*</span> Required
      </p>

      {state.status === "error" ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.message}
        </p>
      ) : null}
      {state.status === "added" ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Dates blocked.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <DateField id={START_ID} name="startDate" label="Start date" min={today} error={fieldErrors.startDate} />
        <DateField id={END_ID} name="endDate" label="End date" min={today} error={fieldErrors.endDate} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={NOTE_ID} className="text-sm font-medium">
          Private note (optional)
        </label>
        <input
          id={NOTE_ID}
          name="note"
          type="text"
          maxLength={NOTE_MAX}
          aria-invalid={fieldErrors.note ? true : undefined}
          aria-describedby={fieldErrors.note ? `${NOTE_HINT_ID} ${noteErrorId}` : NOTE_HINT_ID}
          className={inputClass}
        />
        <p id={NOTE_HINT_ID} className="text-xs text-zinc-600 dark:text-zinc-400">
          Only you can see this note. Up to {NOTE_MAX} characters.
        </p>
        {fieldErrors.note ? (
          <p id={noteErrorId} className="text-sm text-red-700 dark:text-red-400">
            {fieldErrors.note}
          </p>
        ) : null}
      </div>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Blocking…" : "Block dates"}
      </button>
    </form>
  );
}

function DateField({
  id,
  name,
  label,
  min,
  error,
}: {
  id: string;
  name: "startDate" | "endDate";
  label: string;
  min: string;
  error: string | undefined;
}): ReactElement {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}{" "}
        <span aria-hidden="true" className="text-red-700 dark:text-red-400">
          *
        </span>
      </label>
      <input
        id={id}
        name={name}
        type="date"
        required
        min={min}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
