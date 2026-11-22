import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  createMembershipLookup,
  getAdministeredCommunity,
  joinCommunityAsMember,
  listCommunitiesForUser,
  listJoinableCommunities,
} from "@/server/dal/memberships";

vi.mock("server-only", () => ({}));

const { findUnique, findMany, findFirst, createMany, communityFindUnique, communityFindMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  createMany: vi.fn(),
  communityFindUnique: vi.fn(),
  communityFindMany: vi.fn(),
}));

// Stand-in for the delegates the module uses. The generated client type is
// far larger than this fake, hence the cast.
const fakeDb = {
  membership: { findUnique, findMany, findFirst, createMany },
  community: { findUnique: communityFindUnique, findMany: communityFindMany },
} as unknown as Pick<PrismaClient, "membership" | "community">;
const getClient = vi.fn(() => fakeDb);

beforeEach(() => {
  for (const mock of [findUnique, findMany, findFirst, createMany, communityFindUnique, communityFindMany]) {
    mock.mockReset();
  }
  getClient.mockClear();
});

describe("listJoinableCommunities", () => {
  it("lists communities without a membership for the session user, exposing only name and description", async () => {
    communityFindMany.mockResolvedValue([{ id: "c-1", name: "Alpha", description: null }]);

    await expect(listJoinableCommunities({ id: "user-1" }, getClient)).resolves.toEqual([
      { id: "c-1", name: "Alpha", description: null },
    ]);
    expect(communityFindMany).toHaveBeenCalledWith({
      where: { memberships: { none: { userId: "user-1" } } },
      select: { id: true, name: true, description: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });
});

describe("joinCommunityAsMember", () => {
  it("creates nothing when the community doesn't exist", async () => {
    communityFindUnique.mockResolvedValue(null);

    await expect(joinCommunityAsMember({ id: "user-1" }, "c-missing", getClient)).resolves.toBe("not_found");
    expect(communityFindUnique).toHaveBeenCalledWith({ where: { id: "c-missing" }, select: { id: true } });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("inserts a MEMBER row for the session user, skipping duplicates", async () => {
    communityFindUnique.mockResolvedValue({ id: "c-1" });
    createMany.mockResolvedValue({ count: 1 });

    await expect(joinCommunityAsMember({ id: "user-1" }, "c-1", getClient)).resolves.toBe("joined");
    expect(createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-1", communityId: "c-1", role: "MEMBER" }],
      skipDuplicates: true,
    });
  });

  it("reports an existing membership without modifying it", async () => {
    communityFindUnique.mockResolvedValue({ id: "c-1" });
    createMany.mockResolvedValue({ count: 0 });

    await expect(joinCommunityAsMember({ id: "user-1" }, "c-1", getClient)).resolves.toBe("already_member");
  });

  it("reports not_found if the community is deleted before the insert (foreign key violation)", async () => {
    communityFindUnique.mockResolvedValue({ id: "c-1" });
    createMany.mockRejectedValue(Object.assign(new Error("Foreign key constraint violated"), { code: "P2003" }));

    await expect(joinCommunityAsMember({ id: "user-1" }, "c-1", getClient)).resolves.toBe("not_found");
  });

  it("rethrows any other database error", async () => {
    communityFindUnique.mockResolvedValue({ id: "c-1" });
    createMany.mockRejectedValue(new Error("connection lost"));

    await expect(joinCommunityAsMember({ id: "user-1" }, "c-1", getClient)).rejects.toThrow("connection lost");
  });
});

describe("getAdministeredCommunity", () => {
  it("requires an ADMIN membership of the session user in that community", async () => {
    findFirst.mockResolvedValue(null);

    await getAdministeredCommunity({ id: "user-1" }, "community-1", getClient);

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", communityId: "community-1", role: "ADMIN" },
      select: { community: { select: { id: true, name: true } } },
    });
  });

  it("returns the community for an admin, or null otherwise", async () => {
    findFirst.mockResolvedValueOnce({ community: { id: "community-1", name: "Alpha" } }).mockResolvedValueOnce(null);

    await expect(getAdministeredCommunity({ id: "user-1" }, "community-1", getClient)).resolves.toEqual({
      id: "community-1",
      name: "Alpha",
    });
    await expect(getAdministeredCommunity({ id: "user-1" }, "community-1", getClient)).resolves.toBeNull();
  });
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
