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

/**
 * The current date in UTC as "YYYY-MM-DD".
 *
 * RED placeholder (cycle 1).
 */
export function todayUtc(now: Date): CalendarDate {
  void now;
  return "";
}

/**
 * Converts a real calendar date ("YYYY-MM-DD") to the Date Prisma expects for
 * a `@db.Date` column (UTC midnight). Throws a RangeError for anything else.
 *
 * RED placeholder (cycle 1).
 */
export function toDbDate(day: CalendarDate): Date {
  void day;
  return new Date(Number.NaN);
}

/**
 * Converts a `@db.Date` value (UTC midnight) back to "YYYY-MM-DD".
 *
 * RED placeholder (cycle 1).
 */
export function fromDbDate(date: Date): CalendarDate {
  void date;
  return "";
}
