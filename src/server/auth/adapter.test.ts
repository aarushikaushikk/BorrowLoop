import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { createAuthAdapter } from "@/server/auth/adapter";
import { authConfig, exposeSessionUserId, keepServerIssuedToken } from "@/server/auth/config";
// Auth.js's real sign-in/link logic. It isn't in @auth/core's public exports,
// so it's imported by file path. next-auth pins @auth/core exactly, and the
// version guard below fails loudly if that ever changes.
import { handleLoginOrRegister } from "../../../node_modules/@auth/core/lib/actions/callback/handle-login.js";

vi.mock("server-only", () => ({}));

type InternalOptions = Parameters<typeof handleLoginOrRegister>[3];

// ---------------------------------------------------------------------------
// In-memory stand-in for the two Prisma delegates the official adapter uses
// for Google sign-in. It enforces the same unique keys as the schema (User.email
// and Account(provider, providerAccountId)). It is NOT PostgreSQL: real
// persistence is covered by prisma/account.test.ts against a test database.
// ---------------------------------------------------------------------------
type UserRow = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
};
type AccountInput = {
  userId: string;
  provider: string;
  providerAccountId: string;
  [field: string]: unknown;
};
type AccountRow = AccountInput & { id: string };

function uniqueViolation(): Error {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

function createInMemoryPrisma() {
  const users: UserRow[] = [];
  const accounts: AccountRow[] = [];
  let nextId = 1;

  const client = {
    user: {
      async create({ data }: { data: Omit<UserRow, "id"> & { id?: string } }) {
        if (users.some((user) => user.email === data.email)) throw uniqueViolation();
        const row: UserRow = {
          id: `db-user-${nextId++}`,
          name: data.name ?? null,
          email: data.email,
          emailVerified: data.emailVerified ?? null,
          image: data.image ?? null,
        };
        users.push(row);
        return row;
      },
      async findUnique({ where }: { where: { id?: string; email?: string } }) {
        return users.find((user) => user.id === where.id || user.email === where.email) ?? null;
      },
      async update({ where, data }: { where: { id: string }; data: Partial<UserRow> }) {
        const user = users.find((row) => row.id === where.id);
        if (!user) throw new Error("Record not found");
        Object.assign(user, data);
        return user;
      },
    },
    account: {
      async create({ data }: { data: AccountInput }) {
        const duplicate = accounts.some(
          (account) =>
            account.provider === data.provider && account.providerAccountId === data.providerAccountId,
        );
        if (duplicate) throw uniqueViolation();
        const row: AccountRow = { ...data, id: `db-account-${nextId++}` };
        accounts.push(row);
        return row;
      },
      async findUnique({
        where,
      }: {
        where: { provider_providerAccountId: { provider: string; providerAccountId: string } };
        include?: { user?: boolean };
      }) {
        const key = where.provider_providerAccountId;
        const account = accounts.find(
          (row) => row.provider === key.provider && row.providerAccountId === key.providerAccountId,
        );
        if (!account) return null;
        return { ...account, user: users.find((user) => user.id === account.userId) ?? null };
      },
    },
  };

  // The official adapter only touches `user` and `account` for this flow; the
  // stand-in can't implement the full generated client type, hence the cast.
  return { client: client as unknown as PrismaClient, users, accounts };
}

// ---------------------------------------------------------------------------
// Sign-in harness
// ---------------------------------------------------------------------------

/**
 * Auth.js's fallback when a provider sets no `account()` option (copied from
 * `defaultAccount` in @auth/core `lib/utils/providers.js`): keep these token
 * fields.
 */
function authJsDefaultAccount(tokens: Record<string, unknown>) {
  const kept = ["access_token", "id_token", "refresh_token", "expires_at", "scope", "token_type", "session_state"];
  return Object.fromEntries(Object.entries(tokens).filter(([key, value]) => kept.includes(key) && value !== undefined));
}

// Our Google provider as Auth.js sees it after merging `Google({ ...options })`
// and normalizing it (which supplies the default `account()` when none is set).
const [googleProvider] = authConfig.providers;
const { options: googleOptions, ...googleDefaults } = googleProvider;
const mergedGoogleProvider = {
  ...googleDefaults,
  ...googleOptions,
  account: googleOptions?.account ?? authJsDefaultAccount,
};

/**
 * What Auth.js passes after a successful Google callback: the normalized
 * profile (`id` is Google's `sub`) and the account with the token response.
 */
function googleCallback(sub: string, email: string, name = "Test Member") {
  return {
    profile: { id: sub, name, email, image: null },
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

function signInWithGoogle(adapter: ReturnType<typeof createAuthAdapter>, sub: string, email: string, name?: string) {
  const { profile, account } = googleCallback(sub, email, name);
  // handleLoginOrRegister reads only these fields for a signed-out OIDC
  // sign-in with JWT sessions. Building the full internal options object would
  // add nothing, so the partial object is cast.
  const options = {
    adapter,
    events: {},
    provider: mergedGoogleProvider,
    session: { strategy: "jwt", generateSessionToken: () => "unused" },
  } as unknown as InternalOptions;
  // An empty session token means "nobody is signed in yet".
  return handleLoginOrRegister("", profile, account, options);
}

/** The JWT -> session steps Auth.js runs after sign-in (`sub` is `user.id`). */
function sessionUserIdAfterSignIn(userId: string | undefined) {
  const token = keepServerIssuedToken({ token: { sub: userId }, trigger: "signIn" });
  return exposeSessionUserId({
    session: { user: { name: "Test Member" }, expires: "2026-12-31T00:00:00.000Z" },
    token,
  }).user?.id;
}

const GOOGLE_SUB = "google-sub-111";
const OTHER_GOOGLE_SUB = "google-sub-222";
const EMAIL = "member@example.com";
const OTHER_EMAIL = "someone-else@example.com";

describe("Auth.js core version used by these tests", () => {
  it("is the exact @auth/core version next-auth pins", () => {
    const pkg = z
      .object({ version: z.string() })
      .parse(JSON.parse(readFileSync("node_modules/@auth/core/package.json", "utf8")));

    expect(pkg.version).toBe("0.41.3");
  });
});

describe("createAuthAdapter (lazy client)", () => {
  it("does not request a Prisma client when the adapter is created", () => {
    const getClient = vi.fn<() => PrismaClient>();

    createAuthAdapter(getClient);

    expect(getClient).not.toHaveBeenCalled();
  });

  it("requests the client on the first adapter call and reuses it", async () => {
    const { client } = createInMemoryPrisma();
    const getClient = vi.fn(() => client);
    const adapter = createAuthAdapter(getClient);

    await adapter.getUser("missing");
    await adapter.getUserByEmail("missing@example.com");

    expect(getClient).toHaveBeenCalledTimes(1);
  });

  it("surfaces a missing database only when an adapter method runs", async () => {
    const adapter = createAuthAdapter(() => {
      throw new Error("DATABASE_URL is not set.");
    });

    await expect(async () => adapter.getUser("any")).rejects.toThrow("DATABASE_URL is not set.");
  });

  it("passes updateUser through to the Prisma adapter", async () => {
    const { client, users } = createInMemoryPrisma();
    const adapter = createAuthAdapter(() => client);
    const user = await adapter.createUser({ id: "ignored", email: EMAIL, emailVerified: null, name: "Old" });

    await adapter.updateUser({ id: user.id, name: "New" });

    expect(users[0]).toMatchObject({ id: user.id, name: "New", email: EMAIL });
  });

  it("exposes only the methods Google sign-in with JWT sessions needs", () => {
    const adapter = createAuthAdapter(() => createInMemoryPrisma().client);

    expect(Object.keys(adapter).sort()).toEqual([
      "createUser",
      "getUser",
      "getUserByAccount",
      "getUserByEmail",
      "linkAccount",
      "updateUser",
    ]);
  });
});

describe("persistent Google identity (Auth.js core + official Prisma adapter, in memory)", () => {
  let db: ReturnType<typeof createInMemoryPrisma>;
  let adapter: ReturnType<typeof createAuthAdapter>;

  beforeEach(() => {
    db = createInMemoryPrisma();
    adapter = createAuthAdapter(() => db.client);
  });

  it("creates one user and one linked account on the first sign-in", async () => {
    const result = await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);

    expect(result.isNewUser).toBe(true);
    expect(db.users).toHaveLength(1);
    expect(db.accounts).toHaveLength(1);
    expect(db.accounts[0]).toMatchObject({
      provider: "google",
      type: "oidc",
      providerAccountId: GOOGLE_SUB,
      userId: result.user.id,
    });
  });

  it("stores no OAuth tokens on the linked account", async () => {
    await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);

    expect(Object.keys(db.accounts[0] ?? {}).sort()).toEqual([
      "id",
      "provider",
      "providerAccountId",
      "type",
      "userId",
    ]);
  });

  it("resolves repeated sign-ins with the same Google account to the same user ID", async () => {
    const first = await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);
    const second = await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);
    const third = await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);

    expect(second.user.id).toBe(first.user.id);
    expect(third.user.id).toBe(first.user.id);
    expect(second.isNewUser).toBe(false);
    expect(db.users).toHaveLength(1);
    expect(db.accounts).toHaveLength(1);
  });

  it("gives the JWT session the same database user ID on every sign-in", async () => {
    const first = await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);
    const second = await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);

    expect(sessionUserIdAfterSignIn(first.user.id)).toBe(db.users[0]?.id);
    expect(sessionUserIdAfterSignIn(second.user.id)).toBe(db.users[0]?.id);
  });

  it("finds the user by Google account ID even if their Google email changed", async () => {
    const first = await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);
    const later = await signInWithGoogle(adapter, GOOGLE_SUB, "renamed@example.com");

    expect(later.user.id).toBe(first.user.id);
    expect(db.users).toHaveLength(1);
  });

  it("creates a separate user for a different Google account", async () => {
    const first = await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);
    const other = await signInWithGoogle(adapter, OTHER_GOOGLE_SUB, OTHER_EMAIL);

    expect(other.user.id).not.toBe(first.user.id);
    expect(db.users).toHaveLength(2);
    expect(db.accounts).toHaveLength(2);
  });

  it("refuses to link a different Google account that only shares an existing user's email", async () => {
    await signInWithGoogle(adapter, GOOGLE_SUB, EMAIL);

    await expect(signInWithGoogle(adapter, OTHER_GOOGLE_SUB, EMAIL)).rejects.toMatchObject({
      type: "OAuthAccountNotLinked",
    });
    expect(db.users).toHaveLength(1);
    expect(db.accounts).toHaveLength(1);
    expect(db.accounts[0]?.providerAccountId).toBe(GOOGLE_SUB);
  });
});
