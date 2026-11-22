import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOutAction } from "@/app/(app)/communities/actions";
import { CommunitiesContent } from "@/app/(app)/communities/communities-content";

const { requireUserMock, signOutMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn<
    (callbackPath?: unknown) => Promise<{ id: string; name: string | null; image: string | null }>
  >(),
  signOutMock: vi.fn<(options: { redirectTo: string }) => Promise<void>>(),
}));

vi.mock("@/server/auth/session", () => ({ requireUser: requireUserMock }));
vi.mock("@/auth", () => ({ signOut: signOutMock }));

beforeEach(() => {
  requireUserMock.mockReset();
  signOutMock.mockClear();
});

describe("CommunitiesContent", () => {
  it("requires a server-side session, returning to /communities after sign-in", async () => {
    requireUserMock.mockResolvedValue({ id: "user-1", name: "Ada Lovelace", image: null });

    await CommunitiesContent();

    expect(requireUserMock).toHaveBeenCalledWith("/communities");
  });

  it("renders nothing when the server-side guard rejects the session", async () => {
    requireUserMock.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in?callbackUrl=%2Fcommunities"));

    await expect(CommunitiesContent()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("shows the signed-in user's name, a sign-out button, and pending listings", async () => {
    requireUserMock.mockResolvedValue({ id: "user-1", name: "Ada Lovelace", image: null });

    const html = renderToStaticMarkup(await CommunitiesContent());

    expect(html).toContain("Ada Lovelace");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Sign out<\/button>/);
    expect(html).toMatch(/pending database integration/i);
    expect(html).not.toContain("user-1");
  });

  it("escapes the user's name instead of rendering it as HTML", async () => {
    requireUserMock.mockResolvedValue({
      id: "user-1",
      name: "<img src=x onerror=alert(1)>",
      image: null,
    });

    const html = renderToStaticMarkup(await CommunitiesContent());

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("uses a neutral label when the user has no name", async () => {
    requireUserMock.mockResolvedValue({ id: "user-1", name: null, image: null });

    const html = renderToStaticMarkup(await CommunitiesContent());

    expect(html).toContain("BorrowLoop member");
  });
});

describe("signOutAction", () => {
  it("signs out and returns to the sign-in page", async () => {
    await signOutAction();

    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/sign-in" });
  });
});
