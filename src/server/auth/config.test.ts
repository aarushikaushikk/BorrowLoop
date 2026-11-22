import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";
import {
  allowGoogleSignIn,
  authConfig,
  discardOAuthTokens,
  exposeSessionUserId,
  keepServerIssuedToken,
  SIGN_IN_PATH,
} from "@/server/auth/config";

vi.mock("server-only", () => ({}));

function resolvedProviders() {
  return [...authConfig.providers];
}

function sessionFor(user: Session["user"]): Session {
  return { user, expires: "2026-12-31T00:00:00.000Z" };
}

describe("authConfig providers", () => {
  it("configures exactly one provider, Google", () => {
    const providers = resolvedProviders();

    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe("google");
  });

  it("does not restrict Google sign-in to a hosted domain", () => {
    // Google's `hd` authorization parameter is how sign-in would be limited
    // to one domain (for example, a university). It must not be set.
    expect(JSON.stringify(resolvedProviders())).not.toMatch(/"hd"/);
  });

  it("does not hardcode OAuth credentials", () => {
    // AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are read from the environment by
    // Auth.js at runtime.
    expect(JSON.stringify(resolvedProviders())).not.toMatch(/clientId|clientSecret/);
  });

  it("never links accounts by matching email alone", () => {
    const [google] = resolvedProviders();

    expect(google).not.toHaveProperty("allowDangerousEmailAccountLinking");
    expect(google?.options).not.toHaveProperty("allowDangerousEmailAccountLinking");
  });

  it("stores no Google OAuth tokens on the Account row", () => {
    const [google] = resolvedProviders();

    expect(google?.options?.account).toBe(discardOAuthTokens);
  });
});

describe("discardOAuthTokens", () => {
  it("drops access, refresh, and ID tokens and every other token field", () => {
    const tokens = {
      access_token: "fake-access-token",
      refresh_token: "fake-refresh-token",
      id_token: "fake-id-token",
      expires_at: 1_900_000_000,
      scope: "openid email profile",
      token_type: "bearer",
      session_state: "fake-state",
    };

    expect(discardOAuthTokens(tokens)).toEqual({});
  });
});

describe("authConfig pages and session", () => {
  it("uses the custom /sign-in page", () => {
    expect(SIGN_IN_PATH).toBe("/sign-in");
    expect(authConfig.pages?.signIn).toBe(SIGN_IN_PATH);
  });

  it("uses the JWT session strategy explicitly", () => {
    expect(authConfig.session?.strategy).toBe("jwt");
  });

  it("wires the callbacks", () => {
    expect(authConfig.callbacks?.signIn).toBe(allowGoogleSignIn);
    expect(authConfig.callbacks?.jwt).toBe(keepServerIssuedToken);
    expect(authConfig.callbacks?.session).toBe(exposeSessionUserId);
  });
});

describe("allowGoogleSignIn", () => {
  it.each([
    "student@gmail.com",
    "student@asu.edu",
    "neighbor@example.org",
    "someone@custom-domain.co.uk",
  ])("allows a Google account with email %s", (email) => {
    expect(
      allowGoogleSignIn({
        account: { provider: "google" },
        profile: { email },
      }),
    ).toBe(true);
  });

  it("allows a Google account even when the profile has no email", () => {
    expect(allowGoogleSignIn({ account: { provider: "google" } })).toBe(true);
  });

  it.each(["github", "credentials", "email", "GOOGLE"])(
    "rejects the non-Google provider %s",
    (provider) => {
      expect(allowGoogleSignIn({ account: { provider } })).toBe(false);
    },
  );

  it("rejects a sign-in with no account", () => {
    expect(allowGoogleSignIn({ account: null })).toBe(false);
    expect(allowGoogleSignIn({})).toBe(false);
  });
});

describe("keepServerIssuedToken", () => {
  it("returns the server-issued token unchanged", () => {
    const token: JWT = { sub: "server-user-id", name: "Ada" };

    expect(keepServerIssuedToken({ token })).toEqual({ sub: "server-user-id", name: "Ada" });
  });

  it("ignores client-supplied session data on update", () => {
    const token: JWT = { sub: "server-user-id" };

    const result = keepServerIssuedToken({
      token,
      trigger: "update",
      session: { user: { id: "attacker-id" }, sub: "attacker-id" },
    });

    expect(result).toEqual({ sub: "server-user-id" });
  });
});

describe("exposeSessionUserId", () => {
  it("sets the session user ID from the server-issued token subject", () => {
    const result = exposeSessionUserId({
      session: sessionFor({ name: "Ada", email: "ada@example.com" }),
      token: { sub: "server-user-id" },
    });

    expect(result.user?.id).toBe("server-user-id");
    expect(result.user?.name).toBe("Ada");
  });

  it("overwrites any user ID already present on the session object", () => {
    const result = exposeSessionUserId({
      session: sessionFor({ id: "attacker-id", name: "Ada" }),
      token: { sub: "server-user-id" },
    });

    expect(result.user?.id).toBe("server-user-id");
  });

  it("returns a session without a user unchanged", () => {
    const session: Session = { expires: "2026-12-31T00:00:00.000Z" };

    expect(exposeSessionUserId({ session, token: { sub: "server-user-id" } })).toEqual(session);
  });

  it("leaves the user ID unset when the token has no subject", () => {
    const result = exposeSessionUserId({
      session: sessionFor({ id: "attacker-id", name: "Ada" }),
      token: {},
    });

    expect(result.user?.id).toBeUndefined();
  });
});
