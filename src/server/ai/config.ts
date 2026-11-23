import "server-only";

/** Default model for photo-to-listing suggestions (claude-api skill default). */
const DEFAULT_LISTING_SUGGESTION_MODEL = "claude-opus-5-5";

/**
 * The Claude model used for photo-to-listing suggestions (US-2). Set
 * ANTHROPIC_LISTING_MODEL to override it without a code change.
 */
export function getListingSuggestionModel(): string {
  return process.env.ANTHROPIC_LISTING_MODEL || DEFAULT_LISTING_SUGGESTION_MODEL;
}
