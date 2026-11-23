// Codes stored in Item.flagReason when a listing is held for admin review
// (US-2 / US-8). Client-safe: no secrets or server-only imports.

/** Prohibited-item categories Claude may flag from a photo (team decision, #7). */
export const PROHIBITED_ITEM_CODES = [
  "WEAPON", // including replicas and ammunition
  "DRUGS", // including paraphernalia
  "ALCOHOL_TOBACCO", // including vapes
  "PRESCRIPTION_MEDS",
  "HAZARDOUS",
  "ADULT",
  "ID_DOCUMENTS", // ID cards and other personal documents
] as const;

export type ProhibitedItemCode = (typeof PROHIBITED_ITEM_CODES)[number];

/** Stored when the safety check itself fails (timeout, refusal, bad output). */
export const SAFETY_CHECK_FAILED = "SAFETY_CHECK_FAILED";
