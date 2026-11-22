import { describe, expect, it } from "vitest";
import { DEFAULT_CALLBACK_PATH, parseCallbackUrl } from "@/lib/validation/auth";

describe("parseCallbackUrl", () => {
  it("uses /communities as the default destination", () => {
    expect(DEFAULT_CALLBACK_PATH).toBe("/communities");
  });

  it.each([
    "/communities",
    "/c/clx0community0001",
    "/c/clx0community0001/admin?tab=reports#queue",
    "/",
  ])("accepts the same-origin path %s unchanged", (path) => {
    expect(parseCallbackUrl(path)).toBe(path);
  });

  it.each([
    ["a missing value", undefined],
    ["null", null],
    ["an empty string", ""],
    ["an absolute https URL", "https://evil.example/phish"],
    ["an absolute http URL", "http://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash host", "/\\evil.example"],
    ["a double-backslash host", "\\\\evil.example"],
    ["a tab hidden inside //", "/\t/evil.example"],
    ["a newline hidden inside //", "/\n/evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
    ["a path without a leading slash", "communities"],
    ["a path longer than 2048 characters", `/${"a".repeat(2048)}`],
    ["an array of values", ["/communities"]],
    ["a number", 42],
  ])("falls back to the default for %s", (_label, input) => {
    expect(parseCallbackUrl(input)).toBe(DEFAULT_CALLBACK_PATH);
  });

  it("accepts a path of exactly 2048 characters", () => {
    const path = `/${"a".repeat(2047)}`;
    expect(parseCallbackUrl(path)).toBe(path);
  });
});
