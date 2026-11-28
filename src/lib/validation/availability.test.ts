import { describe, expect, it } from "vitest";
import {
  availabilityIdSchema,
  BLOCKED_RANGE_MESSAGES,
  itemIdSchema,
  itemRouteParamsSchema,
  NOTE_MAX,
  parseBlockedRange,
} from "@/lib/validation/availability";

const TODAY = "2026-11-27";
const M = BLOCKED_RANGE_MESSAGES;

/** The fields as a Server Action reads them from FormData (string, File, or null when absent). */
function range(fields: { startDate?: unknown; endDate?: unknown; note?: unknown } = {}) {
  return {
    startDate: "2026-12-01",
    endDate: "2026-12-03",
    note: null,
    ...fields,
  };
}

describe("parseBlockedRange: valid ranges", () => {
  it("accepts a future range and returns only the validated fields", () => {
    expect(parseBlockedRange(range(), TODAY)).toEqual({
      ok: true,
      value: { startDate: "2026-12-01", endDate: "2026-12-03", note: null },
    });
  });

  it("accepts a range starting today (UTC)", () => {
    expect(parseBlockedRange(range({ startDate: TODAY, endDate: TODAY }), TODAY)).toEqual({
      ok: true,
      value: { startDate: TODAY, endDate: TODAY, note: null },
    });
  });

  it("accepts a one-day range (end equals start)", () => {
    const result = parseBlockedRange(range({ startDate: "2026-12-05", endDate: "2026-12-05" }), TODAY);
    expect(result).toEqual({ ok: true, value: { startDate: "2026-12-05", endDate: "2026-12-05", note: null } });
  });

  it("accepts a range that crosses a year boundary", () => {
    const result = parseBlockedRange(range({ startDate: "2026-12-30", endDate: "2027-01-02" }), TODAY);
    expect(result).toEqual({ ok: true, value: { startDate: "2026-12-30", endDate: "2027-01-02", note: null } });
  });

  it.each([
    ["a leap day in a year divisible by 4", "2028-02-29"],
    ["a leap day in a year divisible by 400", "2400-02-29"],
  ])("accepts %s", (_label, day) => {
    expect(parseBlockedRange(range({ startDate: day, endDate: day }), TODAY)).toEqual({
      ok: true,
      value: { startDate: day, endDate: day, note: null },
    });
  });

  it("ignores extra fields such as a client-supplied ownerId or itemId", () => {
    const input = { ...range(), ownerId: "attacker", itemId: "someone-elses-item", userId: "u1" };
    expect(parseBlockedRange(input, TODAY)).toEqual({
      ok: true,
      value: { startDate: "2026-12-01", endDate: "2026-12-03", note: null },
    });
  });
});

describe("parseBlockedRange: start date", () => {
  it("rejects a start date before today (UTC)", () => {
    expect(parseBlockedRange(range({ startDate: "2026-11-26", endDate: "2026-12-03" }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { startDate: M.startDatePast },
    });
  });

  it.each([
    ["Feb 29 in a common year", "2027-02-29"],
    ["Feb 29 in a century year not divisible by 400", "2100-02-29"],
    ["the 31st of a 30-day month", "2027-04-31"],
    ["month 13", "2026-13-01"],
    ["day 00", "2026-12-00"],
    ["a US-style date", "12/01/2026"],
    ["unpadded month and day", "2026-1-5"],
    ["a date with a time", "2026-12-01T00:00:00Z"],
    ["surrounding whitespace", " 2026-12-01"],
    ["an empty string", ""],
    ["a missing field (null)", null],
    ["a number", 20261201],
    ["a file upload", new File(["x"], "start.txt")],
  ])("rejects %s as an invalid start date", (_label, startDate) => {
    expect(parseBlockedRange(range({ startDate, endDate: "2028-03-01" }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { startDate: M.startDateInvalid },
    });
  });

  it("doesn't also report the end date as before the start when the start is invalid", () => {
    expect(parseBlockedRange(range({ startDate: "2027-02-29", endDate: "2026-12-01" }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { startDate: M.startDateInvalid },
    });
  });
});

describe("parseBlockedRange: end date", () => {
  it("rejects a reversed range (end the day before start)", () => {
    expect(parseBlockedRange(range({ startDate: "2026-12-05", endDate: "2026-12-04" }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { endDate: M.endDateBeforeStart },
    });
  });

  it("rejects a range reversed across a year boundary", () => {
    expect(parseBlockedRange(range({ startDate: "2027-01-01", endDate: "2026-12-31" }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { endDate: M.endDateBeforeStart },
    });
  });

  it.each([
    ["Feb 29 in a common year", "2027-02-29"],
    ["Feb 30", "2028-02-30"],
    ["month 00", "2026-00-10"],
    ["a compact date", "20261203"],
    ["an empty string", ""],
    ["a missing field (null)", null],
  ])("rejects %s as an invalid end date", (_label, endDate) => {
    expect(parseBlockedRange(range({ endDate }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { endDate: M.endDateInvalid },
    });
  });

  it("reports both a past start and a reversed range", () => {
    expect(parseBlockedRange(range({ startDate: "2026-11-20", endDate: "2026-11-19" }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { startDate: M.startDatePast, endDate: M.endDateBeforeStart },
    });
  });

  it("reports both dates when both are invalid", () => {
    expect(parseBlockedRange(range({ startDate: "", endDate: "nope" }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { startDate: M.startDateInvalid, endDate: M.endDateInvalid },
    });
  });
});

describe("parseBlockedRange: note", () => {
  it.each([
    ["absent (null)", null],
    ["empty", ""],
    ["whitespace only", "   \n\t "],
  ])("stores no note when it is %s", (_label, note) => {
    expect(parseBlockedRange(range({ note }), TODAY)).toEqual({
      ok: true,
      value: { startDate: "2026-12-01", endDate: "2026-12-03", note: null },
    });
  });

  it("trims the note", () => {
    expect(parseBlockedRange(range({ note: "  Away for the holidays  " }), TODAY)).toEqual({
      ok: true,
      value: { startDate: "2026-12-01", endDate: "2026-12-03", note: "Away for the holidays" },
    });
  });

  it(`accepts a note of exactly ${NOTE_MAX} characters, measured after trimming`, () => {
    const note = "n".repeat(NOTE_MAX);
    expect(parseBlockedRange(range({ note: `  ${note}  ` }), TODAY)).toEqual({
      ok: true,
      value: { startDate: "2026-12-01", endDate: "2026-12-03", note },
    });
  });

  it(`rejects a note of ${NOTE_MAX + 1} characters`, () => {
    expect(parseBlockedRange(range({ note: "n".repeat(NOTE_MAX + 1) }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { note: M.noteTooLong },
    });
  });

  it("rejects a note that isn't text", () => {
    expect(parseBlockedRange(range({ note: new File(["x"], "note.txt") }), TODAY)).toEqual({
      ok: false,
      fieldErrors: { note: M.noteInvalid },
    });
  });
});

describe("parseBlockedRange: input shape", () => {
  it.each([
    ["null", null],
    ["a string", "2026-12-01"],
    ["an empty object", {}],
  ])("rejects %s with both date errors", (_label, input) => {
    expect(parseBlockedRange(input, TODAY)).toEqual({
      ok: false,
      fieldErrors: { startDate: M.startDateInvalid, endDate: M.endDateInvalid },
    });
  });
});

describe.each([
  ["itemIdSchema", itemIdSchema],
  ["availabilityIdSchema", availabilityIdSchema],
])("%s", (_name, schema) => {
  it.each([
    ["a cuid-style ID", "clx0item000000001"],
    ["a UUID", "550e8400-e29b-41d4-a716-446655440000"],
    ["an ID with underscores", "item_one"],
    ["an ID of exactly 64 characters", "a".repeat(64)],
  ])("accepts %s", (_label, id) => {
    expect(schema.safeParse(id).success).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["an ID longer than 64 characters", "a".repeat(65)],
    ["a path traversal attempt", "../other"],
    ["a slash", "abc/def"],
    ["inner whitespace", "a b"],
    ["a URL-encoded value", "abc%2F"],
    ["a number", 123],
    ["null", null],
  ])("rejects %s", (_label, id) => {
    expect(schema.safeParse(id).success).toBe(false);
  });
});

describe("itemRouteParamsSchema", () => {
  it("accepts a valid community ID and item ID", () => {
    expect(itemRouteParamsSchema.parse({ communityId: "clx0community0001", itemId: "clx0item000000001" })).toEqual({
      communityId: "clx0community0001",
      itemId: "clx0item000000001",
    });
  });

  it.each([
    ["a client-supplied ownerId", { communityId: "clx0community0001", itemId: "clx0item000000001", ownerId: "u1" }],
    ["a client-supplied role", { communityId: "clx0community0001", itemId: "clx0item000000001", role: "ADMIN" }],
    ["a missing item ID", { communityId: "clx0community0001" }],
    ["an invalid item ID", { communityId: "clx0community0001", itemId: "../x" }],
    ["an invalid community ID", { communityId: "a/b", itemId: "clx0item000000001" }],
  ])("rejects %s", (_label, params) => {
    expect(itemRouteParamsSchema.safeParse(params).success).toBe(false);
  });
});
