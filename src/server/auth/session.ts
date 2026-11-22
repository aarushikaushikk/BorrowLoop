import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { parseCallbackUrl } from "@/lib/validation/auth";
import { SIGN_IN_PATH } from "@/server/auth/config";

/** The signed-in user, narrowed to what the app needs. No email or tokens. */
export type CurrentUser = { id: string; name: string | null; image: string | null };

const sessionSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    name: z.string().nullish(),
    image: z.string().nullish(),
  }),
});

/**
 * Returns the signed-in user, or `null` when there is no valid session.
 *
 * Reads request headers, so with `cacheComponents` it must be called inside a
 * `<Suspense>` boundary, a Server Action, or a route handler.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const parsed = sessionSchema.safeParse(await auth());
  if (!parsed.success) {
    return null;
  }
  const { id, name, image } = parsed.data.user;
  return { id, name: name ?? null, image: image ?? null };
}

/**
 * Returns the signed-in user, or redirects to the sign-in page.
 *
 * `callbackPath` is where to return after sign-in. Unsafe values (other
 * origins, protocol-relative URLs, and so on) fall back to the default.
 */
export async function requireUser(callbackPath?: unknown): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const callbackUrl = encodeURIComponent(parseCallbackUrl(callbackPath));
    redirect(`${SIGN_IN_PATH}?callbackUrl=${callbackUrl}`);
  }
  return user;
}
