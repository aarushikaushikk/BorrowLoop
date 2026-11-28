import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItemDetailContent } from "@/app/(app)/c/[communityId]/items/[itemId]/item-detail-content";
import type { CommunityAccessResult } from "@/server/auth/guards";
import type { ItemAvailabilityView } from "@/server/dal/availability";

// Static-markup tests of the server-rendered page content. They show what each
// viewer is sent; they don't exercise browser interaction (no E2E tooling).

// connection() only works inside a real Next.js request; it is a no-op here.
const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn(async () => {}) }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: connectionMock,
}));

const { getCommunityAccessMock, getItemAvailabilityMock, notFoundMock } = vi.hoisted(() => ({
  getCommunityAccessMock: vi.fn<
    (input: { params: unknown; level: "member" | "admin"; callbackPath: string }) => Promise<{
      user: { id: string; name: string | null; image: string | null };
      access: CommunityAccessResult;
    }>
  >(),
  getItemAvailabilityMock: vi.fn<
    (user: { id: string }, input: { communityId: string; itemId: string }, today: string) => Promise<ItemAvailabilityView | null>
  >(),
  notFoundMock: vi.fn((): never => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/community-access", () => ({ getCommunityAccess: getCommunityAccessMock }));
vi.mock("@/server/dal/availability", () => ({ getItemAvailability: getItemAvailabilityMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
// The lender controls import the Server Actions; they're never called while rendering.
vi.mock("@/app/(app)/c/[communityId]/items/[itemId]/actions", () => ({
  addBlockedRangeAction: vi.fn(),
  removeBlockedRangeAction: vi.fn(),
}));

const COMMUNITY_ID = "clx0community0001";
const ITEM_ID = "clx0item000000001";
const SESSION_USER = { id: "session-user-id", name: "Viewer", image: null };
const ALLOW = { decision: "allow", communityId: COMMUNITY_ID } as const;
const PARAMS = { communityId: COMMUNITY_ID, itemId: ITEM_ID };

const ITEM = {
  id: ITEM_ID,
  communityId: COMMUNITY_ID,
  title: "Cordless drill",
  description: "18V with two batteries",
  category: "TOOLS",
  condition: "GOOD",
} as const;

const MEMBER_VIEW: ItemAvailabilityView = {
  viewer: "member",
  item: ITEM,
  blocks: [
    { id: "block-a", startDate: "2026-12-01", endDate: "2026-12-05" },
    // Overlaps block-a and stays a separate entry.
    { id: "block-b", startDate: "2026-12-03", endDate: "2026-12-04" },
  ],
};

const OWNER_VIEW: ItemAvailabilityView = {
  viewer: "owner",
  item: ITEM,
  blocks: [
    { id: "block-a", startDate: "2026-12-01", endDate: "2026-12-05", note: "Away for a week" },
    { id: "block-b", startDate: "2026-12-03", endDate: "2026-12-04", note: null },
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-27T12:00:00.000Z"));
  connectionMock.mockClear();
  getCommunityAccessMock.mockReset();
  getItemAvailabilityMock.mockReset();
  notFoundMock.mockClear();
  getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access: ALLOW });
  getItemAvailabilityMock.mockResolvedValue(MEMBER_VIEW);
});

afterEach(() => {
  vi.useRealTimers();
});

function renderFor(params: unknown): Promise<string> {
  return ItemDetailContent({ params: Promise.resolve(params) }).then(renderToStaticMarkup);
}

/** Attributes of every `<tag …>` in the markup, in document order. */
function tags(html: string, tag: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))].map((match) =>
    Object.fromEntries([...match[1]!.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map((a) => [a[1]!, a[2] ?? ""])),
  );
}

/** Visible text: tags removed and HTML entities React emits decoded. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("ItemDetailContent: route params and access", () => {
  it("waits for the request (connection) before checking access", async () => {
    const order: string[] = [];
    connectionMock.mockImplementationOnce(async () => {
      order.push("connection");
    });
    getCommunityAccessMock.mockImplementationOnce(async () => {
      order.push("getCommunityAccess");
      return { user: SESSION_USER, access: ALLOW };
    });

    await renderFor(PARAMS);

    expect(order).toEqual(["connection", "getCommunityAccess"]);
  });

  it.each([
    ["an invalid item ID", { communityId: COMMUNITY_ID, itemId: "../admin" }],
    ["an invalid community ID", { communityId: "a/b", itemId: ITEM_ID }],
    ["a missing item ID", { communityId: COMMUNITY_ID }],
    ["an extra ownerId param", { ...PARAMS, ownerId: "attacker" }],
  ])("renders not-found for %s before checking access or reading data", async (_label, params) => {
    await expect(renderFor(params)).rejects.toThrow("404");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getCommunityAccessMock).not.toHaveBeenCalled();
    expect(getItemAvailabilityMock).not.toHaveBeenCalled();
  });

  it("checks member access with only the community ID, returning to this item after sign-in", async () => {
    await renderFor(PARAMS);

    expect(getCommunityAccessMock).toHaveBeenCalledWith({
      params: { communityId: COMMUNITY_ID },
      level: "member",
      callbackPath: `/c/${COMMUNITY_ID}/items/${ITEM_ID}`,
    });
  });

  it("redirects signed-out visitors before reading the item", async () => {
    getCommunityAccessMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in"));

    await expect(renderFor(PARAMS)).rejects.toThrow("NEXT_REDIRECT");
    expect(getItemAvailabilityMock).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", { decision: "not_found" }],
    ["forbidden", { decision: "forbidden" }],
  ] as const)("renders not-found without reading the item when access is %s", async (_label, access) => {
    getCommunityAccessMock.mockResolvedValue({ user: SESSION_USER, access });

    await expect(renderFor(PARAMS)).rejects.toThrow("404");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(getItemAvailabilityMock).not.toHaveBeenCalled();
  });

  it("reads the item for the session user, the authorized community, and today's UTC date", async () => {
    vi.setSystemTime(new Date("2026-11-27T23:59:59.000Z"));

    await renderFor(PARAMS);

    expect(getItemAvailabilityMock).toHaveBeenCalledWith(
      { id: SESSION_USER.id },
      { communityId: COMMUNITY_ID, itemId: ITEM_ID },
      "2026-11-27",
    );
  });

  it("renders not-found when the item is missing, unpublished, or not visible to the user", async () => {
    getItemAvailabilityMock.mockResolvedValue(null);

    await expect(renderFor(PARAMS)).rejects.toThrow("404");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});

describe("ItemDetailContent: borrower view", () => {
  it("shows the item's title, category, condition, and description", async () => {
    const html = await renderFor(PARAMS);

    expect(html).toMatch(/<h1[^>]*>Cordless drill<\/h1>/);
    expect(text(html)).toContain("Tools · Good");
    expect(text(html)).toContain("18V with two batteries");
  });

  it("lists blocked ranges under an Unavailable dates heading, keeping overlapping ranges separate", async () => {
    const html = await renderFor(PARAMS);

    expect(html).toMatch(/<h2[^>]*id="availability-heading"[^>]*>Unavailable dates<\/h2>/);
    expect(html).toMatch(/<ul[^>]*aria-labelledby="availability-heading"/);
    const items = [...html.matchAll(/<li\b[^>]*>(.*?)<\/li>/g)].map((m) => text(m[1]!).trim());
    expect(items).toEqual(["Dec 1 – Dec 5, 2026", "Dec 3 – Dec 4, 2026"]);
  });

  it("shows a truthful empty state when no dates are blocked", async () => {
    getItemAvailabilityMock.mockResolvedValue({ ...MEMBER_VIEW, blocks: [] });

    const html = await renderFor(PARAMS);

    expect(text(html)).toContain("No blocked dates");
    expect(html).not.toMatch(/<ul[^>]*aria-labelledby="availability-heading"/);
    // Approved-loan dates aren't included yet (US-5), so the page never claims open availability.
    expect(text(html)).not.toMatch(/available any day|always available/i);
  });

  it("shows the dates but no lender controls, notes, or owner details", async () => {
    const html = await renderFor(PARAMS);

    expect(text(html)).toContain("Dec 1 – Dec 5, 2026");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(text(html)).not.toMatch(/Remove|Block dates|Private note/);
    expect(html).not.toContain("ownerId");
    expect(html).not.toContain(SESSION_USER.id);
  });

  it("renders item text as text, not HTML", async () => {
    getItemAvailabilityMock.mockResolvedValue({
      ...MEMBER_VIEW,
      item: { ...ITEM, title: "<script>alert(1)</script>", description: "<b>bold</b>" },
    });

    const html = await renderFor(PARAMS);

    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<b>bold");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("ItemDetailContent: owner view", () => {
  beforeEach(() => {
    getItemAvailabilityMock.mockResolvedValue(OWNER_VIEW);
  });

  it("shows each blocked range with its private note", async () => {
    const html = await renderFor(PARAMS);

    const items = [...html.matchAll(/<li\b[^>]*>(.*?)<\/li>/g)].map((m) => text(m[1]!));
    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Dec 1 – Dec 5, 2026");
    expect(items[0]).toContain("Away for a week");
    expect(items[1]).toContain("Dec 3 – Dec 4, 2026");
  });

  it("renders the add form with the server's community and item IDs and today's date as the minimum", async () => {
    const html = await renderFor(PARAMS);

    expect(html).toMatch(/<h2[^>]*>Block dates<\/h2>/);
    const inputs = tags(html, "input");
    expect(inputs).toContainEqual(expect.objectContaining({ type: "hidden", name: "itemId", value: ITEM_ID }));
    expect(inputs.filter((input) => input.name === "startDate")).toEqual([
      expect.objectContaining({ type: "date", min: "2026-11-27", required: "" }),
    ]);
    expect(inputs.filter((input) => input.name === "endDate")).toEqual([
      expect.objectContaining({ type: "date", min: "2026-11-27", required: "" }),
    ]);
  });

  it("renders one remove form per block, each carrying only its block ID and the community ID", async () => {
    const html = await renderFor(PARAMS);

    const blockIds = tags(html, "input")
      .filter((input) => input.name === "availabilityId")
      .map((input) => input.value);
    expect(blockIds).toEqual(["block-a", "block-b"]);
    // One add form plus one remove form per block.
    expect(tags(html, "form")).toHaveLength(3);
  });

  it("never sends identity or role fields to the browser", async () => {
    const html = await renderFor(PARAMS);

    const names = tags(html, "input").map((input) => input.name);
    expect(names).toContain("communityId");
    for (const forbidden of ["ownerId", "userId", "role", "borrowerId", "lenderId"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("shows the empty state and still offers the add form when no dates are blocked", async () => {
    getItemAvailabilityMock.mockResolvedValue({ ...OWNER_VIEW, blocks: [] });

    const html = await renderFor(PARAMS);

    expect(text(html)).toContain("No blocked dates");
    expect(tags(html, "form")).toHaveLength(1);
  });

  it("renders the private note as text, not HTML", async () => {
    getItemAvailabilityMock.mockResolvedValue({
      ...OWNER_VIEW,
      blocks: [{ id: "block-a", startDate: "2026-12-01", endDate: "2026-12-05", note: "<img src=x onerror=alert(1)>" }],
    });

    const html = await renderFor(PARAMS);

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
