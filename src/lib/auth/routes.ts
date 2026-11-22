import { parseCallbackUrl } from "@/lib/validation/auth";

export const SIGN_IN_PATH = "/sign-in";

/**
 * The sign-in URL that returns to `callbackPath` afterwards. Unsafe
 * destinations fall back to the default (see `parseCallbackUrl`).
 */
export function signInPathFor(callbackPath: unknown): string {
  return `${SIGN_IN_PATH}?callbackUrl=${encodeURIComponent(parseCallbackUrl(callbackPath))}`;
}
