import type { NextAuthConfig } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { nextAuthMock, createPrismaClientMock } = vi.hoisted(() => ({
  nextAuthMock: vi.fn((config: NextAuthConfig) => {
    void config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  }),
  createPrismaClientMock: vi.fn(),
}));

vi.mock("next-auth", () => ({ default: nextAuthMock }));
vi.mock("@/lib/prisma", () => ({ createPrismaClient: createPrismaClientMock }));

beforeEach(() => {
  vi.resetModules();
  nextAuthMock.mockClear();
  createPrismaClientMock.mockReset();
  globalThis.borrowLoopPrisma = undefined;
});

async function loadAuthConfig(): Promise<NextAuthConfig> {
  await import("@/auth");
  const config = nextAuthMock.mock.calls[0]?.[0];
  if (!config) {
    throw new Error("NextAuth was not called");
  }
  return config;
}

describe("src/auth.ts wiring", () => {
  it("adds the Prisma-backed adapter to the shared Auth.js config", async () => {
    const { authConfig } = await import("@/server/auth/config");

    const config = await loadAuthConfig();

    expect(config.adapter).toBeDefined();
    expect(config.providers).toBe(authConfig.providers);
    expect(config.callbacks).toBe(authConfig.callbacks);
    expect(config.pages).toBe(authConfig.pages);
  });

  it("keeps JWT sessions, so no Session table is needed", async () => {
    const config = await loadAuthConfig();

    expect(config.session?.strategy).toBe("jwt");
  });

  it("does not create a database client when the module is imported", async () => {
    await loadAuthConfig();

    expect(createPrismaClientMock).not.toHaveBeenCalled();
    expect(globalThis.borrowLoopPrisma).toBeUndefined();
  });
});
