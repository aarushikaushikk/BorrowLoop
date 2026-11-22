import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeCommunity } from "@/server/auth/guards";
import type { MembershipLookup } from "@/server/auth/membership";
import { createMembershipLookup, listCommunitiesForUser } from "@/server/dal/memberships";
import type { AccessLevel } from "@/server/domain/access";
import { createPrismaClient } from "../src/lib/prisma";

vi.mock("server-only", () => ({}));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Real Prisma queries, the real authorizeCommunity guard, and the real
// membership lookup against the migrated tables in a disposable PostgreSQL
// test database. Nothing is mocked except `server-only`.
//
// Runs only when TEST_DATABASE_URL is set. Never point it at Neon or any
// shared database.

// Unique per run, so aborted or concurrent runs can't collide.
const RUN = `cp8-${randomUUID().slice(0, 8)}`;
// A well-formed ID that no community has.
const NONEXISTENT_COMMUNITY_ID = "clx0nonexistent0000000000";

describe.skipIf(!testDatabaseUrl)("community membership authorization (test database)", () => {
  const db = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : null!;
  const realLookup = createMembershipLookup(() => db);

  // Counts real lookups, to prove invalid input never reaches the database.
  const lookupCalls: Array<[string, string]> = [];
  const countingLookup: MembershipLookup = {
    getMembership(userId, communityId) {
      lookupCalls.push([userId, communityId]);
      return realLookup.getMembership(userId, communityId);
    },
  };

  // Fixtures, recreated for every test:
  //   alice: MEMBER of Alpha and Beta
  //   bob:   ADMIN of Alpha, not in Beta
  //   carol: no memberships
  let alice: { id: string };
  let bob: { id: string };
  let carol: { id: string };
  let alpha: { id: string };
  let beta: { id: string };

  async function cleanUp() {
    // Deleting the communities removes their memberships (onDelete: Cascade).
    await db.community.deleteMany({ where: { slug: { startsWith: RUN } } });
    await db.user.deleteMany({ where: { email: { startsWith: RUN } } });
  }

  beforeEach(async () => {
    await cleanUp();
    lookupCalls.length = 0;

    [alice, bob, carol] = await Promise.all(
      ["alice", "bob", "carol"].map((name) =>
        db.user.create({ data: { email: `${RUN}-${name}@example.test`, name }, select: { id: true } }),
      ),
    );
    [alpha, beta] = await Promise.all(
      [
        { slug: `${RUN}-alpha`, name: `${RUN} Alpha`, description: "First test community" },
        { slug: `${RUN}-beta`, name: `${RUN} Beta`, description: null },
      ].map((data) => db.community.create({ data, select: { id: true } })),
    );
    await db.membership.createMany({
      data: [
        { userId: alice.id, communityId: alpha.id, role: "MEMBER" },
        { userId: alice.id, communityId: beta.id, role: "MEMBER" },
        { userId: bob.id, communityId: alpha.id, role: "ADMIN" },
      ],
    });
  });

  // afterEach runs even when an assertion fails, so no test leaves rows behind.
  afterEach(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await db.$disconnect();
  });

  function decide(user: { id: string }, communityId: unknown, level: AccessLevel) {
    return authorizeCommunity({ user, params: { communityId }, level }, countingLookup).then((r) => r.decision);
  }

  describe("membership lookup", () => {
    it("returns the stored role as an active membership, or null when there is no row", async () => {
      await expect(realLookup.getMembership(alice.id, alpha.id)).resolves.toEqual({ role: "MEMBER", status: "ACTIVE" });
      await expect(realLookup.getMembership(bob.id, alpha.id)).resolves.toEqual({ role: "ADMIN", status: "ACTIVE" });
      await expect(realLookup.getMembership(bob.id, beta.id)).resolves.toBeNull();
      await expect(realLookup.getMembership(carol.id, alpha.id)).resolves.toBeNull();
      await expect(realLookup.getMembership(alice.id, NONEXISTENT_COMMUNITY_ID)).resolves.toBeNull();
    });
  });

  describe("member-level access", () => {
    it("allows members and admins of the community", async () => {
      await expect(decide(alice, alpha.id, "member")).resolves.toBe("allow");
      await expect(decide(alice, beta.id, "member")).resolves.toBe("allow");
      await expect(decide(bob, alpha.id, "member")).resolves.toBe("allow");
    });

    it("hides communities the user doesn't belong to as not_found", async () => {
      await expect(decide(carol, alpha.id, "member")).resolves.toBe("not_found");
      await expect(decide(carol, beta.id, "member")).resolves.toBe("not_found");
      // Bob administers Alpha, which grants nothing in Beta.
      await expect(decide(bob, beta.id, "member")).resolves.toBe("not_found");
    });

    it("answers a nonexistent community exactly like one the user can't access", async () => {
      await expect(decide(alice, NONEXISTENT_COMMUNITY_ID, "member")).resolves.toBe("not_found");
    });
  });

  describe("admin-level access", () => {
    it("allows only an admin of that community", async () => {
      await expect(decide(bob, alpha.id, "admin")).resolves.toBe("allow");
    });

    it("forbids a member who isn't an admin", async () => {
      await expect(decide(alice, alpha.id, "admin")).resolves.toBe("forbidden");
      await expect(decide(alice, beta.id, "admin")).resolves.toBe("forbidden");
    });

    it("returns not_found to non-members, including an admin of a different community", async () => {
      await expect(decide(carol, alpha.id, "admin")).resolves.toBe("not_found");
      await expect(decide(bob, beta.id, "admin")).resolves.toBe("not_found");
    });
  });

  describe("untrusted input", () => {
    it("rejects invalid IDs and extra fields before querying the database", async () => {
      const attempts: unknown[] = [
        { communityId: "bad id" },
        { communityId: "" },
        { communityId: alpha.id, userId: bob.id },
        { communityId: alpha.id, role: "ADMIN" },
        {},
        null,
      ];
      for (const params of attempts) {
        const result = await authorizeCommunity({ user: carol, params, level: "admin" }, countingLookup);
        expect(result).toEqual({ decision: "not_found" });
      }
      expect(lookupCalls).toEqual([]);
    });

    it("always looks up the authenticated user's ID, never another user's", async () => {
      await decide(alice, alpha.id, "admin");

      expect(lookupCalls).toEqual([[alice.id, alpha.id]]);
    });
  });

  describe("listCommunitiesForUser", () => {
    it("lists every community a user belongs to, with their role, sorted by name", async () => {
      await expect(listCommunitiesForUser(alice, () => db)).resolves.toEqual([
        { id: alpha.id, name: `${RUN} Alpha`, slug: `${RUN}-alpha`, description: "First test community", role: "MEMBER" },
        { id: beta.id, name: `${RUN} Beta`, slug: `${RUN}-beta`, description: null, role: "MEMBER" },
      ]);
      await expect(listCommunitiesForUser(bob, () => db)).resolves.toEqual([
        { id: alpha.id, name: `${RUN} Alpha`, slug: `${RUN}-alpha`, description: "First test community", role: "ADMIN" },
      ]);
    });

    it("returns an empty list for a user with no memberships", async () => {
      await expect(listCommunitiesForUser(carol, () => db)).resolves.toEqual([]);
    });
  });

  describe("membership changes take effect on the next check", () => {
    it("revokes access as soon as the membership row is deleted", async () => {
      await expect(decide(alice, alpha.id, "member")).resolves.toBe("allow");

      await db.membership.delete({ where: { userId_communityId: { userId: alice.id, communityId: alpha.id } } });

      await expect(decide(alice, alpha.id, "member")).resolves.toBe("not_found");
      await expect(decide(alice, beta.id, "member")).resolves.toBe("allow");
      const remaining = await listCommunitiesForUser(alice, () => db);
      expect(remaining.map((community) => community.id)).toEqual([beta.id]);
    });

    it("removes memberships when their community is deleted", async () => {
      await db.community.delete({ where: { id: beta.id } });

      await expect(db.membership.count({ where: { communityId: beta.id } })).resolves.toBe(0);
      await expect(decide(alice, beta.id, "member")).resolves.toBe("not_found");
      const remaining = await listCommunitiesForUser(alice, () => db);
      expect(remaining.map((community) => community.id)).toEqual([alpha.id]);
    });
  });
});
