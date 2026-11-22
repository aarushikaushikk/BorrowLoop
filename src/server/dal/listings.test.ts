import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { getCommunityWithListings } from "@/server/dal/listings";

vi.mock("server-only", () => ({}));

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

// Stand-in for the one delegate the module uses; the generated client type is
// far larger than this fake, hence the cast.
const fakeDb = { community: { findFirst } } as unknown as Pick<PrismaClient, "community">;
const getClient = vi.fn(() => fakeDb);

beforeEach(() => {
  findFirst.mockReset();
  getClient.mockClear();
});

describe("getCommunityWithListings", () => {
  it("scopes the query to the community, the session user's membership, and published items", async () => {
    findFirst.mockResolvedValue(null);

    await getCommunityWithListings({ id: "user-1" }, "community-1", getClient);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "community-1", memberships: { some: { userId: "user-1" } } },
      select: {
        id: true,
        name: true,
        description: true,
        items: {
          where: { status: "PUBLISHED" },
          select: { id: true, title: true, description: true, category: true, condition: true },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        },
      },
    });
  });

  it("returns null when the community doesn't exist or the user isn't a member", async () => {
    findFirst.mockResolvedValue(null);

    await expect(getCommunityWithListings({ id: "user-1" }, "community-1", getClient)).resolves.toBeNull();
  });

  it("returns the community with its listings", async () => {
    findFirst.mockResolvedValue({
      id: "community-1",
      name: "Alpha",
      description: null,
      items: [{ id: "item-1", title: "Drill", description: "18V", category: "TOOLS", condition: "GOOD" }],
    });

    await expect(getCommunityWithListings({ id: "user-1" }, "community-1", getClient)).resolves.toEqual({
      id: "community-1",
      name: "Alpha",
      description: null,
      listings: [{ id: "item-1", title: "Drill", description: "18V", category: "TOOLS", condition: "GOOD" }],
    });
  });

  it("does not request a database client until called", () => {
    expect(getClient).not.toHaveBeenCalled();
  });
});
