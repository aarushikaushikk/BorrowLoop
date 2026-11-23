// Listing validation shared by the server and the browser. No secrets or
// server-only imports belong here.

/** Item photos must be strictly under 5 MB (PRD US-2). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Listing title length, measured after trimming: 1 to TITLE_MAX characters. */
export const TITLE_MAX = 100;

/** Listing description length, measured after trimming: 1 to DESCRIPTION_MAX characters. */
export const DESCRIPTION_MAX = 1000;

/**
 * Browser-side size check for photo uploads (UX only; the server's
 * validateUpload stays authoritative). Uses the same boundary: exactly
 * MAX_UPLOAD_BYTES is too large.
 */
export function isPhotoTooLarge(size: number): boolean {
  return size >= MAX_UPLOAD_BYTES;
}
