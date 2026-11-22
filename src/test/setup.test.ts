import { describe, expect, it } from "vitest";
import { ALIAS_FIXTURE } from "@/test/alias-fixture";

describe("Vitest setup", () => {
  it("resolves the @/ path alias from tsconfig.json", () => {
    expect(ALIAS_FIXTURE).toBe("resolved-via-tsconfig-paths");
  });

  it("runs in a Node environment without browser globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    expect(typeof process.versions.node).toBe("string");
  });
});
