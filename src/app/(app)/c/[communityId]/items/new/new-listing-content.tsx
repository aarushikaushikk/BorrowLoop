import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { NewListingForm } from "@/app/(app)/c/[communityId]/items/new/new-listing-form";
import { communityPathFor } from "@/lib/auth/routes";
import { getCommunityAccess } from "@/server/auth/community-access";

/**
 * The member-only part of /c/[communityId]/items/new.
 *
 * `getCommunityAccess` resolves the user from the session (or redirects to
 * sign-in), validates the route params, and checks membership in the
 * database. Anything but "allow" renders not-found, as on the community page.
 * The form then gets only the validated community ID; both Server Actions
 * check access again on their own.
 *
 * Per-user on every request (no "use cache"), so it sits inside <Suspense>.
 */
export async function NewListingContent({ params }: { params: Promise<unknown> }): Promise<ReactElement> {
  // Request time only: the session check (Auth.js) generates random values,
  // which Cache Components doesn't allow during prerendering.
  await connection();
  const routeParams = await params;
  const { access } = await getCommunityAccess({
    params: routeParams,
    level: "member",
    callbackPath: communityPathFor(routeParams, "/items/new"),
  });
  if (access.decision !== "allow") {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href={`/c/${access.communityId}`}
          className="text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-400"
        >
          ← Back to the community
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">List an item</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Upload a photo and we&apos;ll suggest the details. You can change everything before saving.
        </p>
      </header>
      <NewListingForm communityId={access.communityId} />
    </div>
  );
}
