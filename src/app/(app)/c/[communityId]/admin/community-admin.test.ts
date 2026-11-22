import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityAdminContent } from "@/app/(app)/c/[communityId]/admin/community-admin-content";
import type { CommunityAccessResult } from "@/server/auth/guards";

// connection() only works inside a real Next.js request; it is a no-op here.
const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn(async () => {}) }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: connectionMock,
}));

const { getCommunityAccessMock, getAdministeredMock, notFoundMock } = vi.hoisted(() => ({
  getCommunityAccessMock: vi.fn<
    (input: { params: unknown; level: "member" | "admin"; callbackPath: string }) => Promise<{
      user: { id: string; name: string | null; image: string | null };
      access: CommunityAccessResult;
    }>
  >(),
  getAdministeredMock: vi.fn<(user: { id: string }, communityId: string) => Promise<{ id: string; name: string } | null>>(),
  notFoundMock: vi.fn((): never => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

vi.mock("@/server/auth/community-access", () => ({ getCommunityAccess: getCommunityAccessMock }));
vi.mock("@/server/dal/memberships", () => ({ getAdministeredCommunity: getAdministeredMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

const COMMUNITY_ID = "clx0community0001";
const SESSION_USER = { id: "session-user-id", name: "Admin", image: null };

beforeEach(() => {
  connectionMock.mockClear();
  getCommunityAccessMock.mockReset();
  getAdministeredMock.mockReset();
  notFoundMock.mockClear();
  getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: { decision: "allow", communityId: COMMUNITY_ID } });
  getAdministeredMock.mockResolvedValue({ id: COMMUNITY_ID, name: "Alpha Hall" });
});

function renderFor(params: unknown) {
  return CommunityAdminContent({ params: Promise.resolve(params) }).then(renderToStaticMarkup);
}

describe("CommunityAdminContent", () => {
  it("waits for the request (connection) before checking access", async () => {
    const order: string[] = [];
    connectionMock.mockImplementationOnce(async () => {
      order.push("connection");
    });
    getCommunityAccessMock.mockImplementationOnce(async () => {
      order.push("getCommunityAccess");
      return { user: SESSION_USER, access: { decision: "allow", communityId: COMMUNITY_ID } };
    });

    await renderFor({ communityId: COMMUNITY_ID });

    expect(order).toEqual(["connection", "getCommunityAccess"]);
  });

  it("checks admin-level access, returning to the admin page after sign-in", async () => {
    await renderFor({ communityId: COMMUNITY_ID });

    expect(getCommunityAccessMock).toHaveBeenCalledWith({
      params: { communityId: COMMUNITY_ID },
      level: "admin",
      callbackPath: `/c/${COMMUNITY_ID}/admin`,
    });
  });

  it("uses /communities as the return path for an invalid community ID", async () => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: { decision: "not_found" } });

    await expect(renderFor({ communityId: "bad id" })).rejects.toThrow("404");
    expect(getCommunityAccessMock).toHaveBeenCalledWith(expect.objectContaining({ callbackPath: "/communities" }));
  });

  it("redirects signed-out visitors before reading anything", async () => {
    getCommunityAccessMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(renderFor({ communityId: COMMUNITY_ID })).rejects.toThrow("NEXT_REDIRECT");
    expect(getAdministeredMock).not.toHaveBeenCalled();
  });

  it("renders not-found for non-members without reading the community", async () => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: { decision: "not_found" } });

    await expect(renderFor({ communityId: COMMUNITY_ID })).rejects.toThrow("404");
    expect(getAdministeredMock).not.toHaveBeenCalled();
  });

  it("shows a fixed access-denied notice to members, with no community data", async () => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: { decision: "forbidden" } });

    const html = await renderFor({ communityId: COMMUNITY_ID });

    expect(html).toContain("Only community admins can open this page.");
    expect(html).not.toContain("Alpha Hall");
    expect(html).not.toContain(COMMUNITY_ID);
    expect(getAdministeredMock).not.toHaveBeenCalled();
  });

  it("shows the admin page for the session user and validated community ID", async () => {
    const html = await renderFor({ communityId: COMMUNITY_ID, userId: "attacker-chosen-id" });

    expect(getAdministeredMock).toHaveBeenCalledWith({ id: SESSION_USER.id }, COMMUNITY_ID);
    expect(html).toMatch(/<h1[^>]*>Alpha Hall<\/h1>/);
    expect(html).toContain("Community admin");
  });

  it("renders not-found if the admin role disappears between the check and the read", async () => {
    getAdministeredMock.mockResolvedValue(null);

    await expect(renderFor({ communityId: COMMUNITY_ID })).rejects.toThrow("404");
  });

  it("renders the community name as text, not HTML", async () => {
    getAdministeredMock.mockResolvedValue({ id: COMMUNITY_ID, name: "<script>alert(1)</script>" });

    const html = await renderFor({ communityId: COMMUNITY_ID });

    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
