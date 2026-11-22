import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createMembershipLookup, listCommunitiesForUser } from "@/server/dal/memberships";

vi.mock("server-only", () => ({}));

const { findUnique, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

// Stand-in for the one delegate the module uses. The generated client type is
// far larger than this fake, hence the cast.
const fakeDb = { membership: { findUnique, findMany } } as unknown as Pick<PrismaClient, "membership">;
const getClient = vi.fn(() => fakeDb);

beforeEach(() => {
  findUnique.mockReset();
  findMany.mockReset();
  getClient.mockClear();
});

describe("createMembershipLookup", () => {
  it("does not request a database client until a lookup runs", () => {
    createMembershipLookup(getClient);

    expect(getClient).not.toHaveBeenCalled();
  });

  it("looks up exactly the given user and community by the compound key, selecting only the role", async () => {
    findUnique.mockResolvedValue({ role: "MEMBER" });

    await createMembershipLookup(getClient).getMembership("user-1", "community-1");

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_communityId: { userId: "user-1", communityId: "community-1" } },
      select: { role: true },
    });
  });

  it("treats an existing MEMBER row as an active member", async () => {
    findUnique.mockResolvedValue({ role: "MEMBER" });

    await expect(createMembershipLookup(getClient).getMembership("user-1", "community-1")).resolves.toEqual({
      role: "MEMBER",
      status: "ACTIVE",
    });
  });

  it("treats an existing ADMIN row as an active admin", async () => {
    findUnique.mockResolvedValue({ role: "ADMIN" });

    await expect(createMembershipLookup(getClient).getMembership("user-1", "community-1")).resolves.toEqual({
      role: "ADMIN",
      status: "ACTIVE",
    });
  });

  it("returns null when there is no membership row", async () => {
    findUnique.mockResolvedValue(null);

    await expect(createMembershipLookup(getClient).getMembership("user-1", "community-1")).resolves.toBeNull();
  });
});

describe("listCommunitiesForUser", () => {
  it("queries only the given user's memberships, sorted by community name", async () => {
    findMany.mockResolvedValue([]);

    await listCommunitiesForUser({ id: "user-1" }, getClient);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: {
        role: true,
        community: { select: { id: true, name: true, slug: true, description: true } },
      },
      orderBy: { community: { name: "asc" } },
    });
  });

  it("returns an empty list for a user with no communities", async () => {
    findMany.mockResolvedValue([]);

    await expect(listCommunitiesForUser({ id: "user-1" }, getClient)).resolves.toEqual([]);
  });

  it("flattens each membership into the community plus the user's role", async () => {
    findMany.mockResolvedValue([
      { role: "ADMIN", community: { id: "c-1", name: "Alpha", slug: "alpha", description: null } },
      { role: "MEMBER", community: { id: "c-2", name: "Beta", slug: "beta", description: "Second" } },
    ]);

    await expect(listCommunitiesForUser({ id: "user-1" }, getClient)).resolves.toEqual([
      { id: "c-1", name: "Alpha", slug: "alpha", description: null, role: "ADMIN" },
      { id: "c-2", name: "Beta", slug: "beta", description: "Second", role: "MEMBER" },
    ]);
  });
});
