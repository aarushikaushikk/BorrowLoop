"use server";

import { signOut } from "@/auth";
import { SIGN_IN_PATH } from "@/lib/auth/routes";

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: SIGN_IN_PATH });
}
