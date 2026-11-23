import "server-only";

/** Image types accepted for item photos (US-2). */
export type AllowedImageMime = "image/jpeg" | "image/png";

export type UploadValidationResult =
  | { ok: true; mime: AllowedImageMime }
  | { ok: false; error: string };

/**
 * Checks an uploaded item photo before anything is sent to Claude or Cloudinary.
 *
 * RED placeholder (US-2 cycle 1): no validation is implemented yet.
 */
export async function validateUpload(file: File): Promise<UploadValidationResult> {
  void file;
  return { ok: false, error: "" };
}
