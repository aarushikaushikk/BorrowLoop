import "server-only";
import NextAuth from "next-auth";
import { createAuthAdapter } from "@/server/auth/adapter";
import { authConfig } from "@/server/auth/config";
import { getDb } from "@/server/db/client";

// The adapter persists Google identities (User + Account). It only connects to
// the database when Auth.js calls it during sign-in, so importing this module
// needs no DATABASE_URL.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: createAuthAdapter(getDb),
});
