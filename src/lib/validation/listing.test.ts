import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, isPhotoTooLarge } from "./listing";

// US-2: browser-side size check, for UX only. validateUpload on the server stays
// authoritative. The boundary matches it: exactly MAX_UPLOAD_BYTES is too large,
// because photos must be strictly under 5 MB.

describe("isPhotoTooLarge", () => {
  it.each([
    ["0 bytes", 0, false],
    ["MAX_UPLOAD_BYTES - 1", MAX_UPLOAD_BYTES - 1, false],
    ["exactly MAX_UPLOAD_BYTES", MAX_UPLOAD_BYTES, true],
    ["MAX_UPLOAD_BYTES + 1", MAX_UPLOAD_BYTES + 1, true],
  ])("%s (%i bytes) → %s", (_label, size, expected) => {
    expect(isPhotoTooLarge(size)).toBe(expected);
  });
});
