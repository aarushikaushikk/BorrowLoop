import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALLBACK_PATH,
  parseCallbackUrl,
  parseSignInSearchParams,
} from "@/lib/validation/auth";

describe("parseSignInSearchParams", () => {
  it("keeps a safe callbackUrl and reports no error", () => {
    expect(parseSignInSearchParams({ callbackUrl: "/c/clx0community0001" })).toEqual({
      callbackUrl: "/c/clx0community0001",
      hasError: false,
    });
  });

  it.each([
    ["no params", {}],
    ["an external callbackUrl", { callbackUrl: "https://evil.example" }],
    ["repeated callbackUrl params", { callbackUrl: ["/a", "/b"] }],
  ])("falls back to the default callbackUrl for %s", (_label, params) => {
    expect(parseSignInSearchParams(params).callbackUrl).toBe(DEFAULT_CALLBACK_PATH);
  });

  it.each([
    ["an Auth.js error code", { error: "OAuthCallbackError" }],
    ["an unexpected error value", { error: "<script>alert(1)</script>" }],
    ["repeated error params", { error: ["a", "b"] }],
  ])("reports an error for %s without exposing its value", (_label, params) => {
    expect(parseSignInSearchParams(params)).toEqual({
      callbackUrl: DEFAULT_CALLBACK_PATH,
      hasError: true,
    });
  });

  it("ignores an empty error param", () => {
    expect(parseSignInSearchParams({ error: "" }).hasError).toBe(false);
  });
});

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
