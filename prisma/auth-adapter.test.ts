import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createAuthAdapter } from "@/server/auth/adapter";
import { authConfig, exposeSessionUserId, keepServerIssuedToken } from "@/server/auth/config";
import { createPrismaClient } from "../src/lib/prisma";
// Auth.js's real sign-in/link logic (not in @auth/core's public exports, so
// imported by file path; next-auth pins @auth/core exactly, and
// src/server/auth/adapter.test.ts guards the version).
import { handleLoginOrRegister } from "../node_modules/@auth/core/lib/actions/callback/handle-login.js";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// What this file covers, and what it doesn't:
// - Real: Auth.js core's handleLoginOrRegister, the official @auth/prisma-adapter
//   through our createAuthAdapter, our generated Prisma client over PrismaPg, and
//   the migrated User/Account tables in a disposable PostgreSQL test database.
// - Simulated: the Google callback. The profile and token response below are
//   what Auth.js would hand over after a successful OAuth exchange; Google is
//   never contacted, and the browser redirect/consent flow is not exercised.
//
// Runs only when TEST_DATABASE_URL is set. Never point it at Neon or any
// shared database.

// Unique per run so concurrent or aborted runs can't collide or leave data
// that a later run would trip over.
const RUN = `cp7b-${randomUUID().slice(0, 8)}`;
const GOOGLE_SUB = `${RUN}-google-sub-1`;
const OTHER_GOOGLE_SUB = `${RUN}-google-sub-2`;
const EMAIL = `${RUN}-member@example.test`;
const OTHER_EMAIL = `${RUN}-other@example.test`;
const CHANGED_EMAIL = `${RUN}-renamed@example.test`;

/**
 * Auth.js's fallback when a provider sets no `account()` option (copied from
 * `defaultAccount` in @auth/core `lib/utils/providers.js`), so the harness
 * behaves like Auth.js even if our option were removed.
 */
function authJsDefaultAccount(tokens: Record<string, unknown>) {
  const kept = ["access_token", "id_token", "refresh_token", "expires_at", "scope", "token_type", "session_state"];
  return Object.fromEntries(Object.entries(tokens).filter(([key, value]) => kept.includes(key) && value !== undefined));
}

// Our Google provider as Auth.js sees it after merging `Google({ ...options })`.
const [googleProvider] = authConfig.providers;
const { options: googleOptions, ...googleDefaults } = googleProvider;
const mergedGoogleProvider = {
  ...googleDefaults,
  ...googleOptions,
  account: googleOptions?.account ?? authJsDefaultAccount,
};

type InternalOptions = Parameters<typeof handleLoginOrRegister>[3];

/** Simulated post-callback data for a Google account (`id` is Google's `sub`). */
function googleCallback(sub: string, email: string) {
  return {
    profile: { id: sub, name: "CP-7B Test Member", email, image: null },
    account: {
      provider: "google",
      type: "oidc" as const,
      providerAccountId: sub,
      access_token: "fake-access-token",
      refresh_token: "fake-refresh-token",
      id_token: "fake-id-token",
      expires_at: 1_900_000_000,
      scope: "openid email profile",
      token_type: "bearer" as const,
    },
  };
}

/** The JWT -> session steps Auth.js runs after sign-in (`sub` is `user.id`). */
function sessionUserIdAfterSignIn(userId: string | undefined) {
  const token = keepServerIssuedToken({ token: { sub: userId }, trigger: "signIn" });
  return exposeSessionUserId({
    session: { user: { name: "CP-7B Test Member" }, expires: "2026-12-31T00:00:00.000Z" },
    token,
  }).user?.id;
}

describe.skipIf(!testDatabaseUrl)("Auth.js Prisma adapter (test database, simulated Google callback)", () => {
  const db = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : null!;
  const adapter = createAuthAdapter(() => db);

  function signInWithGoogle(sub: string, email: string) {
    const { profile, account } = googleCallback(sub, email);
    // handleLoginOrRegister reads only these fields for a signed-out OIDC
    // sign-in with JWT sessions, so the partial options object is cast.
    const options = {
      adapter,
      events: {},
      provider: mergedGoogleProvider,
      session: { strategy: "jwt", generateSessionToken: () => "unused" },
    } as unknown as InternalOptions;
    // An empty session token means "nobody is signed in yet".
    return handleLoginOrRegister("", profile, account, options);
  }

  /** Every row this run could have created: by email prefix or by Google sub prefix. */
  const thisRunsUsers = {
    OR: [
      { email: { startsWith: RUN } },
      { accounts: { some: { providerAccountId: { startsWith: RUN } } } },
    ],
  };

  async function cleanUp() {
    // Deleting users removes their accounts too (onDelete: Cascade); the second
    // call catches any account whose user didn't match the first filter.
    await db.user.deleteMany({ where: thisRunsUsers });
    await db.account.deleteMany({ where: { providerAccountId: { startsWith: RUN } } });
  }

  function countThisRun() {
    return Promise.all([
      db.user.count({ where: thisRunsUsers }),
      db.account.count({ where: { providerAccountId: { startsWith: RUN } } }),
    ]);
  }

  beforeAll(cleanUp);
  // afterEach runs even when an assertion fails, so no test leaves rows behind.
  afterEach(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await db.$disconnect();
  });

  it("creates exactly one User and one linked Account on the first sign-in", async () => {
    const result = await signInWithGoogle(GOOGLE_SUB, EMAIL);

    expect(result.isNewUser).toBe(true);
    await expect(countThisRun()).resolves.toEqual([1, 1]);

    const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL }, include: { accounts: true } });
    expect(user.id).toBe(result.user.id);
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]).toMatchObject({ provider: "google", type: "oidc", providerAccountId: GOOGLE_SUB });
  });

  it("persists no OAuth tokens on the Account row", async () => {
    await signInWithGoogle(GOOGLE_SUB, EMAIL);

    const account = await db.account.findUniqueOrThrow({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: GOOGLE_SUB } },
    });
    expect({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      id_token: account.id_token,
      expires_at: account.expires_at,
      scope: account.scope,
      token_type: account.token_type,
      session_state: account.session_state,
    }).toEqual({
      access_token: null,
      refresh_token: null,
      id_token: null,
      expires_at: null,
      scope: null,
      token_type: null,
      session_state: null,
    });
  });

  it("returns the same User.id for repeated sign-ins with the same Google account", async () => {
    const first = await signInWithGoogle(GOOGLE_SUB, EMAIL);
    const second = await signInWithGoogle(GOOGLE_SUB, EMAIL);
    const third = await signInWithGoogle(GOOGLE_SUB, EMAIL);

    expect(second.user.id).toBe(first.user.id);
    expect(third.user.id).toBe(first.user.id);
    expect(second.isNewUser).toBe(false);
    expect(third.isNewUser).toBe(false);
    await expect(countThisRun()).resolves.toEqual([1, 1]);
  });

  it("exposes the persistent database User.id through the JWT and session callbacks", async () => {
    const first = await signInWithGoogle(GOOGLE_SUB, EMAIL);
    const second = await signInWithGoogle(GOOGLE_SUB, EMAIL);
    const stored = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(sessionUserIdAfterSignIn(first.user.id)).toBe(stored.id);
    expect(sessionUserIdAfterSignIn(second.user.id)).toBe(stored.id);
  });

  it("still finds the user by Google account ID after the Google profile email changes", async () => {
    const first = await signInWithGoogle(GOOGLE_SUB, EMAIL);
    const later = await signInWithGoogle(GOOGLE_SUB, CHANGED_EMAIL);

    expect(later.user.id).toBe(first.user.id);
    await expect(countThisRun()).resolves.toEqual([1, 1]);
    // Auth.js doesn't update the stored email on OAuth sign-in; lookup is by account.
    await expect(db.user.findUnique({ where: { id: first.user.id } })).resolves.toMatchObject({ email: EMAIL });
  });

  it("gives a different Google account a different User.id", async () => {
    const first = await signInWithGoogle(GOOGLE_SUB, EMAIL);
    const other = await signInWithGoogle(OTHER_GOOGLE_SUB, OTHER_EMAIL);

    expect(other.isNewUser).toBe(true);
    expect(other.user.id).not.toBe(first.user.id);
    await expect(countThisRun()).resolves.toEqual([2, 2]);
  });

  it("refuses to link a different Google account that only shares an existing user's email", async () => {
    const first = await signInWithGoogle(GOOGLE_SUB, EMAIL);

    await expect(signInWithGoogle(OTHER_GOOGLE_SUB, EMAIL)).rejects.toMatchObject({
      type: "OAuthAccountNotLinked",
    });

    await expect(countThisRun()).resolves.toEqual([1, 1]);
    await expect(
      db.account.findUnique({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: OTHER_GOOGLE_SUB } },
      }),
    ).resolves.toBeNull();
    const user = await db.user.findUniqueOrThrow({ where: { id: first.user.id }, include: { accounts: true } });
    expect(user.accounts.map((account) => account.providerAccountId)).toEqual([GOOGLE_SUB]);
  });
});
