"use server";

import { signIn } from "@/auth";
import { parseCallbackUrl } from "@/lib/validation/auth";

/**
 * Starts Google sign-in. The provider is fixed on the server, and the
 * destination is validated so sign-in can't redirect to another site.
 */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  await signIn("google", { redirectTo: parseCallbackUrl(formData.get("callbackUrl")) });
}
