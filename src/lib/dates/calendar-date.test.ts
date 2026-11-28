import { describe, expect, it } from "vitest";
import { formatDateRange, fromDbDate, toDbDate, todayUtc } from "@/lib/dates/calendar-date";

describe("todayUtc", () => {
  it("returns the UTC date at the very end of a UTC day", () => {
    expect(todayUtc(new Date("2026-11-27T23:59:59.999Z"))).toBe("2026-11-27");
  });

  it("returns the next date at the very start of the next UTC day", () => {
    expect(todayUtc(new Date("2026-11-28T00:00:00.000Z"))).toBe("2026-11-28");
  });

  it("uses UTC, not the offset written in the input", () => {
    // 20:00 at UTC-05:00 on Nov 27 is already 01:00 UTC on Nov 28.
    expect(todayUtc(new Date("2026-11-27T20:00:00-05:00"))).toBe("2026-11-28");
  });

  it("handles a leap day", () => {
    expect(todayUtc(new Date("2028-02-29T12:00:00.000Z"))).toBe("2028-02-29");
  });

  it("throws for an invalid Date instead of returning a bogus day", () => {
    expect(() => todayUtc(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("toDbDate", () => {
  it.each([
    ["an ordinary date", "2026-12-01", Date.UTC(2026, 11, 1)],
    ["the last day of a year", "2026-12-31", Date.UTC(2026, 11, 31)],
    ["a leap day in a year divisible by 4", "2028-02-29", Date.UTC(2028, 1, 29)],
    ["a leap day in a year divisible by 400", "2400-02-29", Date.UTC(2400, 1, 29)],
    ["the 30th of a 30-day month", "2027-04-30", Date.UTC(2027, 3, 30)],
  ])("converts %s to UTC midnight", (_label, day, expected) => {
    expect(toDbDate(day).getTime()).toBe(expected);
  });

  it.each([
    ["Feb 29 in a common year", "2027-02-29"],
    ["Feb 29 in a century year not divisible by 400", "2100-02-29"],
    ["Feb 30", "2028-02-30"],
    ["the 31st of a 30-day month", "2027-04-31"],
    ["month 13", "2026-13-01"],
    ["month 00", "2026-00-10"],
    ["day 00", "2026-12-00"],
    ["day 32", "2026-12-32"],
    ["a US-style date", "12/01/2026"],
    ["unpadded month and day", "2026-1-5"],
    ["a compact date", "20261201"],
    ["a date with a time", "2026-12-01T00:00:00Z"],
    ["an expanded-year date", "+002026-12-01"],
    ["surrounding whitespace", " 2026-12-01 "],
    ["an empty string", ""],
  ])("throws a RangeError for %s", (_label, day) => {
    expect(() => toDbDate(day)).toThrow(RangeError);
  });
});

describe("fromDbDate", () => {
  it("formats a UTC-midnight Date as YYYY-MM-DD", () => {
    expect(fromDbDate(new Date(Date.UTC(2026, 11, 1)))).toBe("2026-12-01");
  });

  it("formats a leap day", () => {
    expect(fromDbDate(new Date(Date.UTC(2028, 1, 29)))).toBe("2028-02-29");
  });

  it.each(["2026-11-27", "2026-12-31", "2028-02-29", "2027-01-01"])("round-trips %s through toDbDate", (day) => {
    expect(fromDbDate(toDbDate(day))).toBe(day);
  });
});

describe("formatDateRange", () => {
  it.each([
    ["a single day", "2026-12-01", "2026-12-01", "Dec 1, 2026"],
    ["a range within one month", "2026-12-03", "2026-12-04", "Dec 3 – Dec 4, 2026"],
    ["a range across months in one year", "2026-11-28", "2026-12-05", "Nov 28 – Dec 5, 2026"],
    ["a range across years", "2026-12-30", "2027-01-02", "Dec 30, 2026 – Jan 2, 2027"],
    ["a range ending on a leap day", "2028-02-28", "2028-02-29", "Feb 28 – Feb 29, 2028"],
  ])("formats %s", (_label, start, end, expected) => {
    expect(formatDateRange(start, end)).toBe(expected);
  });

  it.each([
    ["an impossible start date", "2027-02-29", "2027-03-01"],
    ["an impossible end date", "2027-02-01", "2027-02-30"],
    ["a malformed date", "12/01/2026", "2026-12-02"],
  ])("throws a RangeError for %s", (_label, start, end) => {
    expect(() => formatDateRange(start, end)).toThrow(RangeError);
  });
});
