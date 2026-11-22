import type { Metadata } from "next";
import { Suspense } from "react";
import { signInWithGoogle } from "@/app/(auth)/sign-in/actions";
import { DEFAULT_CALLBACK_PATH, parseSignInSearchParams } from "@/lib/validation/auth";

export const metadata: Metadata = {
  title: "Sign in · BorrowLoop",
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 font-sans dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          BorrowLoop
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Borrow and lend everyday items with people in your community.
        </p>

        <div className="mt-8">
          {/* searchParams are request data, so they're read inside Suspense. */}
          <Suspense fallback={<GoogleSignInForm callbackUrl={DEFAULT_CALLBACK_PATH} disabled />}>
            <SignInForm searchParams={searchParams} />
          </Suspense>
        </div>

        <p className="mt-6 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Any Google account works. You&apos;ll only see listings from communities you join.
        </p>
      </div>
    </main>
  );
}

async function SignInForm({
  searchParams,
}: {
  searchParams: PageProps<"/sign-in">["searchParams"];
}) {
  const { callbackUrl, hasError } = parseSignInSearchParams(await searchParams);

  return (
    <>
      {hasError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          We couldn&apos;t sign you in. Please try again.
        </p>
      )}
      <GoogleSignInForm callbackUrl={callbackUrl} />
    </>
  );
}

function GoogleSignInForm({ callbackUrl, disabled = false }: { callbackUrl: string; disabled?: boolean }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <button
        type="submit"
        disabled={disabled}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-black/15 bg-white px-5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-wait disabled:opacity-60 dark:border-white/20 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29V6.6H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}
