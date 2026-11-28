import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { ReactElement } from "react";
import { BlockedDatesForm } from "@/app/(app)/c/[communityId]/items/[itemId]/blocked-dates-form";
import { RemoveBlockButton } from "@/app/(app)/c/[communityId]/items/[itemId]/remove-block-button";
import { communityPathFor, itemPathFor } from "@/lib/auth/routes";
import { formatDateRange, todayUtc } from "@/lib/dates/calendar-date";
import { ITEM_CATEGORY_LABELS, ITEM_CONDITION_LABELS } from "@/lib/items/labels";
import { itemRouteParamsSchema } from "@/lib/validation/availability";
import { getCommunityAccess } from "@/server/auth/community-access";
import { getItemAvailability, type ItemAvailabilityView } from "@/server/dal/availability";

/**
 * The member-only part of /c/[communityId]/items/[itemId].
 *
 * 1. Route params are validated (strict) before anything else. Invalid ones
 *    render not-found without touching the session or the database.
 * 2. `getCommunityAccess` resolves the session user (or redirects to sign-in,
 *    returning here) and checks membership. It gets only the community ID,
 *    because its params schema is strict too.
 * 3. `getItemAvailability` reads the item for the session user in the
 *    authorized community, scoped in the query to PUBLISHED items. A missing,
 *    unpublished or inaccessible item renders the same not-found.
 * 4. Notes and the add/remove controls render only in the owner view, which
 *    the data layer decides from the session user. Borrowers get dates only.
 *
 * Per-user data on every request (no "use cache"), so it sits inside
 * <Suspense>. Because the page has started streaming by then, not-found here
 * keeps HTTP 200 (Next adds noindex); the proxy already returns a real 404 to
 * non-members of the community.
 */
export async function ItemDetailContent({ params }: { params: Promise<unknown> }): Promise<ReactElement> {
  // Request time only: the session check (Auth.js) generates random values,
  // which Cache Components doesn't allow during prerendering.
  await connection();
  const parsed = itemRouteParamsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }

  const { user, access } = await getCommunityAccess({
    params: { communityId: parsed.data.communityId },
    level: "member",
    callbackPath: itemPathFor(parsed.data),
  });
  if (access.decision !== "allow") {
    notFound();
  }

  const today = todayUtc(new Date());
  const view = await getItemAvailability(
    { id: user.id },
    { communityId: access.communityId, itemId: parsed.data.itemId },
    today,
  );
  if (!view) {
    notFound();
  }

  const { item } = view;
  return (
    <div className="flex flex-col gap-8">
      <Link
        href={communityPathFor({ communityId: item.communityId })}
        className="self-start text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-400"
      >
        ← Back to community
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{item.title}</h1>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {ITEM_CATEGORY_LABELS[item.category]} · {ITEM_CONDITION_LABELS[item.condition]}
        </p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.description}</p>
      </header>

      <section aria-labelledby="availability-heading" className="flex flex-col gap-3">
        <h2 id="availability-heading" className="text-lg font-semibold">
          Unavailable dates
        </h2>
        <BlockList view={view} />
      </section>

      {view.viewer === "owner" ? (
        <section
          aria-labelledby="block-dates-heading"
          className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-zinc-900"
        >
          <h2 id="block-dates-heading" className="text-lg font-semibold">
            Block dates
          </h2>
          <BlockedDatesForm communityId={item.communityId} itemId={item.id} today={today} />
        </section>
      ) : null}
    </div>
  );
}

const listClass = "flex flex-col divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/15 dark:border-white/15";

/** The blocked ranges: dates only for members; dates, notes and Remove for the owner. */
function BlockList({ view }: { view: ItemAvailabilityView }): ReactElement {
  if (view.blocks.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">No blocked dates.</p>;
  }

  if (view.viewer === "member") {
    return (
      <ul aria-labelledby="availability-heading" className={listClass}>
        {view.blocks.map((block) => (
          <li key={block.id} className="px-4 py-3 text-sm font-medium">
            {formatDateRange(block.startDate, block.endDate)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-labelledby="availability-heading" className={listClass}>
      {view.blocks.map((block) => {
        const rangeLabel = formatDateRange(block.startDate, block.endDate);
        return (
          <li key={block.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{rangeLabel}</span>
              {block.note ? (
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Private note: {block.note}</span>
              ) : null}
            </div>
            <RemoveBlockButton communityId={view.item.communityId} availabilityId={block.id} rangeLabel={rangeLabel} />
          </li>
        );
      })}
    </ul>
  );
}
