import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOutAction } from "@/app/(app)/communities/actions";
import { CommunitiesContent } from "@/app/(app)/communities/communities-content";
import type { UserCommunity } from "@/server/dal/memberships";

// connection() only works inside a real Next.js request; it is a no-op here.
const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn(async () => {}) }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: connectionMock,
}));

const { requireUserMock, listCommunitiesMock, signOutMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn<
    (callbackPath?: unknown) => Promise<{ id: string; name: string | null; image: string | null }>
  >(),
  listCommunitiesMock: vi.fn<(user: { id: string }) => Promise<UserCommunity[]>>(),
  signOutMock: vi.fn<(options: { redirectTo: string }) => Promise<void>>(),
}));

vi.mock("@/server/auth/session", () => ({ requireUser: requireUserMock }));
vi.mock("@/server/dal/memberships", () => ({ listCommunitiesForUser: listCommunitiesMock }));
vi.mock("@/auth", () => ({ signOut: signOutMock }));

const SESSION_USER = { id: "user-1", name: "Ada Lovelace", image: null };

const ALPHA: UserCommunity = {
  id: "c-alpha",
  name: "Alpha Hall",
  slug: "alpha-hall",
  description: "Dorm lending group",
  role: "MEMBER",
};
const BETA: UserCommunity = {
  id: "c-beta",
  name: "Beta Street",
  slug: "beta-street",
  description: null,
  role: "ADMIN",
};

beforeEach(() => {
  requireUserMock.mockReset();
  listCommunitiesMock.mockReset();
  signOutMock.mockClear();
  requireUserMock.mockResolvedValue(SESSION_USER);
  listCommunitiesMock.mockResolvedValue([]);
});

async function render(): Promise<string> {
  return renderToStaticMarkup(await CommunitiesContent());
}

/** The visible name of each community card, in order. */
function communityNames(html: string): string[] {
  return [...html.matchAll(/<h3[^>]*>(?:<a[^>]*>)?(.*?)(?:<\/a>)?<\/h3>/g)].map((match) => match[1] ?? "");
}

describe("CommunitiesContent session handling", () => {
  it("waits for the request (connection) before checking the session", async () => {
    const order: string[] = [];
    connectionMock.mockImplementationOnce(async () => {
      order.push("connection");
    });
    requireUserMock.mockImplementationOnce(async () => {
      order.push("requireUser");
      return SESSION_USER;
    });

    await CommunitiesContent();

    expect(order).toEqual(["connection", "requireUser"]);
  });

  it("requires a server-side session, returning to /communities after sign-in", async () => {
    await CommunitiesContent();

    expect(requireUserMock).toHaveBeenCalledWith("/communities");
  });

  it("redirects signed-out visitors before any database lookup", async () => {
    requireUserMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in?callbackUrl=%2Fcommunities"));

    await expect(CommunitiesContent()).rejects.toThrow("NEXT_REDIRECT");
    expect(listCommunitiesMock).not.toHaveBeenCalled();
  });

  it("lists communities for the session user's ID only", async () => {
    await CommunitiesContent();

    expect(listCommunitiesMock).toHaveBeenCalledTimes(1);
    expect(listCommunitiesMock).toHaveBeenCalledWith({ id: SESSION_USER.id });
  });

  it("shows the signed-in user's name and a sign-out button, without their ID", async () => {
    const html = await render();

    expect(html).toContain("Ada Lovelace");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Sign out<\/button>/);
    expect(html).not.toContain("user-1");
  });

  it("escapes the user's name instead of rendering it as HTML", async () => {
    requireUserMock.mockResolvedValue({ ...SESSION_USER, name: "<img src=x onerror=alert(1)>" });

    const html = await render();

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("uses a neutral label when the user has no name", async () => {
    requireUserMock.mockResolvedValue({ ...SESSION_USER, name: null });

    expect(await render()).toContain("BorrowLoop member");
  });
});

describe("CommunitiesContent community list", () => {
  it("shows an empty state when the user belongs to no communities", async () => {
    const html = await render();

    expect(html).toMatch(/<h2[^>]*id="communities-heading"[^>]*>Your communities<\/h2>/);
    expect(html).toContain("You&#x27;re not a member of any community yet.");
    expect(html).not.toContain("<ul");
    expect(html).not.toMatch(/pending database integration/i);
  });

  it("shows a single community with its name and description", async () => {
    listCommunitiesMock.mockResolvedValue([ALPHA]);

    const html = await render();

    expect(communityNames(html)).toEqual(["Alpha Hall"]);
    expect(html).toContain("Dorm lending group");
    expect(html).toMatch(/<ul[^>]*aria-labelledby="communities-heading"/);
    expect(html).not.toContain("not a member of any community");
  });

  it("shows several communities in the order returned (sorted by name in the query)", async () => {
    listCommunitiesMock.mockResolvedValue([ALPHA, BETA]);

    const html = await render();

    expect(communityNames(html)).toEqual(["Alpha Hall", "Beta Street"]);
    expect(html.match(/<li/g)).toHaveLength(2);
  });

  it("omits the description paragraph when a community has none", async () => {
    listCommunitiesMock.mockResolvedValue([BETA]);

    const html = await render();
    const [betaCard] = html.split("<li").slice(1);

    expect(betaCard).toContain(">Beta Street</a></h3>");
    expect(betaCard).not.toContain("<p");
  });

  it("marks only the communities where the user is an admin", async () => {
    listCommunitiesMock.mockResolvedValue([ALPHA, BETA]);

    const html = await render();
    const [alphaCard, betaCard] = html.split("<li").slice(1);

    expect(html.match(/>Admin</g)).toHaveLength(1);
    expect(alphaCard).not.toContain(">Admin<");
    expect(betaCard).toContain(">Admin<");
  });

  it("renders only the communities returned for the signed-in user", async () => {
    listCommunitiesMock.mockResolvedValue([BETA]);

    const html = await render();

    expect(communityNames(html)).toEqual(["Beta Street"]);
    expect(html).not.toContain("Alpha Hall");
  });

  it("links each community to its member-only page by community ID", async () => {
    listCommunitiesMock.mockResolvedValue([ALPHA, BETA]);

    const html = await render();
    const hrefs = [...html.matchAll(/<a[^>]*href="([^"]*)"/g)].map((match) => match[1]);

    expect(hrefs).toEqual(["/c/c-alpha", "/c/c-beta"]);
    expect(html).not.toContain("alpha-hall");
  });

  it("renders community names and descriptions as text, not HTML", async () => {
    listCommunitiesMock.mockResolvedValue([
      {
        ...ALPHA,
        name: '<script>alert("name")</script>',
        description: '<img src=x onerror="alert(1)">',
      },
    ]);

    const html = await render();

    // React appends its own form-replay <script> for the sign-out form, so
    // look for the injected markup specifically.
    expect(html).not.toContain('<script>alert("name")');
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;alert(&quot;name&quot;)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});

describe("signOutAction", () => {
  it("signs out and returns to the sign-in page", async () => {
    await signOutAction();

    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/sign-in" });
  });
});
