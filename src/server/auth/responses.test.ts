import { describe, expect, it, vi } from "vitest";
import { accessDeniedResponse } from "@/server/auth/responses";

vi.mock("server-only", () => ({}));

describe("accessDeniedResponse", () => {
  it("returns HTTP 403 with a generic body for forbidden", async () => {
    const response = accessDeniedResponse("forbidden");

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("returns HTTP 404 with a generic body for not_found", async () => {
    const response = accessDeniedResponse("not_found");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("responds with JSON and is never cached", () => {
    const response = accessDeniedResponse("forbidden");

    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not reveal community, user, or role details", async () => {
    const forbiddenBody = await accessDeniedResponse("forbidden").text();
    const notFoundBody = await accessDeniedResponse("not_found").text();

    for (const body of [forbiddenBody, notFoundBody]) {
      expect(body).not.toMatch(/community|user|admin|member|role|membership/i);
    }
  });
});
