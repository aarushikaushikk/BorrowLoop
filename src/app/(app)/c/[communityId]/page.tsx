import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CommunityListingsContent } from "@/app/(app)/c/[communityId]/community-listings-content";

export const metadata: Metadata = {
  title: "Community · BorrowLoop",
};

export default function CommunityPage({ params }: PageProps<"/c/[communityId]">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 font-sans sm:px-6 sm:py-16">
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
            Loading community…
          </p>
        }
      >
        <CommunityListingsContent params={params} />
      </Suspense>
    </main>
  );
}
