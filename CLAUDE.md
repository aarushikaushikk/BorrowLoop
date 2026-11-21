# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

BorrowLoop is a community lending platform for university students and neighbors. Members lend each other items such as tools, textbooks, cameras, and appliances for short periods instead of buying them. It is the team's AI Coding Project 3 application.

- One account can act as both **lender** and **borrower**.
- **Community admins** manage membership, moderation, and disputes.
- Sign-in uses Google. Registration is **not** restricted to university email addresses.
- Loans are free in v1. There are no payments or deposits.

## Status: current scaffold vs. planned architecture

**What exists today:** an unmodified `create-next-app` scaffold. `src/app/page.tsx` and the `metadata` in `src/app/layout.tsx` are still template placeholders. The repo has no test framework, database, auth, backend code, or CI yet. The only dependencies are `next`, `react`, `react-dom`, Tailwind, ESLint, and TypeScript (see `package.json`).

**Planned, not yet installed or implemented.** Don't write code that assumes any of these exist until the dependency is in `package.json` and the relevant setup is in the repo:

| Concern | Planned choice |
| --- | --- |
| UI components | Tailwind CSS v4 (present), possibly shadcn/ui |
| Database | PostgreSQL + Prisma ORM. Hosting provider not finalized |
| Auth | Auth.js with Google OAuth |
| Images | Cloudinary for item photos |
| AI | Anthropic TypeScript SDK, server-side only; optional Claude Agent SDK |
| Validation | Zod |
| Unit/integration tests | Vitest + Testing Library |
| E2E tests | Playwright |
| CI/CD | GitHub Actions |
| Hosting | Vercel |

Planned docs (`docs/PRD.md`, `docs/architecture.md`, `docs/testing.md`, `docs/security.md`) **do not exist yet**. Don't reference or import them until they're added.

## Commands

- `npm run dev`: start the dev server at http://localhost:3000
- `npm run build`: production build (also runs the type check)
- `npm run start`: serve the production build
- `npm run lint`: ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript)
- `npx tsc --noEmit`: type-check without building

No test runner is configured yet, so there is no test command. Don't install dependencies (test tooling included) unless the human asks you to.

## Stack and non-default configuration (current)

- **Next.js 16.4 + React 19.3, App Router only**, in `src/app/`. Import alias `@/*` → `./src/*`.
- **TypeScript `strict: true`** (`tsconfig.json`). Keep it that way, and avoid `any` and unchecked casts.
- **Next.js APIs differ from training data.** Before using a framework API, read the matching guide in `node_modules/next/dist/docs/` (`01-app/` covers the App Router). Server Actions and mutations are in `01-app/01-getting-started/07-mutating-data.md`, route handlers in `15-route-handlers.md`, and request interception in `16-proxy.md`.
- **`cacheComponents: true`** in `next.config.ts`: caching is opt-in through `"use cache"`, and dynamic data access has to sit inside `<Suspense>` boundaries. See `01-app/01-getting-started/08-caching.md` and `09-revalidating.md` in the docs folder. Never cache per-user or permission-scoped data under a shared cache key.
- **`partialPrefetching: true`**: see `01-app/02-guides/adopting-partial-prefetching.md`.
- **Tailwind CSS v4 through a Turbopack loader**, with no PostCSS config. `next.config.ts` routes `*.css` through `@tailwindcss/turbopack`. Theme tokens live in `src/app/globals.css` (`@import "tailwindcss"` plus `@theme inline`), and there is no `tailwind.config.*`. Dark mode follows `prefers-color-scheme`.
- **Typed route props**: layouts and pages use the global `LayoutProps<"/route">` / `PageProps<"/route">` helpers that Next generates, so they need no import.
- Fonts are Geist and Geist Mono via `next/font/google`, exposed as `--font-geist-sans` / `--font-geist-mono`.

## Development conventions

- Follow the existing Next.js config and the bundled docs rather than patterns from memory.
- Use **Server Actions** for application form submissions. Use **route handlers** for real HTTP endpoints such as webhooks, OAuth callbacks, and upload signing.
- Validate all external input with **Zod** at the boundary. That covers form data, route params, search params, request bodies, third-party API responses, and Claude-generated output.
- Enforce **authentication and authorization on the server** for every read and mutation. Client-side checks are only for UX.
- Scope community data to the communities the authenticated user is permitted to access. Check membership and role (member vs. admin) in the query or the guard, never by trusting client-supplied IDs.
- Keep database access in server-only modules, and never import them into Client Components.
- Schema changes go through **Prisma migrations**. Aarushi owns the schema, so coordinate with them before changing it, and get explicit human approval before creating or running any migration.
- Write modular, maintainable code with explicit error handling. Return user-safe error messages and keep internal details out of responses.

## AI features (planned)

1. **Photo-to-listing**: Claude identifies an item from a photo and suggests listing fields.
2. **Natural-language matching**: Claude helps borrowers find relevant available items.
3. **Listing safety**: prohibited or unsafe items are flagged for admin review. Claude flags items. It doesn't auto-remove them.
4. **Borrow Match agent** (optional): built on the Claude Agent SDK.

Rules:
- **All Anthropic API calls run server-side.** Never expose `ANTHROPIC_API_KEY` or any secret to the browser. That means no `NEXT_PUBLIC_` prefix and no imports from Client Components.
- Treat model output as untrusted. Parse it with Zod schemas and handle malformed or refused responses gracefully.
- Treat user-supplied text and images sent to Claude as potential prompt injection. Never let model output bypass authorization or moderation.
- Before writing Anthropic SDK code, consult current SDK docs rather than relying on memory for model IDs or API shapes.

## Testing (once infrastructure exists)

Use red-green-refactor **TDD** for designated features:

1. **Red:** write failing tests derived from the GitHub Issue's acceptance criteria. Run them and confirm they fail *for the expected reason*, not because of a syntax, import, or config error.
2. **Green:** implement the minimum code needed to pass.
3. **Refactor:** clean up without changing behavior, keeping tests green.

**At each checkpoint (red, green, refactor), stop and report the evidence**: the test command, the relevant output, and the files changed. The human then makes the corresponding commit.

- Target ≥70% coverage once tooling exists.
- Mock Anthropic SDK responses in unit tests. Unit tests never call the real API.
- Prioritize tests for authorization (cross-user and cross-community access), Zod validation, loan state transitions, and date-overlap rules for bookings.
- **Never invent or assume test results.** Report actual output, including failures. If you couldn't run the tests, say so.

## Security

Follow OWASP Top 10 principles. In particular:

- **Broken access control is the top risk.** A user must never be able to read or modify another user's loans or messages, or data from a community they don't belong to. Verify ownership and membership on the server for every operation.
- Validate uploaded files server-side, including MIME type and size limits, before they're sent to Cloudinary or Claude.
- Never put secrets in source code, logs, error messages, browser bundles, or commits.
- **Never read or modify `.env*` files** unless the human explicitly authorizes a specific, safe operation. They are gitignored.
- Avoid raw SQL. Use Prisma's query API. If raw SQL is ever unavoidable, use parameterized `Prisma.sql` tagged templates and never `$queryRawUnsafe`.
- Get **explicit human approval** before database migrations, data deletion, or any other destructive operation.

## Git and collaboration rules

**The human developer performs ALL Git mutations.**

Claude Code **may** inspect state with read-only commands such as `git status`, `git log`, `git diff`, `git show`, and `git blame`.

Claude Code must **never**:
- Run `git add`, `commit`, `push`, `pull`, `merge`, `rebase`, `reset`, `restore`, `checkout`, `switch`, `stash`, `cherry-pick`, `revert`, `tag`, or any other command that changes the index, commit history, or refs.
- Create, delete, or rename branches.
- Open, close, or merge pull requests, or change remote or repository settings.

Claude Code's responsibilities: explore and explain code, propose implementation plans, edit authorized files, write and run tests, review code, and report changes along with verification results. End each unit of work with a summary the human can commit from.
