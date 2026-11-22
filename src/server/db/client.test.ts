import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const { createPrismaClientMock } = vi.hoisted(() => ({
  createPrismaClientMock: vi.fn<() => PrismaClient>(),
}));

vi.mock("@/lib/prisma", () => ({ createPrismaClient: createPrismaClientMock }));

// A stand-in object; these tests only check identity and call counts.
const fakeClient = { fake: "prisma-client" } as unknown as PrismaClient;

beforeEach(() => {
  globalThis.borrowLoopPrisma = undefined;
  createPrismaClientMock.mockReset();
});

afterEach(() => {
  globalThis.borrowLoopPrisma = undefined;
  vi.unstubAllEnvs();
});

describe("getDb", () => {
  it("does not create a client when the module is imported", async () => {
    await import("@/server/db/client");

    expect(createPrismaClientMock).not.toHaveBeenCalled();
  });

  it("creates the client on first use and reuses it afterwards", async () => {
    createPrismaClientMock.mockReturnValue(fakeClient);
    const { getDb } = await import("@/server/db/client");

    expect(getDb()).toBe(fakeClient);
    expect(getDb()).toBe(fakeClient);
    expect(createPrismaClientMock).toHaveBeenCalledTimes(1);
  });

  it("fails on first use, not on import, when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const actual = await vi.importActual<typeof import("@/lib/prisma")>("@/lib/prisma");
    createPrismaClientMock.mockImplementation(() => actual.createPrismaClient());

    const { getDb } = await import("@/server/db/client");

    expect(() => getDb()).toThrow("DATABASE_URL is not set");
    expect(globalThis.borrowLoopPrisma).toBeUndefined();
  });
});
