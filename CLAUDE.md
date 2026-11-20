# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Status

BorrowLoop is currently an unmodified `create-next-app` scaffold. `src/app/page.tsx` and the `metadata` in `src/app/layout.tsx` are still template placeholders. There is no test framework, database, or backend code yet.

## Commands

- `npm run dev`: start the dev server at http://localhost:3000
- `npm run build`: production build (also runs the type check)
- `npm run start`: serve the production build
- `npm run lint`: ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript)
- `npx tsc --noEmit`: type-check without building

No test runner is configured, so there is no command for running a single test yet.

## Stack and non-default configuration

- **Next.js 16.4 + React 19.3, App Router only**, in `src/app/`. Import alias `@/*` → `./src/*`.
- **Next.js APIs differ from training data.** Before using a framework API, read the matching guide in `node_modules/next/dist/docs/` (`01-app/` covers the App Router).
- **`cacheComponents: true`** in `next.config.ts`: caching is opt-in through `"use cache"`, and dynamic data access has to sit inside `<Suspense>` boundaries. See `01-app/01-getting-started/08-caching.md` and `09-revalidating.md` in the docs folder.
- **`partialPrefetching: true`**: see `01-app/02-guides/adopting-partial-prefetching.md`.
- **Tailwind CSS v4 through a Turbopack loader**, with no PostCSS config. `next.config.ts` routes `*.css` through `@tailwindcss/turbopack`. Theme tokens live in `src/app/globals.css` (`@import "tailwindcss"` plus `@theme inline`), and there is no `tailwind.config.*`. Dark mode follows `prefers-color-scheme`.
- **Typed route props**: layouts and pages use the global `LayoutProps<"/route">` / `PageProps<"/route">` helpers that Next generates, so they need no import.
- Fonts are Geist and Geist Mono via `next/font/google`, exposed as `--font-geist-sans` / `--font-geist-mono`.
