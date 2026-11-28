import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ItemDetailContent } from "@/app/(app)/c/[communityId]/items/[itemId]/item-detail-content";

export const metadata: Metadata = {
  title: "Item · BorrowLoop",
};

/**
 * Static shell for /c/[communityId]/items/[itemId]. Everything that reads the
 * session, the route params or the database streams in behind the Suspense
 * boundary; nothing here is cached per user.
 */
export default function ItemPage({ params }: PageProps<"/c/[communityId]/items/[itemId]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 font-sans sm:px-6 sm:py-16">
      <nav aria-label="Breadcrumb">
        <Link
          href="/communities"
          className="text-sm font-medium text-emerald-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:text-emerald-400"
        >
          ← Your communities
        </Link>
      </nav>

      <Suspense
        fallback={
          <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
            Loading item…
          </p>
        }
      >
        <ItemDetailContent params={params} />
      </Suspense>
    </main>
  );
}
