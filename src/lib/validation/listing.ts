// Listing validation shared by the server and the browser. No secrets or
// server-only imports belong here.

/** Item photos must be strictly under 5 MB (PRD US-2). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Browser-side size check for photo uploads (UX only; the server's
 * validateUpload stays authoritative). Uses the same boundary: exactly
 * MAX_UPLOAD_BYTES is too large.
 */
export function isPhotoTooLarge(size: number): boolean {
  return size >= MAX_UPLOAD_BYTES;
}
