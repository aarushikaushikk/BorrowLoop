// Availability (US-3) validation shared by the server and the browser. No
// secrets or server-only imports belong here.

import { z } from "zod";
import type { CalendarDate } from "@/lib/dates/calendar-date";
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

/**
 * Validates a blocked date range submitted by a lender, against `today` (the
 * current UTC date, "YYYY-MM-DD").
 *
 * RED placeholder (cycle 1).
 */
export function parseBlockedRange(input: unknown, today: CalendarDate): BlockedRangeResult {
  void input;
  void today;
  return { ok: false, fieldErrors: {} };
}

/**
 * An item ID from untrusted input (route params or form data).
 *
 * RED placeholder (cycle 1): rejects everything.
 */
export const itemIdSchema = z.string().refine(() => false);

/**
 * An availability block ID from untrusted form data.
 *
 * RED placeholder (cycle 1): rejects everything.
 */
export const availabilityIdSchema = z.string().refine(() => false);

/**
 * Route params of /c/[communityId]/items/[itemId]. Strict, so extra keys such
 * as a client-supplied `ownerId` are rejected.
 */
export const itemRouteParamsSchema = z.strictObject({
  communityId: communityIdSchema,
  itemId: itemIdSchema,
});
