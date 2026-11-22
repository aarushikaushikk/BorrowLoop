import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityAdminContent } from "@/app/(app)/c/[communityId]/admin/community-admin-content";
import { proxy } from "@/proxy";
import { createPrismaClient } from "../src/lib/prisma";

// connection() only works inside a real Next.js request; it is a no-op here.
const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn(async () => {}) }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: connectionMock,
}));

vi.mock("server-only", () => ({}));

// The verified session is simulated (Auth.js JWT handling is covered elsewhere
// and by the production HTTP check). Everything after it is real: path
// classification, Zod validation, authorizeCommunity, and the Prisma
// membership lookup against the migrated tables.
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

const RUN = `cp10-${randomUUID().slice(0, 8)}`;
const NONEXISTENT_COMMUNITY_ID = "clx0nonexistent0000000000";
const SESSION_COOKIE = "authjs.session-token=verified-by-mocked-session";

describe.skipIf(!testDatabaseUrl)("community and admin authorization (test database)", () => {
  const db = testDatabaseUrl ? createPrismaClient(testDatabaseUrl) : null!;

  // alice: MEMBER of Alpha   bob: ADMIN of Alpha   carol: MEMBER of Beta   dave: none
  type Ref = { id: string };
  let alice: Ref, bob: Ref, carol: Ref, dave: Ref;
  let alpha: Ref, beta: Ref;

  function signInAs(user: Ref | null) {
    sessionUser.current = user ? { id: user.id, name: "Test", image: null } : null;
  }

  async function statusFor(path: string, withCookie = true) {
    const response = await proxy(
      new NextRequest(`http://localhost:3000${path}`, { headers: withCookie ? { cookie: SESSION_COOKIE } : {} }),
    );
    return response.headers.get("x-middleware-next") === "1" ? "next" : response.status;
  }

  async function cleanUp() {
    await db.community.deleteMany({ where: { slug: { startsWith: RUN } } });
    await db.user.deleteMany({ where: { email: { startsWith: RUN } } });
  }

  beforeEach(async () => {
    globalThis.borrowLoopPrisma = db;
    notFoundMock.mockClear();
    signInAs(null);
    await cleanUp();

    [alice, bob, carol, dave] = await Promise.all(
      ["alice", "bob", "carol", "dave"].map((name) =>
        db.user.create({ data: { email: `${RUN}-${name}@example.test`, name }, select: { id: true } }),
      ),
    );
    [alpha, beta] = await Promise.all(
      ["alpha", "beta"].map((name) =>
        db.community.create({ data: { slug: `${RUN}-${name}`, name: `${RUN} ${name}` }, select: { id: true } }),
      ),
    );
    await db.membership.createMany({
      data: [
        { userId: alice.id, communityId: alpha.id, role: "MEMBER" },
        { userId: bob.id, communityId: alpha.id, role: "ADMIN" },
        { userId: carol.id, communityId: beta.id, role: "MEMBER" },
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

  describe("proxy HTTP status", () => {
    it("redirects signed-out visitors (no cookie, or a cookie that doesn't verify)", async () => {
      await expect(statusFor(`/c/${alpha.id}/admin`, false)).resolves.toBe(307);
      signInAs(null);
      await expect(statusFor(`/c/${alpha.id}/admin`)).resolves.toBe(307);
    });

    it("gives a MEMBER 403 on the admin page and lets them into the community page", async () => {
      signInAs(alice);

      await expect(statusFor(`/c/${alpha.id}/admin`)).resolves.toBe(403);
      await expect(statusFor(`/c/${alpha.id}/admin/reports`)).resolves.toBe(403);
      await expect(statusFor(`/c/${alpha.id}`)).resolves.toBe("next");
    });

    it("lets an ADMIN into the admin page and the community page", async () => {
      signInAs(bob);

      await expect(statusFor(`/c/${alpha.id}/admin`)).resolves.toBe("next");
      await expect(statusFor(`/c/${alpha.id}`)).resolves.toBe("next");
    });

    it("gives non-members 404 on both pages, the same as a nonexistent community", async () => {
      signInAs(carol);
      await expect(statusFor(`/c/${alpha.id}`)).resolves.toBe(404);
      await expect(statusFor(`/c/${alpha.id}/admin`)).resolves.toBe(404);

      signInAs(dave);
      await expect(statusFor(`/c/${alpha.id}/admin`)).resolves.toBe(404);
      await expect(statusFor(`/c/${NONEXISTENT_COMMUNITY_ID}/admin`)).resolves.toBe(404);
    });

    it("doesn't let admin rights in one community reach another", async () => {
      signInAs(bob);

      await expect(statusFor(`/c/${beta.id}`)).resolves.toBe(404);
      await expect(statusFor(`/c/${beta.id}/admin`)).resolves.toBe(404);
    });

    it.each(["/c/bad%20id", "/c/bad%20id/admin", "/c/a.b/admin", "/c//admin"])(
      "answers the invalid community path %s with 404",
      async (path) => {
        signInAs(bob);

        await expect(statusFor(path)).resolves.toBe(404);
      },
    );

    it("ignores client-supplied userId and role in the query string", async () => {
      signInAs(dave);

      await expect(statusFor(`/c/${alpha.id}/admin?userId=${bob.id}&role=ADMIN`)).resolves.toBe(404);
    });

    it("applies membership changes on the very next request", async () => {
      signInAs(bob);
      await expect(statusFor(`/c/${alpha.id}/admin`)).resolves.toBe("next");

      await db.membership.update({
        where: { userId_communityId: { userId: bob.id, communityId: alpha.id } },
        data: { role: "MEMBER" },
      });
      await expect(statusFor(`/c/${alpha.id}/admin`)).resolves.toBe(403);

      await db.membership.delete({ where: { userId_communityId: { userId: bob.id, communityId: alpha.id } } });
      await expect(statusFor(`/c/${alpha.id}/admin`)).resolves.toBe(404);
      await expect(statusFor(`/c/${alpha.id}`)).resolves.toBe(404);
    });
  });

  describe("admin page content (defence in depth behind the proxy)", () => {
    async function renderAdmin(communityId: string) {
      return renderToStaticMarkup(await CommunityAdminContent({ params: Promise.resolve({ communityId }) }));
    }

    it("renders the admin page for the community's ADMIN", async () => {
      signInAs(bob);

      const html = await renderAdmin(alpha.id);

      expect(html).toContain("Community admin");
      expect(html).toContain(`${RUN} alpha`);
    });

    it("shows a MEMBER only the fixed access-denied notice", async () => {
      signInAs(alice);

      const html = await renderAdmin(alpha.id);

      expect(html).toContain("Only community admins can open this page.");
      expect(html).not.toContain(`${RUN} alpha`);
    });

    it("renders not-found for non-members", async () => {
      signInAs(carol);

      await expect(renderAdmin(alpha.id)).rejects.toThrow("404");
    });
  });
});
