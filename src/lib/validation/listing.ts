// Listing validation shared by the server and the browser. No secrets or
// server-only imports belong here. (@/generated/prisma/enums is a plain
// constants file with no imports, so it's safe for the browser too.)

import { z } from "zod";
import { ItemCategory, ItemCondition } from "@/generated/prisma/enums";

/** Item photos must be strictly under 5 MB (PRD US-2). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Listing title length, measured after trimming: 1 to TITLE_MAX characters. */
export const TITLE_MAX = 100;

/** Listing description length, measured after trimming: 1 to DESCRIPTION_MAX characters. */
export const DESCRIPTION_MAX = 1000;

/**
 * The editable listing fields as the lender submits them. Title and description
 * are trimmed, then length-checked; category and condition must be values of
 * the Prisma enums.
 */
export const listingFieldsSchema = z.object({
  title: z.string().trim().min(1).max(TITLE_MAX),
  description: z.string().trim().min(1).max(DESCRIPTION_MAX),
  category: z.enum(ItemCategory),
  condition: z.enum(ItemCondition),
});

/**
 * Browser-side size check for photo uploads (UX only; the server's
 * validateUpload stays authoritative). Uses the same boundary: exactly
 * MAX_UPLOAD_BYTES is too large.
 */
export function isPhotoTooLarge(size: number): boolean {
  return size >= MAX_UPLOAD_BYTES;
}
