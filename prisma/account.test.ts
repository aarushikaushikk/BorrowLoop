import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaClient } from "../src/lib/prisma";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Fixed, obviously fake identifiers. Nothing here is a real Google account.
const PROVIDER = "google";
const GOOGLE_SUB = "account-test-google-sub-1";
const OTHER_GOOGLE_SUB = "account-test-google-sub-2";
const EMAIL = "account-test@example.com";
const OTHER_EMAIL = "account-test-other@example.com";

// Runs against a real Postgres (the separate, disposable test database), so it
// also checks that the add_auth_account migration and the Account constraints
// line up. Skipped when no test database is set. Never point this at Neon.
describe.skipIf(!testDatabaseUrl)("Account (test database)", () => {
  const db = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : null!;

  beforeEach(async () => {
    // Deleting the users also removes their accounts (onDelete: Cascade).
    await db.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });
    await db.$disconnect();
  });

  async function createUserWithGoogleAccount(email: string, providerAccountId: string) {
    return db.user.create({
      data: {
        email,
        name: "Account Test",
        accounts: { create: { type: "oidc", provider: PROVIDER, providerAccountId } },
      },
    });
  }

  function findUserByAccount(provider: string, providerAccountId: string) {
    return db.account
      .findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        include: { user: true },
      })
      .then((account) => account?.user ?? null);
  }

  it("resolves the same user ID on every lookup by provider and providerAccountId", async () => {
    const user = await createUserWithGoogleAccount(EMAIL, GOOGLE_SUB);

    const first = await findUserByAccount(PROVIDER, GOOGLE_SUB);
    const second = await findUserByAccount(PROVIDER, GOOGLE_SUB);

    expect(first?.id).toBe(user.id);
    expect(second?.id).toBe(user.id);
  });

  it("finds nothing for a different provider or a different Google account ID", async () => {
    await createUserWithGoogleAccount(EMAIL, GOOGLE_SUB);

    await expect(findUserByAccount("github", GOOGLE_SUB)).resolves.toBeNull();
    await expect(findUserByAccount(PROVIDER, OTHER_GOOGLE_SUB)).resolves.toBeNull();
  });

  it("rejects a second account with the same provider and providerAccountId", async () => {
    await createUserWithGoogleAccount(EMAIL, GOOGLE_SUB);
    const other = await db.user.create({ data: { email: OTHER_EMAIL } });

    await expect(
      db.account.create({
        data: { userId: other.id, type: "oidc", provider: PROVIDER, providerAccountId: GOOGLE_SUB },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const stillLinked = await findUserByAccount(PROVIDER, GOOGLE_SUB);
    expect(stillLinked?.email).toBe(EMAIL);
  });

  it("deletes a user's accounts when the user is deleted", async () => {
    const user = await createUserWithGoogleAccount(EMAIL, GOOGLE_SUB);

    await db.user.delete({ where: { id: user.id } });

    await expect(db.account.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(findUserByAccount(PROVIDER, GOOGLE_SUB)).resolves.toBeNull();
  });
});
