// Availability (US-3) validation shared by the server and the browser. No
// secrets or server-only imports belong here.

import { z } from "zod";
import { isCalendarDate, type CalendarDate } from "@/lib/dates/calendar-date";
import { communityIdSchema } from "@/lib/validation/community";

/** Lender note length, measured after trimming: at most NOTE_MAX characters. */
export const NOTE_MAX = 200;

/** User-facing messages for the blocked-range form. Zod's own wording never reaches the page. */
export const BLOCKED_RANGE_MESSAGES = {
  startDateInvalid: "Enter a valid start date.",
  startDatePast: "The start date can't be in the past.",
  endDateInvalid: "Enter a valid end date.",
  endDateBeforeStart: "The end date must be on or after the start date.",
  noteInvalid: "Enter the note as text.",
  noteTooLong: `Keep the note to ${NOTE_MAX} characters or fewer.`,
} as const;

export type BlockedRangeField = "startDate" | "endDate" | "note";

/** A validated blocked range: inclusive calendar dates and an optional private note. */
export type BlockedRange = { startDate: CalendarDate; endDate: CalendarDate; note: string | null };

export type BlockedRangeResult =
  | { ok: true; value: BlockedRange }
  | { ok: false; fieldErrors: Partial<Record<BlockedRangeField, string>> };

/** A real "YYYY-MM-DD" calendar date (leap years included). */
const calendarDateSchema = z.string().refine(isCalendarDate);

/**
 * The optional private note: trimmed, then length-checked. Absent, empty and
 * whitespace-only notes become `null`.
 */
const noteSchema = z
  .string()
  .trim()
  .max(NOTE_MAX)
  .transform((note) => (note === "" ? null : note))
  .nullish();

/**
 * Reads only the three named fields from the input; anything else (for
 * example a client-supplied `ownerId`) is dropped. Non-object input reads as
 * all fields missing.
 */
const rawRangeSchema = z.object({ startDate: z.unknown(), endDate: z.unknown(), note: z.unknown() });

/**
 * Validates a blocked date range submitted by a lender, against `today` (the
 * current UTC date, "YYYY-MM-DD").
 *
 * - Both dates must be real calendar dates.
 * - The range is inclusive: the start may be today, and the end may equal the
 *   start. A start before today and an end before the start are rejected.
 *   "YYYY-MM-DD" strings with four-digit years sort chronologically, so they
 *   are compared as strings.
 * - Each field gets at most one user-facing error. An end date is only
 *   compared with a valid start date.
 *
 * Throws a RangeError if `today` isn't a calendar date (a programming error).
 */
export function parseBlockedRange(input: unknown, today: CalendarDate): BlockedRangeResult {
  if (!isCalendarDate(today)) {
    throw new RangeError("today must be a calendar date (YYYY-MM-DD)");
  }

  const raw = rawRangeSchema.safeParse(input);
  const fields = raw.success ? raw.data : { startDate: undefined, endDate: undefined, note: undefined };

  const start = calendarDateSchema.safeParse(fields.startDate);
  const end = calendarDateSchema.safeParse(fields.endDate);
  const note = noteSchema.safeParse(fields.note);

  const fieldErrors: Partial<Record<BlockedRangeField, string>> = {};
  if (!start.success) {
    fieldErrors.startDate = BLOCKED_RANGE_MESSAGES.startDateInvalid;
  } else if (start.data < today) {
    fieldErrors.startDate = BLOCKED_RANGE_MESSAGES.startDatePast;
  }
  if (!end.success) {
    fieldErrors.endDate = BLOCKED_RANGE_MESSAGES.endDateInvalid;
  } else if (start.success && end.data < start.data) {
    fieldErrors.endDate = BLOCKED_RANGE_MESSAGES.endDateBeforeStart;
  }
  if (!note.success) {
    const tooLong = note.error.issues.some((issue) => issue.code === "too_big");
    fieldErrors.note = tooLong ? BLOCKED_RANGE_MESSAGES.noteTooLong : BLOCKED_RANGE_MESSAGES.noteInvalid;
  }

  if (!start.success || !end.success || !note.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true, value: { startDate: start.data, endDate: end.data, note: note.data ?? null } };
}

/** Opaque database IDs from untrusted input; the same shape `communityIdSchema` accepts. */
const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** An item ID from untrusted input (route params or form data). */
export const itemIdSchema = z.string().regex(RECORD_ID_PATTERN);

/** An availability block ID from untrusted form data. */
export const availabilityIdSchema = z.string().regex(RECORD_ID_PATTERN);

/**
 * Route params of /c/[communityId]/items/[itemId]. Strict, so extra keys such
 * as a client-supplied `ownerId` are rejected.
 */
export const itemRouteParamsSchema = z.strictObject({
  communityId: communityIdSchema,
  itemId: itemIdSchema,
});
