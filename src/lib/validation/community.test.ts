import { describe, expect, it } from "vitest";
import { communityIdSchema, communityParamsSchema } from "@/lib/validation/community";

describe("communityIdSchema", () => {
  it.each([
    ["a cuid-style ID", "clx0community0001"],
    ["a UUID", "550e8400-e29b-41d4-a716-446655440000"],
    ["an ID with underscores", "community_one"],
    ["a single character", "a"],
    ["an ID of exactly 64 characters", "a".repeat(64)],
  ])("accepts %s", (_label, id) => {
    expect(communityIdSchema.safeParse(id).success).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["an ID longer than 64 characters", "a".repeat(65)],
    ["a path traversal attempt", "../other"],
    ["a slash", "abc/def"],
    ["leading whitespace", " abc"],
    ["inner whitespace", "a b"],
    ["a URL-encoded value", "abc%2F..%2F"],
    ["a number", 123],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s", (_label, id) => {
    expect(communityIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("communityParamsSchema", () => {
  it("accepts an object with a valid community ID", () => {
    expect(communityParamsSchema.parse({ communityId: "clx0community0001" })).toEqual({
      communityId: "clx0community0001",
    });
  });

  it.each([
    ["a client-supplied userId", { communityId: "clx0community0001", userId: "u1" }],
    ["a client-supplied role", { communityId: "clx0community0001", role: "ADMIN" }],
  ])("rejects unknown fields such as %s", (_label, params) => {
    expect(communityParamsSchema.safeParse(params).success).toBe(false);
  });

  it("rejects a missing community ID", () => {
    expect(communityParamsSchema.safeParse({}).success).toBe(false);
  });
});
