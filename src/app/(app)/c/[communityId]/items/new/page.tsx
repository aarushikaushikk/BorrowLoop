import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewListingContent } from "@/app/(app)/c/[communityId]/items/new/new-listing-content";

export const metadata: Metadata = {
  title: "List an item · BorrowLoop",
};

/**
 * Static shell for /c/[communityId]/items/new. Everything that reads the
 * session or the route's community ID streams in behind the Suspense
 * boundary; nothing here is cached per user.
 */
export default function NewListingPage({ params }: PageProps<"/c/[communityId]/items/new">) {
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
            Checking your access…
          </p>
        }
      >
        <NewListingContent params={params} />
      </Suspense>
    </main>
  );
}
