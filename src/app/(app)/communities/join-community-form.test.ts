import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JoinCommunityForm } from "@/app/(app)/communities/join-community-form";

vi.mock("@/app/(app)/communities/actions", () => ({ joinCommunityAction: vi.fn() }));

describe("JoinCommunityForm", () => {
  it("renders one hidden communityId field and a labelled Join button", () => {
    const html = renderToStaticMarkup(
      createElement(JoinCommunityForm, { communityId: "clx0community0001", communityName: "Alpha Hall" }),
    );

    expect([...html.matchAll(/<input[^>]*>/g)]).toHaveLength(1);
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="communityId"[^>]*value="clx0community0001"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*aria-label="Join Alpha Hall"[^>]*>Join community<\/button>/);
    expect(html).not.toContain('role="alert"');
  });

  it("escapes the community name in the button label", () => {
    const html = renderToStaticMarkup(
      createElement(JoinCommunityForm, { communityId: "c-1", communityName: '"><script>alert(1)</script>' }),
    );

    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });
});
