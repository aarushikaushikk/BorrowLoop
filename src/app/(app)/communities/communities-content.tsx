import type { ReactElement } from "react";
import { signOutAction } from "@/app/(app)/communities/actions";
import { requireUser } from "@/server/auth/session";

/**
 * The signed-in part of /communities.
 *
 * Validates the session on the server: a missing, fake, or expired session
 * cookie redirects to sign-in before anything renders. Reads request data, so
 * it must sit inside a `<Suspense>` boundary.
 */
export async function CommunitiesContent(): Promise<ReactElement> {
  const user = await requireUser("/communities");

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

      <section
        aria-labelledby="communities-heading"
        className="rounded-2xl border border-dashed border-black/15 p-6 dark:border-white/20"
      >
        <h2 id="communities-heading" className="text-lg font-semibold">
          Your communities
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Community membership and listings are pending database integration. They aren&apos;t
          available yet.
        </p>
      </section>
    </div>
  );
}
