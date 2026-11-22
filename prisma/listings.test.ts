import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityListingsContent } from "@/app/(app)/c/[communityId]/community-listings-content";
import { createPrismaClient } from "../src/lib/prisma";

// connection() only works inside a real Next.js request; it is a no-op here.
const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn(async () => {}) }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: connectionMock,
}));

vi.mock("server-only", () => ({}));

// The signed-in user is simulated (the session layer is covered elsewhere);
// everything after it is real: Zod validation, getCommunityAccess, the Prisma
// membership lookup, and the listings query against the migrated tables.
const { sessionUser, notFoundMock } = vi.hoisted(() => ({
  sessionUser: { current: null as { id: string; name: string | null; image: string | null } | null },
  notFoundMock: vi.fn((): never => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

vi.mock("@/server/auth/session", () => ({
  requireUser: async (callbackPath?: unknown) => {
    if (!sessionUser.current) {
      throw new Error(`NEXT_REDIRECT:/sign-in?callbackUrl=${encodeURIComponent(String(callbackPath))}`);
    }
    return sessionUser.current;
  },
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

// Runs only when TEST_DATABASE_URL is set. Never point it at Neon or any
// shared database.

const RUN = `cp9-${randomUUID().slice(0, 8)}`;
const NONEXISTENT_COMMUNITY_ID = "clx0nonexistent0000000000";

describe.skipIf(!testDatabaseUrl)("community listings page (test database)", () => {
  const db = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : null!;

  // Fixtures, recreated for every test:
  //   alice: MEMBER of Alpha and Gamma     bob: ADMIN of Alpha
  //   carol: MEMBER of Beta                dave: no memberships
  //   Alpha: 2 published + draft + pending review + archived
  //   Beta:  1 published                   Gamma: no items
  type Ref = { id: string };
  let alice: Ref, bob: Ref, carol: Ref, dave: Ref;
  let alpha: Ref, beta: Ref, gamma: Ref;

  function signInAs(user: Ref | null) {
    sessionUser.current = user ? { id: user.id, name: "Test", image: null } : null;
  }

  async function renderListings(params: unknown) {
    return renderToStaticMarkup(await CommunityListingsContent({ params: Promise.resolve(params) }));
  }

  function titles(html: string): string[] {
    return [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((match) => match[1] ?? "");
  }

  async function cleanUp() {
    // Deleting communities removes their memberships and items (onDelete: Cascade).
    await db.community.deleteMany({ where: { slug: { startsWith: RUN } } });
    await db.user.deleteMany({ where: { email: { startsWith: RUN } } });
  }

  beforeEach(async () => {
    // getCommunityAccess and the listings query use the module's shared client;
    // point it at the test database for this file.
    globalThis.borrowLoopPrisma = db;
    notFoundMock.mockClear();
    signInAs(null);
    await cleanUp();

    [alice, bob, carol, dave] = await Promise.all(
      ["alice", "bob", "carol", "dave"].map((name) =>
        db.user.create({ data: { email: `${RUN}-${name}@example.test`, name }, select: { id: true } }),
      ),
    );
    [alpha, beta, gamma] = await Promise.all(
      ["alpha", "beta", "gamma"].map((name) =>
        db.community.create({ data: { slug: `${RUN}-${name}`, name: `${RUN} ${name}` }, select: { id: true } }),
      ),
    );
    await db.membership.createMany({
      data: [
        { userId: alice.id, communityId: alpha.id, role: "MEMBER" },
        { userId: alice.id, communityId: gamma.id, role: "MEMBER" },
        { userId: bob.id, communityId: alpha.id, role: "ADMIN" },
        { userId: carol.id, communityId: beta.id, role: "MEMBER" },
      ],
    });
    const base = new Date("2026-11-20T12:00:00Z").getTime();
    const item = (communityId: string, ownerId: string, title: string, status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED", minutes: number) => ({
      communityId,
      ownerId,
      title,
      status,
      description: `${title} description`,
      category: "TOOLS" as const,
      condition: "GOOD" as const,
      createdAt: new Date(base + minutes * 60_000),
    });
    await db.item.createMany({
      data: [
        item(alpha.id, alice.id, "Alpha older drill", "PUBLISHED", 1),
        item(alpha.id, bob.id, "Alpha newer tent", "PUBLISHED", 2),
        item(alpha.id, alice.id, "Alpha draft", "DRAFT", 3),
        item(alpha.id, alice.id, "Alpha pending review", "PENDING_REVIEW", 4),
        item(alpha.id, bob.id, "Alpha archived", "ARCHIVED", 5),
        item(beta.id, carol.id, "Beta ladder", "PUBLISHED", 6),
      ],
    });
  });

  // afterEach runs even when an assertion fails, so no test leaves rows behind.
  afterEach(cleanUp);
  afterAll(async () => {
    await cleanUp();
    globalThis.borrowLoopPrisma = undefined;
    await db.$disconnect();
  });

  it("redirects a signed-out visitor to sign-in", async () => {
    await expect(renderListings({ communityId: alpha.id })).rejects.toThrow(
      `NEXT_REDIRECT:/sign-in?callbackUrl=${encodeURIComponent(`/c/${alpha.id}`)}`,
    );
  });

  it("shows a member only their community's published listings, newest first", async () => {
    signInAs(alice);

    const html = await renderListings({ communityId: alpha.id });

    expect(titles(html)).toEqual(["Alpha newer tent", "Alpha older drill"]);
    expect(html).toContain(`${RUN} alpha`);
    expect(html).not.toMatch(/Alpha draft|Alpha pending review|Alpha archived|Beta ladder/);
  });

  it("shows an admin the same listings in their community", async () => {
    signInAs(bob);

    const html = await renderListings({ communityId: alpha.id });

    expect(titles(html)).toEqual(["Alpha newer tent", "Alpha older drill"]);
  });

  it("never mixes in another community's items", async () => {
    signInAs(carol);

    const html = await renderListings({ communityId: beta.id });

    expect(titles(html)).toEqual(["Beta ladder"]);
    expect(html).not.toContain("Alpha");
  });

  it("renders not-found for a community the user doesn't belong to", async () => {
    signInAs(carol);

    await expect(renderListings({ communityId: alpha.id })).rejects.toThrow("404");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't let membership in one community grant access to another", async () => {
    signInAs(bob); // admin of Alpha only

    await expect(renderListings({ communityId: beta.id })).rejects.toThrow("404");
    await expect(renderListings({ communityId: gamma.id })).rejects.toThrow("404");
  });

  it("renders not-found for users with no memberships and for nonexistent communities alike", async () => {
    signInAs(dave);
    await expect(renderListings({ communityId: alpha.id })).rejects.toThrow("404");

    signInAs(alice);
    await expect(renderListings({ communityId: NONEXISTENT_COMMUNITY_ID })).rejects.toThrow("404");
  });

  it.each([
    ["an ID with a space", { communityId: "bad id" }],
    ["a SQL-looking ID", { communityId: "x' OR '1'='1" }],
    ["an empty ID", { communityId: "" }],
    ["missing params", {}],
  ])("rejects %s as not-found", async (_label, params) => {
    signInAs(alice);

    await expect(renderListings(params)).rejects.toThrow("404");
  });

  it("ignores a client-supplied userId or role", async () => {
    signInAs(dave);

    await expect(renderListings({ communityId: alpha.id, userId: alice.id })).rejects.toThrow("404");
    await expect(renderListings({ communityId: alpha.id, role: "ADMIN" })).rejects.toThrow("404");
  });

  it("revokes access on the next request after the membership is deleted", async () => {
    signInAs(alice);
    expect(titles(await renderListings({ communityId: alpha.id }))).toHaveLength(2);

    await db.membership.delete({ where: { userId_communityId: { userId: alice.id, communityId: alpha.id } } });

    await expect(renderListings({ communityId: alpha.id })).rejects.toThrow("404");
  });

  it("shows the empty state for a community with no listings", async () => {
    signInAs(alice);

    const html = await renderListings({ communityId: gamma.id });

    expect(html).toContain("No listings in this community yet.");
    expect(titles(html)).toEqual([]);
  });
});
