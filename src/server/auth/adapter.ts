import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount, AdapterUser } from "next-auth/adapters";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * The adapter methods Auth.js calls for Google (OIDC) sign-in with JWT
 * sessions. Session, verification-token, and authenticator methods are left
 * out on purpose: if the session strategy were ever switched to "database",
 * Auth.js would refuse to start (`MissingAdapterMethods`) instead of silently
 * needing tables we don't have.
 */
export type AuthAdapterMethod =
  | "createUser"
  | "getUser"
  | "getUserByEmail"
  | "getUserByAccount"
  | "updateUser"
  | "linkAccount";

export type AuthAdapter = Required<Pick<Adapter, AuthAdapterMethod>>;

/**
 * Builds the Auth.js adapter on top of the official Prisma adapter.
 *
 * The Prisma client is requested only when Auth.js first calls an adapter
 * method (during sign-in), never when the config is built and never when a
 * JWT session is read. That keeps builds and signed-out pages free of any
 * database dependency.
 */
export function createAuthAdapter(getClient: () => PrismaClient): AuthAdapter {
  let prismaAdapter: Adapter | undefined;

  function method<K extends AuthAdapterMethod>(name: K): NonNullable<Adapter[K]> {
    prismaAdapter ??= PrismaAdapter(getClient());
    const fn = prismaAdapter[name];
    if (!fn) {
      throw new Error(`The Prisma adapter has no ${name} method.`);
    }
    return fn;
  }

  return {
    createUser: (user) => method("createUser")(user),
    getUser: (id) => method("getUser")(id),
    getUserByEmail: (email) => method("getUserByEmail")(email),
    getUserByAccount: (providerAccount) => method("getUserByAccount")(providerAccount),
    updateUser: (user) => method("updateUser")(user),
    linkAccount: (account) => method("linkAccount")(account),
  };
}

// Compile-time contract. `@auth/prisma-adapter` types its client parameter
// from `@prisma/client`, which has no `PrismaClient` export when the client is
// generated to a custom output (ours is `src/generated/prisma`), so that
// parameter is effectively untyped. These checks make `tsc` fail if the data
// Auth.js hands to the adapter stops fitting our generated Prisma inputs.
type Fits<A, B> = [A] extends [B] ? true : false;
type Assert<T extends true> = T;
export type AuthAdapterDataContract = [
  // createUser: the adapter drops `id` and passes the rest to user.create.
  Assert<Fits<Omit<AdapterUser, "id">, Prisma.UserCreateInput>>,
  // linkAccount: passed as-is to account.create.
  Assert<Fits<AdapterAccount, Prisma.AccountUncheckedCreateInput>>,
  // getUserByAccount / unlinkAccount: the compound unique key the adapter uses.
  Assert<
    Fits<
      { provider_providerAccountId: { provider: string; providerAccountId: string } },
      Prisma.AccountWhereUniqueInput
    >
  >,
];
