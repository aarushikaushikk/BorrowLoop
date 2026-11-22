import { describe, expect, it, vi } from "vitest";
import {
  accessDecisionToStatus,
  decideAdminAccess,
  decideMemberAccess,
  type MembershipSnapshot,
  type MembershipStatus,
} from "@/server/domain/access";

vi.mock("server-only", () => ({}));

const INACTIVE_STATUSES: MembershipStatus[] = ["PENDING", "SUSPENDED", "REMOVED"];

describe("decideMemberAccess", () => {
  it("allows an active MEMBER", () => {
    expect(decideMemberAccess({ role: "MEMBER", status: "ACTIVE" })).toBe("allow");
  });

  it("allows an active ADMIN", () => {
    expect(decideMemberAccess({ role: "ADMIN", status: "ACTIVE" })).toBe("allow");
  });

  it("treats a missing membership as not found", () => {
    expect(decideMemberAccess(null)).toBe("not_found");
  });

  it.each(INACTIVE_STATUSES)("treats a %s membership as not found", (status) => {
    expect(decideMemberAccess({ role: "MEMBER", status })).toBe("not_found");
    expect(decideMemberAccess({ role: "ADMIN", status })).toBe("not_found");
  });
});

describe("decideAdminAccess", () => {
  it("allows an active ADMIN", () => {
    expect(decideAdminAccess({ role: "ADMIN", status: "ACTIVE" })).toBe("allow");
  });

  it("forbids an active MEMBER who is not an admin", () => {
    expect(decideAdminAccess({ role: "MEMBER", status: "ACTIVE" })).toBe("forbidden");
  });

  it("treats a non-member as not found", () => {
    expect(decideAdminAccess(null)).toBe("not_found");
  });

  it.each(INACTIVE_STATUSES)(
    "treats a %s membership as not found, even with the ADMIN role",
    (status) => {
      const membership: MembershipSnapshot = { role: "ADMIN", status };
      expect(decideAdminAccess(membership)).toBe("not_found");
      expect(decideAdminAccess({ role: "MEMBER", status })).toBe("not_found");
    },
  );
});

describe("accessDecisionToStatus", () => {
  it("maps allow to 200", () => {
    expect(accessDecisionToStatus("allow")).toBe(200);
  });

  it("maps forbidden to 403", () => {
    expect(accessDecisionToStatus("forbidden")).toBe(403);
  });

  it("maps not_found to 404", () => {
    expect(accessDecisionToStatus("not_found")).toBe(404);
  });
});
