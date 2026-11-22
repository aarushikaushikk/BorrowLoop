import { z } from "zod";

/** Where users land after sign-in when no safe callback URL is given. */
export const DEFAULT_CALLBACK_PATH = "/communities";

const MAX_CALLBACK_LENGTH = 2048;

// Any origin works as the base. The check below only needs to confirm that
// resolving the path against it doesn't switch to another origin.
const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

/**
 * A same-origin path such as `/c/abc?tab=items`.
 *
 * Rejects absolute and protocol-relative URLs, backslashes (which browsers
 * treat like `/`), and control or whitespace characters (which browsers strip,
 * so `/\t/evil.example` would become `//evil.example`).
 */
const callbackPathSchema = z
  .string()
  .max(MAX_CALLBACK_LENGTH)
  .startsWith("/")
  .refine((path) => !path.startsWith("//"))
  .refine((path) => !/[\\\s\u0000-\u001f\u007f]/.test(path))
  .refine((path) => new URL(path, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN);

/**
 * Returns `input` when it's a safe same-origin path, otherwise the default.
 * Never throws, so callers can pass raw search params straight in.
 */
export function parseCallbackUrl(input: unknown): string {
  const parsed = callbackPathSchema.safeParse(input);
  return parsed.success ? parsed.data : DEFAULT_CALLBACK_PATH;
}
