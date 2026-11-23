"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent, type ReactElement } from "react";
import {
  analyzePhotoAction,
  saveListingAction,
  type AnalyzePhotoState,
  type SaveListingField,
  type SaveListingState,
} from "@/app/(app)/c/[communityId]/items/new/actions";
import type { ItemCategory, ItemCondition } from "@/generated/prisma/enums";
import { ITEM_CATEGORY_LABELS, ITEM_CONDITION_LABELS } from "@/lib/items/labels";
import { DESCRIPTION_MAX, isPhotoTooLarge, TITLE_MAX } from "@/lib/validation/listing";

const INITIAL_ANALYZE_STATE: AnalyzePhotoState = { status: "idle" };
const INITIAL_SAVE_STATE: SaveListingState = { status: "idle" };

function isCategory(value: string): value is ItemCategory {
  return Object.hasOwn(ITEM_CATEGORY_LABELS, value);
}

function isCondition(value: string): value is ItemCondition {
  return Object.hasOwn(ITEM_CONDITION_LABELS, value);
}

const TOO_LARGE_MESSAGE ="This photo is 5 MB or larger. Please choose a smaller JPEG or PNG.";

const inputClass =
  "w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 aria-invalid:border-red-600 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-100";
const buttonClass =
  "h-10 self-start rounded-full bg-emerald-700 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60";

/**
 * The two-step new-listing form.
 *
 * Step 1 uploads a photo (checked for size here for UX only; the server
 * validates it again). Step 2 edits the suggested fields and saves them. All
 * text, including Claude's suggestions, renders as plain text. Who owns the
 * listing and whether it's held for review are decided on the server.
 */
export function NewListingForm({ communityId }: { communityId: string }): ReactElement {
  const [analyzeState, analyzeAction, analyzing] = useActionState(analyzePhotoAction, INITIAL_ANALYZE_STATE);

  if (analyzeState.status === "ready") {
    return <DetailsStep key={analyzeState.draftId} communityId={communityId} analyzed={analyzeState} />;
  }

  return <PhotoStep communityId={communityId} state={analyzeState} action={analyzeAction} pending={analyzing} />;
}

function PhotoStep({
  communityId,
  state,
  action,
  pending,
}: {
  communityId: string;
  state: AnalyzePhotoState;
  action: (formData: FormData) => void;
  pending: boolean;
}): ReactElement {
  const [localError, setLocalError] = useState<string | null>(null);

  function checkSize(file: File | undefined): boolean {
    const tooLarge = file !== undefined && isPhotoTooLarge(file.size);
    setLocalError(tooLarge ? TOO_LARGE_MESSAGE : null);
    return !tooLarge;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const input = event.currentTarget.elements.namedItem("photo");
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!checkSize(file)) {
      // Stops the upload before anything is sent.
      event.preventDefault();
    }
  }

  const message = localError ?? (state.status === "error" ? state.message : null);

  return (
    <form action={action} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="communityId" value={communityId} />
      <div className="flex flex-col gap-2">
        <label htmlFor="photo" className="text-sm font-medium">
          Photo of the item (JPEG or PNG, under 5 MB)
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png"
          required
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? "photo-error" : undefined}
          onChange={(event) => checkSize(event.currentTarget.files?.[0])}
          className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-800 dark:file:bg-emerald-950 dark:file:text-emerald-200"
        />
        {message ? (
          <p id="photo-error" role="alert" className="text-sm text-red-700 dark:text-red-400">
            {message}
          </p>
        ) : null}
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Looking at your photo…" : "Upload and suggest details"}
      </button>
    </form>
  );
}

type ReadyState = Extract<AnalyzePhotoState, { status: "ready" }>;

function DetailsStep({ communityId, analyzed }: { communityId: string; analyzed: ReadyState }): ReactElement {
  const [saveState, saveAction, saving] = useActionState(saveListingAction, INITIAL_SAVE_STATE);

  // Controlled fields: React resets uncontrolled form fields after each action
  // call, which would wipe the lender's edits when the server returns errors.
  const suggestion = analyzed.suggestion;
  const [title, setTitle] = useState(suggestion?.title ?? "");
  const [description, setDescription] = useState(suggestion?.description ?? "");
  const [category, setCategory] = useState<ItemCategory | "">(suggestion?.category ?? "");
  const [condition, setCondition] = useState<ItemCondition | "">(suggestion?.condition ?? "");

  if (saveState.status === "saved") {
    return <SavedNotice communityId={communityId} outcome={saveState.outcome} />;
  }

  const fieldErrors = saveState.status === "error" ? (saveState.fieldErrors ?? {}) : {};
  const errorProps = (field: SaveListingField) =>
    fieldErrors[field]
      ? { "aria-invalid": true as const, "aria-describedby": `${field}-error` }
      : {};

  return (
    <form action={saveAction} className="flex flex-col gap-5">
      <input type="hidden" name="communityId" value={communityId} />
      <input type="hidden" name="draftId" value={analyzed.draftId} />

      {analyzed.manualEntry ? (
        <p role="status" className="rounded-xl border border-black/10 bg-zinc-50 p-4 text-sm dark:border-white/15 dark:bg-zinc-900">
          We couldn&apos;t suggest details for this photo. Please fill in the fields yourself.
        </p>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Here are suggested details. Check them and change anything before saving.
        </p>
      )}

      {saveState.status === "error" ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {saveState.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={inputClass}
          {...errorProps("title")}
        />
        <FieldError field="title" message={fieldErrors.title} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={inputClass}
          {...errorProps("description")}
        />
        <FieldError field="description" message={fieldErrors.description} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="category"
            name="category"
            required
            value={category}
            onChange={(event) => setCategory(isCategory(event.target.value) ? event.target.value : "")}
            className={inputClass}
            {...errorProps("category")}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {Object.entries(ITEM_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError field="category" message={fieldErrors.category} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="condition" className="text-sm font-medium">
            Condition
          </label>
          <select
            id="condition"
            name="condition"
            required
            value={condition}
            onChange={(event) => setCondition(isCondition(event.target.value) ? event.target.value : "")}
            className={inputClass}
            {...errorProps("condition")}
          >
            <option value="" disabled>
              Choose a condition
            </option>
            {Object.entries(ITEM_CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError field="condition" message={fieldErrors.condition} />
        </div>
      </div>

      <FieldError field="draftId" message={fieldErrors.draftId} />

      <button type="submit" disabled={saving} className={buttonClass}>
        {saving ? "Saving…" : "Save listing"}
      </button>
    </form>
  );
}

function FieldError({ field, message }: { field: SaveListingField; message: string | undefined }): ReactElement | null {
  if (!message) return null;
  return (
    <p id={`${field}-error`} className="text-sm text-red-700 dark:text-red-400">
      {message}
    </p>
  );
}

function SavedNotice({
  communityId,
  outcome,
}: {
  communityId: string;
  outcome: "published" | "pending_review";
}): ReactElement {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border border-black/10 p-6 dark:border-white/15">
      <h2 className="text-lg font-semibold">
        {outcome === "published" ? "Your listing is live" : "Your listing is awaiting review"}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {outcome === "published"
          ? "Members of your community can now see it."
          : "A community admin will review it before other members can see it."}
      </p>
      <Link
        href={`/c/${communityId}`}
        className="text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-400"
      >
        Back to the community
      </Link>
    </div>
  );
}
