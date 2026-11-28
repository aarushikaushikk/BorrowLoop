// Calendar dates for availability (US-3): whole days written as "YYYY-MM-DD",
// with no time of day and no time zone. They're stored in Prisma `@db.Date`
// columns, which come back as JavaScript Dates at UTC midnight.
//
// "Today" is the current UTC date. This is provisional until the team decides
// the community time-zone model (docs/architecture.md D13).
//
// Browser-safe: no secrets or server-only imports.

/** A calendar date string in the form "YYYY-MM-DD". */
export type CalendarDate = string;

/** Exactly four-digit year, two-digit month and day. `\d` is ASCII 0–9 only. */
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Gregorian rule: every 4th year, except centuries not divisible by 400. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

/** Splits a real calendar date into its parts, or returns `null`. */
function parseParts(value: unknown): { year: number; month: number; day: number } | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

/**
 * Whether `value` is a real calendar date in the form "YYYY-MM-DD": the month
 * is 01–12 and the day exists in that month, leap years included. Values
 * JavaScript's Date would silently roll over (such as "2027-02-29") are
 * rejected.
 */
export function isCalendarDate(value: unknown): value is CalendarDate {
  return parseParts(value) !== null;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * The UTC calendar date of an instant, as "YYYY-MM-DD". Throws a RangeError
 * for an invalid Date or a year outside 0000–9999.
 */
function utcCalendarDateOf(date: Date): CalendarDate {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid Date");
  }
  const year = date.getUTCFullYear();
  if (year < 0 || year > 9999) {
    throw new RangeError("Year outside 0000–9999");
  }
  return `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/** The current date in UTC as "YYYY-MM-DD". Throws a RangeError for an invalid Date. */
export function todayUtc(now: Date): CalendarDate {
  return utcCalendarDateOf(now);
}

/**
 * Converts a real calendar date ("YYYY-MM-DD") to the Date Prisma expects for
 * a `@db.Date` column (UTC midnight). Throws a RangeError for anything else.
 */
export function toDbDate(day: CalendarDate): Date {
  const parts = parseParts(day);
  if (!parts) {
    throw new RangeError("Not a calendar date (YYYY-MM-DD)");
  }
  // `Date.UTC` maps years 0–99 to 1900–1999, so set the full year explicitly.
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return date;
}

/**
 * Converts a `@db.Date` value (UTC midnight) back to "YYYY-MM-DD". Throws a
 * RangeError for an invalid Date.
 */
export function fromDbDate(date: Date): CalendarDate {
  return utcCalendarDateOf(date);
}

/** Fixed English month names, so labels don't depend on the runtime's ICU data or time zone. */
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * A readable, locale-independent label for an inclusive range of calendar
 * dates:
 * - one day: "Dec 1, 2026"
 * - within a year: "Nov 28 – Dec 5, 2026"
 * - across years: "Dec 30, 2026 – Jan 2, 2027"
 *
 * Works on the date parts directly (no Date or time zone involved). Throws a
 * RangeError if either value isn't a real calendar date.
 */
export function formatDateRange(start: CalendarDate, end: CalendarDate): string {
  const from = parseParts(start);
  const to = parseParts(end);
  if (!from || !to) {
    throw new RangeError("Not a calendar date (YYYY-MM-DD)");
  }
  const monthDay = (parts: { month: number; day: number }) => `${MONTH_NAMES[parts.month - 1]} ${parts.day}`;

  if (start === end) {
    return `${monthDay(from)}, ${from.year}`;
  }
  if (from.year === to.year) {
    return `${monthDay(from)} – ${monthDay(to)}, ${to.year}`;
  }
  return `${monthDay(from)}, ${from.year} – ${monthDay(to)}, ${to.year}`;
}
