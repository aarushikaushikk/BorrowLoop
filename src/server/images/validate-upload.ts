import "server-only";

/** Image types accepted for item photos (US-2). */
export type AllowedImageMime = "image/jpeg" | "image/png";

export type UploadValidationResult =
  | { ok: true; mime: AllowedImageMime }
  | { ok: false; error: string };

/** Photos must be strictly under 5 MB (PRD US-2). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const TYPE_ERROR = "Please upload a JPEG or PNG photo.";
const SIZE_ERROR = "Please upload a photo under 5 MB.";

/** File signatures ("magic bytes") for the allowed types. */
const SIGNATURES: ReadonlyArray<{ mime: AllowedImageMime; bytes: readonly number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

const HEADER_LENGTH = Math.max(...SIGNATURES.map((s) => s.bytes.length));

/**
 * Checks an uploaded item photo before anything is sent to Claude or Cloudinary.
 *
 * - Size comes from `file.size`; files of 5 MB or more are rejected.
 * - The type is decided from the file's first bytes, never from its name. Only
 *   the header is read, not the whole file.
 * - The declared type must match the detected one, so JPEG bytes sent as
 *   `image/png` (or anything else) are rejected.
 */
export async function validateUpload(file: File): Promise<UploadValidationResult> {
  if (file.size >= MAX_UPLOAD_BYTES) {
    return { ok: false, error: SIZE_ERROR };
  }

  const header = new Uint8Array(await file.slice(0, HEADER_LENGTH).arrayBuffer());
  const detected = SIGNATURES.find(({ bytes }) =>
    bytes.every((byte, index) => header[index] === byte),
  );

  if (!detected || detected.mime !== file.type) {
    return { ok: false, error: TYPE_ERROR };
  }
  return { ok: true, mime: detected.mime };
}
