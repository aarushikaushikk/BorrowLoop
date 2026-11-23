import { parseCallbackUrl } from "@/lib/validation/auth";
import { communityParamsSchema } from "@/lib/validation/community";

export const SIGN_IN_PATH = "/sign-in";
export const COMMUNITIES_PATH = "/communities";

/**
 * The path of a community page (`/c/<id><subpath>`) built from untrusted
 * route params, for use as a sign-in return path. Falls back to
 * /communities when the community ID isn't valid.
 */
export function communityPathFor(params: unknown, subpath: "" | "/admin" | "/items/new" = ""): string {
  const parsed = communityParamsSchema.safeParse(params);
  return parsed.success ? `/c/${parsed.data.communityId}${subpath}` : COMMUNITIES_PATH;
}

/**
 * The sign-in URL that returns to `callbackPath` afterwards. Unsafe
 * destinations fall back to the default (see `parseCallbackUrl`).
 */
export function signInPathFor(callbackPath: unknown): string {
  return `${SIGN_IN_PATH}?callbackUrl=${encodeURIComponent(parseCallbackUrl(callbackPath))}`;
}
