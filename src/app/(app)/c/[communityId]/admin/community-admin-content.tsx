import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { communityPathFor } from "@/lib/auth/routes";
import { getCommunityAccess } from "@/server/auth/community-access";
import { getAdministeredCommunity } from "@/server/dal/memberships";

/**
 * The admin-only part of /c/[communityId]/admin.
 *
 * The proxy normally answers non-admins before this renders (403 for members,
 * 404 for non-members). This component checks again on its own, so a matcher
 * mistake can never expose admin content:
 * - not_found renders the not-found UI;
 * - forbidden renders a fixed notice with no community data.
 *
 * Minimal on purpose: moderation and membership tools belong to US-8.
 */
export async function CommunityAdminContent({ params }: { params: Promise<unknown> }): Promise<ReactElement> {
  // Request time only: the session check (Auth.js) generates random values,
  // which Cache Components doesn't allow during prerendering.
  await connection();
  const routeParams = await params;
  const { user, access } = await getCommunityAccess({
    params: routeParams,
    level: "admin",
    callbackPath: communityPathFor(routeParams, "/admin"),
  });
  if (access.decision === "not_found") {
    notFound();
  }
  if (access.decision === "forbidden") {
    return (
      <div role="alert" className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Only community admins can open this page.</p>
      </div>
    );
  }

  const community = await getAdministeredCommunity({ id: user.id }, access.communityId);
  if (!community) {
    // Admin role removed between the check and the read.
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Community admin
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{community.name}</h1>
      </header>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        You&apos;re an admin of this community. Moderation and membership tools will appear here.
      </p>
    </div>
  );
}
