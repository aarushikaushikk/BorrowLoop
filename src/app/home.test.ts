import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

describe("Home page", () => {
  it("redirects to the protected /communities page instead of rendering public content", () => {
    expect(() => Home()).toThrow("NEXT_REDIRECT:/communities");
    expect(redirectMock).toHaveBeenCalledWith("/communities");
  });
});
