import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { validateUpload } from "./validate-upload";

// US-2 AC: JPEG and PNG only, under 5 MB, invalid uploads rejected with a clear
// message. The type is decided from the file's bytes, not its name or declared type.

const FIVE_MB = 5 * 1024 * 1024;

// Real 1×1 images. The JPEG was produced by re-encoding the PNG with macOS `sips`.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG_1X1 = Buffer.from(
  "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A/Syiiiv5XP4rP//Z",
  "base64",
);
const GIF_1X1 = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1");

function fileOf(bytes: Uint8Array, name: string, type: string): File {
  // Copy into a plain ArrayBuffer-backed array, which is what BlobPart accepts.
  return new File([Uint8Array.from(bytes)], name, { type });
}

/** Real image bytes followed by zero padding, to reach an exact file size. */
function paddedTo(bytes: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  out.set(bytes);
  return out;
}

/** A PNG whose 8-byte signature has one byte changed. */
function withCorruptPngSignature(): Uint8Array {
  const out = Uint8Array.from(PNG_1X1);
  out[4] = 0x00; // signature byte 4 must be 0x0D
  return out;
}

const NAMES_ALLOWED_TYPES = { ok: false, error: expect.stringMatching(/^(?=.*JPEG)(?=.*PNG)/) };
const NAMES_SIZE_LIMIT = { ok: false, error: expect.stringContaining("5 MB") };

describe("validateUpload", () => {
  describe("accepts JPEG and PNG under 5 MB", () => {
    it("accepts a real JPEG", async () => {
      await expect(validateUpload(fileOf(JPEG_1X1, "drill.jpg", "image/jpeg"))).resolves.toEqual({
        ok: true,
        mime: "image/jpeg",
      });
    });

    it("accepts a real PNG", async () => {
      await expect(validateUpload(fileOf(PNG_1X1, "drill.png", "image/png"))).resolves.toEqual({
        ok: true,
        mime: "image/png",
      });
    });

    it("accepts a JPEG of 5 MB minus one byte", async () => {
      const file = fileOf(paddedTo(JPEG_1X1, FIVE_MB - 1), "big.jpg", "image/jpeg");
      expect(file.size).toBe(FIVE_MB - 1);

      await expect(validateUpload(file)).resolves.toEqual({ ok: true, mime: "image/jpeg" });
    });
  });

  describe("rejects files that are not under 5 MB", () => {
    it("rejects a JPEG of exactly 5 MB, naming the limit", async () => {
      const file = fileOf(paddedTo(JPEG_1X1, FIVE_MB), "too-big.jpg", "image/jpeg");
      expect(file.size).toBe(FIVE_MB);

      await expect(validateUpload(file)).resolves.toEqual(NAMES_SIZE_LIMIT);
    });
  });

  describe("rejects anything that is not a real JPEG or PNG, naming the allowed types", () => {
    it.each([
      ["an empty file", () => fileOf(new Uint8Array(0), "photo.jpg", "image/jpeg")],
      ["a GIF", () => fileOf(GIF_1X1, "photo.gif", "image/gif")],
      ["PDF bytes named photo.jpg and declared image/jpeg", () => fileOf(PDF_BYTES, "photo.jpg", "image/jpeg")],
      ["JPEG bytes declared image/png", () => fileOf(JPEG_1X1, "photo.png", "image/png")],
      ["a JPEG truncated after its first two bytes", () => fileOf(JPEG_1X1.subarray(0, 2), "photo.jpg", "image/jpeg")],
      ["a PNG truncated inside its signature", () => fileOf(PNG_1X1.subarray(0, 4), "photo.png", "image/png")],
      ["a PNG with a corrupt signature", () => fileOf(withCorruptPngSignature(), "photo.png", "image/png")],
    ])("rejects %s", async (_label, makeFile) => {
      await expect(validateUpload(makeFile())).resolves.toEqual(NAMES_ALLOWED_TYPES);
    });
  });
});
