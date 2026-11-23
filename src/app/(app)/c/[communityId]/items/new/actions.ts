"use server";

import { z } from "zod";
import { ItemCategory, ItemCondition, ItemStatus } from "@/generated/prisma/enums";
import { COMMUNITIES_PATH } from "@/lib/auth/routes";
import { uploadImage } from "@/lib/cloudinary";
import { DESCRIPTION_MAX, listingFieldsSchema, TITLE_MAX } from "@/lib/validation/listing";
import { suggestListing, type ListingSuggestion } from "@/server/ai/listing-suggestion";
import { getCommunityAccess } from "@/server/auth/community-access";
import { createDraftListing, publishDraftListing } from "@/server/dal/listing-drafts";
import { decideListingModeration } from "@/server/domain/listing-moderation";
import { UPLOAD_TYPE_ERROR, validateUpload } from "@/server/images/validate-upload";

/**
 * The result shown by the photo step of the new-listing form. Never includes
 * the flag reason: moderation details stay on the server.
 */
export type AnalyzePhotoState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; draftId: string; suggestion: ListingSuggestion; manualEntry: false }
  | { status: "ready"; draftId: string; suggestion: null; manualEntry: true };

const ANALYZE_FAILED_MESSAGE = "We couldn't process that photo. Refresh the page and try again.";

/** Draft fields when Claude gave no suggestion; the lender fills them in. */
const MANUAL_ENTRY_FIELDS: ListingSuggestion = {
  title: "",
  description: "",
  category: ItemCategory.OTHER,
  condition: ItemCondition.GOOD,
};

/**
 * Validates an uploaded photo, stores it, asks Claude for listing fields, and
 * saves a DRAFT listing for the signed-in member.
 *
 * Server Actions are public POST endpoints, so this checks everything itself:
 * 1. Session and membership through the US-1 guard (`getCommunityAccess`).
 *    Signed-out callers are redirected; only `communityId` is read from the
 *    form for it, and non-members get the generic error.
 * 2. The photo is validated by content before anything leaves the server.
 * 3. The upload and the Claude call run in parallel. `suggestListing` never
 *    throws; a failed suggestion means manual entry and a held listing.
 * 4. The flag reason comes from `decideListingModeration`, never from the form,
 *    and is stored on the draft but not returned.
 * Unexpected errors return one generic message, never internal details.
 */
export async function analyzePhotoAction(
  _previousState: AnalyzePhotoState,
  formData: FormData,
): Promise<AnalyzePhotoState> {
  const { user, access } = await getCommunityAccess({
    params: { communityId: formData.get("communityId") },
    level: "member",
    callbackPath: COMMUNITIES_PATH,
  });
  if (access.decision !== "allow") {
    return { status: "error", message: ANALYZE_FAILED_MESSAGE };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File)) {
    return { status: "error", message: UPLOAD_TYPE_ERROR };
  }
  const validation = await validateUpload(photo);
  if (!validation.ok) {
    return { status: "error", message: validation.error };
  }

  try {
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const [uploaded, result] = await Promise.all([
      uploadImage(Buffer.from(bytes)),
      suggestListing({ bytes, mime: validation.mime }),
    ]);

    const { flagReason } = decideListingModeration(result);
    const fields = result.status === "ok" ? result.suggestion : MANUAL_ENTRY_FIELDS;
    const draft = await createDraftListing(
      { id: user.id },
      { communityId: access.communityId, ...fields, flagReason, photo: uploaded },
    );
    if (draft === "not_found") {
      return { status: "error", message: ANALYZE_FAILED_MESSAGE };
    }

    return result.status === "ok"
      ? { status: "ready", draftId: draft.id, suggestion: result.suggestion, manualEntry: false }
      : { status: "ready", draftId: draft.id, suggestion: null, manualEntry: true };
  } catch {
    return { status: "error", message: ANALYZE_FAILED_MESSAGE };
  }
}

/** Form fields that can carry a validation error on the save step. */
export type SaveListingField = "draftId" | "title" | "description" | "category" | "condition";

/**
 * The result shown by the save step. On success it says whether the listing is
 * live or held for review, never why it was held.
 */
export type SaveListingState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<SaveListingField, string>> }
  | { status: "saved"; outcome: "published" | "pending_review" };

const SAVE_FAILED_MESSAGE = "We couldn't save your listing. Refresh the page and try again.";
const FIX_FIELDS_MESSAGE = "Please fix the highlighted fields.";

/** User-facing messages per field, so Zod's internal wording never reaches the page. */
const FIELD_ERROR_MESSAGES: Record<SaveListingField, string> = {
  draftId: "This draft is no longer valid. Refresh the page and try again.",
  title: `Enter a title of 1 to ${TITLE_MAX} characters.`,
  description: `Enter a description of 1 to ${DESCRIPTION_MAX} characters.`,
  category: "Choose a category from the list.",
  condition: "Choose a condition from the list.",
};

/** The save form: the shared listing fields plus the draft being saved. */
const saveListingSchema = listingFieldsSchema.extend({
  draftId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
});

/**
 * Saves the lender's edited fields to their draft and publishes it, or holds
 * it for review.
 *
 * - Session and membership go through the US-1 guard first, as in
 *   `analyzePhotoAction`.
 * - Only the five named fields are read from the form. `status`, `flagReason`,
 *   `ownerId` and the like are never read; the data layer derives the owner
 *   from the session and the status from the flag stored on the draft.
 * - A draft that doesn't match (another user's, already published, or a
 *   removed member's) and any unexpected error both return the same generic
 *   message, so the reply never reveals whether a draft exists.
 * - On success the state says published or held for review, never why.
 */
export async function saveListingAction(
  _previousState: SaveListingState,
  formData: FormData,
): Promise<SaveListingState> {
  const { user, access } = await getCommunityAccess({
    params: { communityId: formData.get("communityId") },
    level: "member",
    callbackPath: COMMUNITIES_PATH,
  });
  if (access.decision !== "allow") {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }

  const parsed = saveListingSchema.safeParse({
    draftId: formData.get("draftId"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    condition: formData.get("condition"),
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<SaveListingField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && field in FIELD_ERROR_MESSAGES) {
        fieldErrors[field as SaveListingField] = FIELD_ERROR_MESSAGES[field as SaveListingField];
      }
    }
    return { status: "error", message: FIX_FIELDS_MESSAGE, fieldErrors };
  }

  const { draftId, ...fields } = parsed.data;
  try {
    const result = await publishDraftListing({ id: user.id }, { itemId: draftId, ...fields });
    if (result === "not_found") {
      return { status: "error", message: SAVE_FAILED_MESSAGE };
    }
    return {
      status: "saved",
      outcome: result.status === ItemStatus.PUBLISHED ? "published" : "pending_review",
    };
  } catch {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }
}
