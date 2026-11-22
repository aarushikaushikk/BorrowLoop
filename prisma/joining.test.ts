import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityListingsContent } from "@/app/(app)/c/[communityId]/community-listings-content";
import { joinCommunityAction, type JoinCommunityState } from "@/app/(app)/communities/actions";
import { listCommunitiesForUser, listJoinableCommunities } from "@/server/dal/memberships";
import { PrismaClient } from "@/generated/prisma/client";
import { proxy } from "@/proxy";

// connection() only works inside a real Next.js request; it is a no-op here.
const { connectionMock, refreshMock } = vi.hoisted(() => ({
  connectionMock: vi.fn(async () => {}),
  refreshMock: vi.fn(),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: connectionMock,
}));
// refresh() only works inside a real Server Action request.
vi.mock("next/cache", () => ({ refresh: refreshMock }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("server-only", () => ({}));

// The verified session is simulated; everything after it is real: the Server
// Action, Zod validation, the Prisma queries, the proxy gate, and the
// listings page, against the migrated tables.
const { sessionUser, notFoundMock } = vi.hoisted(() => ({
  sessionUser: { current: null as { id: string; name: string | null; image: string | null } | null },
  notFoundMock: vi.fn((): never => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));
vi.mock("@/server/auth/session", () => ({
  getCurrentUser: async () => sessionUser.current,
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

const RUN = `join-${randomUUID().slice(0, 8)}`;
const IDLE: JoinCommunityState = { status: "idle" };
const NONEXISTENT_COMMUNITY_ID = "clx0nonexistent0000000000";

describe.skipIf(!testDatabaseUrl)("open community joining (test database)", () => {
  // A small pool: the local PGlite test server multiplexes a single engine
  // and drops extra simultaneous sockets (P1017 ConnectionClosed), which the
  // concurrent-join test would otherwise trigger.
  const db = testDatabaseUrl
    ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 2 }) })
    : null!;

  // dave: no memberships   bob: ADMIN of Alpha   alice: MEMBER of Beta
  // Alpha: 1 published + 1 draft   Beta: 1 published   Gamma: no items
  type Ref = { id: string };
  let dave: Ref, bob: Ref, alice: Ref;
  let alpha: Ref, beta: Ref, gamma: Ref;

  function signInAs(user: Ref | null) {
    sessionUser.current = user ? { id: user.id, name: "Test", image: null } : null;
  }

  function join(fields: Record<string, string>) {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.append(name, value);
    return joinCommunityAction(IDLE, data);
  }

  function membershipsOf(user: Ref) {
    return db.membership.findMany({
      where: { userId: user.id },
      select: { communityId: true, role: true },
      orderBy: { communityId: "asc" },
    });
  }

  async function listingTitles(communityId: string) {
    const html = renderToStaticMarkup(await CommunityListingsContent({ params: Promise.resolve({ communityId }) }));
    return [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((match) => match[1] ?? "");
  }

  async function proxyStatus(path: string) {
    const response = await proxy(
      new NextRequest(`http://localhost:3000${path}`, { headers: { cookie: "authjs.session-token=mocked" } }),
    );
    return response.headers.get("x-middleware-next") === "1" ? "next" : response.status;
  }

  const runNames = (communities: { name: string }[]) =>
    communities.map((community) => community.name).filter((name) => name.startsWith(RUN));

  async function cleanUp() {
    await db.community.deleteMany({ where: { slug: { startsWith: RUN } } });
    await db.user.deleteMany({ where: { email: { startsWith: RUN } } });
  }

  beforeEach(async () => {
    globalThis.borrowLoopPrisma = db;
    refreshMock.mockClear();
    notFoundMock.mockClear();
    signInAs(null);
    await cleanUp();

    [dave, bob, alice] = await Promise.all(
      ["dave", "bob", "alice"].map((name) =>
        db.user.create({ data: { email: `${RUN}-${name}@example.test`, name }, select: { id: true } }),
      ),
    );
    [alpha, beta, gamma] = await Promise.all(
      [
        { name: "alpha", description: "First" },
        { name: "beta", description: null },
        { name: "gamma", description: "Empty" },
      ].map(({ name, description }) =>
        db.community.create({ data: { slug: `${RUN}-${name}`, name: `${RUN} ${name}`, description }, select: { id: true } }),
      ),
    );
    await db.membership.createMany({
      data: [
        { userId: bob.id, communityId: alpha.id, role: "ADMIN" },
        { userId: alice.id, communityId: beta.id, role: "MEMBER" },
      ],
    });
    const item = (communityId: string, ownerId: string, title: string, status: "PUBLISHED" | "DRAFT") => ({
      communityId,
      ownerId,
      title,
      status,
      description: `${title} description`,
      category: "TOOLS" as const,
      condition: "GOOD" as const,
    });
    await db.item.createMany({
      data: [
        item(alpha.id, bob.id, "Alpha drill", "PUBLISHED"),
        item(alpha.id, bob.id, "Alpha draft", "DRAFT"),
        item(beta.id, alice.id, "Beta ladder", "PUBLISHED"),
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

  describe("discovery", () => {
    it("lists every community the user hasn't joined, by name", async () => {
      await expect(listJoinableCommunities(dave).then(runNames)).resolves.toEqual([
        `${RUN} alpha`,
        `${RUN} beta`,
        `${RUN} gamma`,
      ]);
    });

    it("excludes communities the user already belongs to", async () => {
      await expect(listJoinableCommunities(bob).then(runNames)).resolves.toEqual([`${RUN} beta`, `${RUN} gamma`]);
      await expect(listJoinableCommunities(alice).then(runNames)).resolves.toEqual([`${RUN} alpha`, `${RUN} gamma`]);
    });

    it("exposes only id, name, and description", async () => {
      const [first] = (await listJoinableCommunities(dave)).filter((c) => c.name.startsWith(RUN));

      expect(Object.keys(first ?? {}).sort()).toEqual(["description", "id", "name"]);
    });
  });

  describe("joining", () => {
    it("adds the user as a MEMBER, moves the community to Your communities, and refreshes", async () => {
      signInAs(dave);

      await expect(join({ communityId: alpha.id })).resolves.toEqual({ status: "joined" });

      await expect(membershipsOf(dave)).resolves.toEqual([{ communityId: alpha.id, role: "MEMBER" }]);
      await expect(listCommunitiesForUser(dave).then(runNames)).resolves.toEqual([`${RUN} alpha`]);
      await expect(listJoinableCommunities(dave).then(runNames)).resolves.toEqual([`${RUN} beta`, `${RUN} gamma`]);
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it("gives immediate access to that community's published listings, and to no other community", async () => {
      signInAs(dave);
      await expect(proxyStatus(`/c/${alpha.id}`)).resolves.toBe(404);
      await expect(listingTitles(alpha.id)).rejects.toThrow("404");

      await join({ communityId: alpha.id });

      await expect(proxyStatus(`/c/${alpha.id}`)).resolves.toBe("next");
      await expect(listingTitles(alpha.id)).resolves.toEqual(["Alpha drill"]);
      await expect(proxyStatus(`/c/${beta.id}`)).resolves.toBe(404);
      await expect(listingTitles(beta.id)).rejects.toThrow("404");
      // Joining never grants admin access.
      await expect(proxyStatus(`/c/${alpha.id}/admin`)).resolves.toBe(403);
    });

    it("is idempotent: a repeat join succeeds without a second row", async () => {
      signInAs(dave);

      await expect(join({ communityId: gamma.id })).resolves.toEqual({ status: "joined" });
      await expect(join({ communityId: gamma.id })).resolves.toEqual({ status: "joined" });

      await expect(db.membership.count({ where: { userId: dave.id, communityId: gamma.id } })).resolves.toBe(1);
    });

    it("handles concurrent joins with exactly one row", async () => {
      // 10 Server Action calls in flight at once over the file's 2-connection
      // pool. PGlite executes statements one at a time, so this proves the
      // app-level behaviour (every caller succeeds, one row, ON CONFLICT DO
      // NOTHING for the rest), not a truly parallel PostgreSQL race.
      signInAs(dave);

      const results = await Promise.all(Array.from({ length: 10 }, () => join({ communityId: beta.id })));

      expect(results).toEqual(Array.from({ length: 10 }, () => ({ status: "joined" })));
      await expect(db.membership.count({ where: { userId: dave.id, communityId: beta.id } })).resolves.toBe(1);
    });

    it("leaves an existing ADMIN membership unchanged", async () => {
      signInAs(bob);

      await expect(join({ communityId: alpha.id })).resolves.toEqual({ status: "joined" });

      await expect(membershipsOf(bob)).resolves.toEqual([{ communityId: alpha.id, role: "ADMIN" }]);
    });

    it("ignores client-supplied userId and role", async () => {
      signInAs(dave);

      await join({ communityId: gamma.id, userId: alice.id, role: "ADMIN" });

      await expect(membershipsOf(dave)).resolves.toEqual([{ communityId: gamma.id, role: "MEMBER" }]);
      await expect(membershipsOf(alice)).resolves.toEqual([{ communityId: beta.id, role: "MEMBER" }]);
    });
  });

  describe("rejected joins", () => {
    const GENERIC_ERROR = { status: "error", message: "We couldn't join that community. Refresh the page and try again." };

    it.each([
      ["an invalid ID", "bad id"],
      ["a SQL-looking ID", "x' OR '1'='1"],
      ["a nonexistent community", NONEXISTENT_COMMUNITY_ID],
    ])("creates nothing for %s", async (_label, communityId) => {
      signInAs(dave);

      await expect(join({ communityId })).resolves.toEqual(GENERIC_ERROR);
      await expect(membershipsOf(dave)).resolves.toEqual([]);
      expect(refreshMock).not.toHaveBeenCalled();
    });

    it("redirects a signed-out caller and creates nothing", async () => {
      await expect(join({ communityId: alpha.id })).rejects.toThrow("NEXT_REDIRECT:/sign-in");

      await expect(db.membership.count({ where: { communityId: alpha.id } })).resolves.toBe(1);
    });
  });
});
