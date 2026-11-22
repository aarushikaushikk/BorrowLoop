import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, requireUser } from "@/server/auth/session";

vi.mock("server-only", () => ({}));

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<unknown>>(),
  redirectMock: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const EXPIRES = "2026-12-31T00:00:00.000Z";

beforeEach(() => {
  authMock.mockReset();
  redirectMock.mockClear();
});

describe("getCurrentUser", () => {
  it.each([
    ["no session", null],
    ["a session without a user", { expires: EXPIRES }],
    ["a user without an ID", { user: { name: "Ada" }, expires: EXPIRES }],
    ["an empty user ID", { user: { id: "", name: "Ada" }, expires: EXPIRES }],
    ["a non-string user ID", { user: { id: 42, name: "Ada" }, expires: EXPIRES }],
    ["a non-object session", "not-a-session"],
  ])("returns null for %s", async (_label, session) => {
    authMock.mockResolvedValue(session);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns a narrow user for a valid session", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "server-user-id",
        name: "Ada Lovelace",
        email: "ada@example.com",
        image: "https://lh3.googleusercontent.com/a/photo",
      },
      expires: EXPIRES,
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "server-user-id",
      name: "Ada Lovelace",
      image: "https://lh3.googleusercontent.com/a/photo",
    });
  });

  it("normalizes a missing name and image to null", async () => {
    authMock.mockResolvedValue({ user: { id: "server-user-id" }, expires: EXPIRES });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "server-user-id",
      name: null,
      image: null,
    });
  });
});

describe("requireUser", () => {
  it("returns the user when the session is valid", async () => {
    authMock.mockResolvedValue({ user: { id: "server-user-id" }, expires: EXPIRES });

    await expect(requireUser("/communities")).resolves.toEqual({
      id: "server-user-id",
      name: null,
      image: null,
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /sign-in with an encoded callbackUrl when unauthenticated", async () => {
    authMock.mockResolvedValue(null);

    await expect(requireUser("/c/clx0community0001?tab=items")).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(redirectMock).toHaveBeenCalledWith(
      "/sign-in?callbackUrl=%2Fc%2Fclx0community0001%3Ftab%3Ditems",
    );
  });

  it.each([
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["no callback path", undefined],
  ])("falls back to the default callbackUrl for %s", async (_label, callbackPath) => {
    authMock.mockResolvedValue(null);

    await expect(requireUser(callbackPath)).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/sign-in?callbackUrl=%2Fcommunities");
  });
});
