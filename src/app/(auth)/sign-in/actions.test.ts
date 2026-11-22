import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithGoogle } from "@/app/(auth)/sign-in/actions";

const { signInMock } = vi.hoisted(() => ({
  signInMock: vi.fn<(provider: string, options: { redirectTo: string }) => Promise<void>>(),
}));

vi.mock("@/auth", () => ({ signIn: signInMock }));

function formWith(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
  return formData;
}

beforeEach(() => {
  signInMock.mockClear();
});

describe("signInWithGoogle", () => {
  it("starts Google sign-in and preserves a safe internal destination", async () => {
    await signInWithGoogle(formWith({ callbackUrl: "/c/clx0community0001?tab=items" }));

    expect(signInMock).toHaveBeenCalledTimes(1);
    expect(signInMock).toHaveBeenCalledWith("google", {
      redirectTo: "/c/clx0community0001?tab=items",
    });
  });

  it.each([
    ["an external URL", { callbackUrl: "https://evil.example/phish" }],
    ["a protocol-relative URL", { callbackUrl: "//evil.example" }],
    ["a missing callbackUrl", {}],
  ])("falls back to /communities for %s", async (_label, fields) => {
    await signInWithGoogle(formWith(fields));

    expect(signInMock).toHaveBeenCalledWith("google", { redirectTo: "/communities" });
  });

  it("ignores a client-supplied provider and always uses Google", async () => {
    await signInWithGoogle(formWith({ provider: "github", callbackUrl: "/communities" }));

    expect(signInMock).toHaveBeenCalledWith("google", { redirectTo: "/communities" });
  });
});
