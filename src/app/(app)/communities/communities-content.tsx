import Link from "next/link";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { signOutAction } from "@/app/(app)/communities/actions";
import { requireUser } from "@/server/auth/session";
import { listCommunitiesForUser, type UserCommunity } from "@/server/dal/memberships";

/**
 * The signed-in part of /communities.
 *
 * Validates the session on the server first: a missing, fake, or expired
 * session cookie redirects to sign-in before any database read. The list is
 * then read for the session user's ID only, on every request (no "use cache":
 * it's per-user data). Reads request data, so it must sit inside a
 * `<Suspense>` boundary.
 */
export async function CommunitiesContent(): Promise<ReactElement> {
  // Request time only: the session check (Auth.js) generates random values,
  // which Cache Components doesn't allow during prerendering.
  await connection();
  const user = await requireUser("/communities");
  const communities = await listCommunitiesForUser({ id: user.id });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-white/15 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-semibold text-zinc-950 dark:text-zinc-50">
            {user.name ?? "BorrowLoop member"}
          </span>
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="h-10 w-full rounded-full border border-black/15 px-5 text-sm font-medium transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 sm:w-auto dark:border-white/20 dark:hover:bg-white/10 dark:focus-visible:outline-zinc-50"
          >
            Sign out
          </button>
        </form>
      </div>

      <section aria-labelledby="communities-heading" className="flex flex-col gap-4">
        <h2 id="communities-heading" className="text-lg font-semibold">
          Your communities
        </h2>
        {communities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-6 dark:border-white/20">
            <p className="text-sm font-medium">You&apos;re not a member of any community yet.</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Communities you join will appear here.
            </p>
          </div>
        ) : (
          <ul aria-labelledby="communities-heading" className="flex flex-col gap-3">
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * One community the user belongs to, linking to its member-only page. The
 * link only uses the community's own ID; access is still checked on that page.
 */
function CommunityCard({ community }: { community: UserCommunity }): ReactElement {
  return (
    <li className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">
          <Link
            href={`/c/${community.id}`}
            className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {community.name}
          </Link>
        </h3>
        {community.role === "ADMIN" ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
            Admin
          </span>
        ) : null}
      </div>
      {community.description ? (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{community.description}</p>
      ) : null}
    </li>
  );
}
