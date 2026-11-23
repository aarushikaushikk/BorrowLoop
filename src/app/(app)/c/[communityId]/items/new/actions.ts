"use server";

import type { ListingSuggestion } from "@/server/ai/listing-suggestion";

/**
 * The result shown by the photo step of the new-listing form. Never includes
 * the flag reason: moderation details stay on the server.
 */
export type AnalyzePhotoState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; draftId: string; suggestion: ListingSuggestion; manualEntry: false }
  | { status: "ready"; draftId: string; suggestion: null; manualEntry: true };

/**
 * Validates an uploaded photo, stores it, asks Claude for listing fields, and
 * saves a DRAFT listing for the signed-in member.
 *
 * RED placeholder (US-2 cycle 9): no logic yet.
 */
export async function analyzePhotoAction(
  previousState: AnalyzePhotoState,
  formData: FormData,
): Promise<AnalyzePhotoState> {
  void previousState;
  void formData;
  return { status: "idle" };
}
