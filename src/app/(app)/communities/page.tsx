import type { Metadata } from "next";
import { Suspense } from "react";
import { CommunitiesContent } from "@/app/(app)/communities/communities-content";

export const metadata: Metadata = {
  title: "Your communities · BorrowLoop",
};

export default function CommunitiesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 font-sans sm:px-6 sm:py-16">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          BorrowLoop
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Communities</h1>
      </header>

      <Suspense
        fallback={
          <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
            Checking your session…
          </p>
        }
      >
        <CommunitiesContent />
      </Suspense>
    </main>
  );
}
