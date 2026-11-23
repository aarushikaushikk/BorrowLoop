import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { communityPathFor } from "@/lib/auth/routes";
import { ITEM_CATEGORY_LABELS, ITEM_CONDITION_LABELS } from "@/lib/items/labels";
import { getCommunityAccess } from "@/server/auth/community-access";
import { getCommunityWithListings, type CommunityListing } from "@/server/dal/listings";

/**
 * The member-only part of /c/[communityId].
 *
 * 1. `getCommunityAccess` resolves the user from the session (or redirects to
 *    sign-in), validates the route params with Zod, and checks membership in
 *    the database. Anything but "allow" renders not-found, so a community the
 *    user doesn't belong to looks exactly like one that doesn't exist.
 * 2. Only then are listings read, for the validated community ID and the
 *    session user, by a query that scopes membership and community itself.
 *
 * Per-user data on every request (no "use cache"), so it must sit inside a
 * `<Suspense>` boundary.
 */
export async function CommunityListingsContent({ params }: { params: Promise<unknown> }): Promise<ReactElement> {
  // Request time only: the session check (Auth.js) generates random values,
  // which Cache Components doesn't allow during prerendering.
  await connection();
  const routeParams = await params;
  const { user, access } = await getCommunityAccess({
    params: routeParams,
    level: "member",
    callbackPath: communityPathFor(routeParams),
  });
  if (access.decision !== "allow") {
    notFound();
  }

  const community = await getCommunityWithListings({ id: user.id }, access.communityId);
  if (!community) {
    // Membership removed between the check and the read.
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{community.name}</h1>
          {community.description ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{community.description}</p>
          ) : null}
        </div>
        <Link
          href={`/c/${community.id}/items/new`}
          className="inline-flex h-10 shrink-0 items-center self-start rounded-full bg-emerald-700 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          List an item
        </Link>
      </header>

      <section aria-labelledby="listings-heading" className="flex flex-col gap-4">
        <h2 id="listings-heading" className="text-lg font-semibold">
          Listings
        </h2>
        {community.listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-6 dark:border-white/20">
            <p className="text-sm font-medium">No listings in this community yet.</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Items members share here will appear in this list.
            </p>
          </div>
        ) : (
          <ul aria-labelledby="listings-heading" className="grid gap-3 sm:grid-cols-2">
            {community.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ListingCard({ listing }: { listing: CommunityListing }): ReactElement {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-zinc-900">
      <h3 className="text-base font-semibold">{listing.title}</h3>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {ITEM_CATEGORY_LABELS[listing.category]} · {ITEM_CONDITION_LABELS[listing.condition]}
      </p>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{listing.description}</p>
    </li>
  );
}
