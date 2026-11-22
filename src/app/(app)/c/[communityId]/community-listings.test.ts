import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityListingsContent } from "@/app/(app)/c/[communityId]/community-listings-content";
import type { CommunityAccessResult } from "@/server/auth/guards";
import type { CommunityWithListings } from "@/server/dal/listings";

const { getCommunityAccessMock, getListingsMock, notFoundMock } = vi.hoisted(() => ({
  getCommunityAccessMock: vi.fn<
    (input: { params: unknown; level: "member" | "admin"; callbackPath: string }) => Promise<{
      user: { id: string; name: string | null; image: string | null };
      access: CommunityAccessResult;
    }>
  >(),
  getListingsMock: vi.fn<(user: { id: string }, communityId: string) => Promise<CommunityWithListings | null>>(),
  notFoundMock: vi.fn((): never => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

vi.mock("@/server/auth/community-access", () => ({ getCommunityAccess: getCommunityAccessMock }));
vi.mock("@/server/dal/listings", () => ({ getCommunityWithListings: getListingsMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

const COMMUNITY_ID = "clx0community0001";
const SESSION_USER = { id: "session-user-id", name: "Member", image: null };
const ALLOW = { decision: "allow", communityId: COMMUNITY_ID } as const;

const COMMUNITY: CommunityWithListings = {
  id: COMMUNITY_ID,
  name: "Alpha Hall",
  description: "Dorm lending group",
  listings: [
    { id: "item-1", title: "Cordless drill", description: "18V with two batteries", category: "TOOLS", condition: "GOOD" },
    { id: "item-2", title: "Board game night box", description: "Six games", category: "GAMES", condition: "LIKE_NEW" },
  ],
};

beforeEach(() => {
  getCommunityAccessMock.mockReset();
  getListingsMock.mockReset();
  notFoundMock.mockClear();
  getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: ALLOW });
  getListingsMock.mockResolvedValue(COMMUNITY);
});

function renderFor(params: unknown) {
  return CommunityListingsContent({ params: Promise.resolve(params) }).then(renderToStaticMarkup);
}

describe("CommunityListingsContent authorization", () => {
  it("checks member-level access with the route params, returning here after sign-in", async () => {
    await renderFor({ communityId: COMMUNITY_ID });

    expect(getCommunityAccessMock).toHaveBeenCalledWith({
      params: { communityId: COMMUNITY_ID },
      level: "member",
      callbackPath: `/c/${COMMUNITY_ID}`,
    });
  });

  it("uses /communities as the sign-in return path when the route ID is invalid", async () => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: { decision: "not_found" } });

    await expect(renderFor({ communityId: "bad id" })).rejects.toThrow("404");
    expect(getCommunityAccessMock).toHaveBeenCalledWith(expect.objectContaining({ callbackPath: "/communities" }));
  });

  it("redirects signed-out visitors before reading any listings", async () => {
    getCommunityAccessMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in?callbackUrl=%2Fc%2Fclx0community0001"));

    await expect(renderFor({ communityId: COMMUNITY_ID })).rejects.toThrow("NEXT_REDIRECT");
    expect(getListingsMock).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", { decision: "not_found" }],
    ["forbidden", { decision: "forbidden" }],
  ] as const)("renders not-found without reading listings when access is %s", async (_label, access) => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access });

    await expect(renderFor({ communityId: COMMUNITY_ID })).rejects.toThrow("404");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getListingsMock).not.toHaveBeenCalled();
  });

  it("reads listings for the session user and the validated community ID only", async () => {
    getCommunityAccessMock.mockResolvedValue({
      user: SESSION_USER,
      access: { decision: "allow", communityId: COMMUNITY_ID },
    });

    await renderFor({ communityId: COMMUNITY_ID, userId: "attacker-chosen-id" });

    expect(getListingsMock).toHaveBeenCalledWith({ id: SESSION_USER.id }, COMMUNITY_ID);
  });

  it("renders not-found if the membership disappears between the check and the read", async () => {
    getListingsMock.mockResolvedValue(null);

    await expect(renderFor({ communityId: COMMUNITY_ID })).rejects.toThrow("404");
  });
});

describe("CommunityListingsContent rendering", () => {
  it("shows the community name, description, and its listings with labels", async () => {
    const html = await renderFor({ communityId: COMMUNITY_ID });

    expect(html).toMatch(/<h1[^>]*>Alpha Hall<\/h1>/);
    expect(html).toContain("Dorm lending group");
    expect([...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) => m[1])).toEqual([
      "Cordless drill",
      "Board game night box",
    ]);
    expect(html).toContain("Tools · Good");
    expect(html).toContain("Games · Like new");
    expect(html).toMatch(/<ul[^>]*aria-labelledby="listings-heading"/);
  });

  it("shows an empty state when the community has no visible listings", async () => {
    getListingsMock.mockResolvedValue({ ...COMMUNITY, description: null, listings: [] });

    const html = await renderFor({ communityId: COMMUNITY_ID });

    expect(html).toMatch(/<h2[^>]*id="listings-heading"[^>]*>Listings<\/h2>/);
    expect(html).toContain("No listings in this community yet.");
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("Dorm lending group");
  });

  it("renders community and listing text as text, not HTML", async () => {
    getListingsMock.mockResolvedValue({
      ...COMMUNITY,
      name: "<script>alert(1)</script>",
      listings: [{ ...COMMUNITY.listings[0]!, title: "<img src=x onerror=alert(2)>", description: "<b>bold</b>" }],
    });

    const html = await renderFor({ communityId: COMMUNITY_ID });

    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>bold");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(2)&gt;");
  });
});
