import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createAuthAdapter } from "@/server/auth/adapter";

vi.mock("server-only", () => ({}));

// Simulates a future @auth/prisma-adapter release that drops a method we rely
// on. The real 2.11.3 adapter defines all of them.
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));

describe("createAuthAdapter with an incomplete Prisma adapter", () => {
  it("fails with a clear error instead of calling an undefined method", async () => {
    const adapter = createAuthAdapter(() => ({}) as PrismaClient);

    await expect(async () => adapter.getUserByAccount({ provider: "google", providerAccountId: "x" })).rejects.toThrow(
      "The Prisma adapter has no getUserByAccount method.",
    );
  });
});
