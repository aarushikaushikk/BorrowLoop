# BorrowLoop: Testing Strategy

> **Status (2026-11-20): no test infrastructure exists yet.** There's no test runner, no test database, no coverage tooling, and no CI. `package.json` has no `test` script. Everything below is the **planned** strategy. Don't install test dependencies until a human asks you to.
>
> **Never claim tests passed unless they actually ran.** Report the real command and output, including failures. If tests couldn't be run, say so.

Related documents: `docs/PRD.md`, `docs/architecture.md`, `docs/security.md`, `CLAUDE.md`.

---

## 1. Tooling (planned)

| Layer | Tool | Scope | Next.js guide |
| --- | --- | --- | --- |
| Unit | Vitest | Pure domain logic, Zod schemas, AI output parsers, guards | `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` |
| Component | Vitest + Testing Library | Client Components and **synchronous** Server Components | same |
| Integration | Vitest + test PostgreSQL | Server Actions, data access functions, and guards against a real database | — |
| End-to-end | Playwright | Full user flows, including **async Server Components** | `node_modules/next/dist/docs/01-app/02-guides/testing/playwright.md` |
| Coverage | Vitest coverage (provider TBD) | **≥ 70%** target | — |

> From the bundled Next.js docs: Vitest **doesn't support async Server Components**. Test those through E2E tests, and keep their logic in plain functions that unit tests can cover.

## 2. Test pyramid and priorities

These priorities come from the confirmed acceptance criteria in `docs/PRD.md`. Specific techniques (for example, not-found responses for other communities' data, or plain-text rendering) test **proposed** details. Update them if the team decides otherwise.

Highest priority first. These map to the biggest risks in `docs/security.md`.

1. **Authorization and authentication on the server**
   - Unauthenticated calls to every Server Action and route handler are rejected.
   - Cross-user: user B can't read, modify, approve, cancel, or rate user A's items or loans.
   - Cross-community: a member of community X gets not-found for items, loans, open requests, and reports in community Y, including through search and AI results.
   - Non-admins get 403 on admin pages and actions (US-1, US-8).
   - Client-supplied `communityId`, `ownerId`, `borrowerId`, `role`, etc. are ignored or rejected.
2. **Input validation (Zod)**: every schema has valid, boundary, and invalid cases. For example, message length 0 / 1 / 1,000 / 1,001 after trimming, and file size just under and at or over 5 MB.
3. **Date overlap**: same day, adjacent days (inclusive boundaries), containment, partial overlap, zero-length ranges, start > end, past dates.
4. **Loan state transitions**: every allowed transition by the correct actor, every disallowed transition, wrong-actor attempts, transitions from terminal states, concurrent approvals of overlapping requests.
5. **Message access**: only participants can read or post. Closed loans are read-only. Unread counts are correct.
6. **AI handling** (with mocks): valid output, malformed JSON, schema-invalid values (unknown category), refusals, timeouts, item IDs outside the candidate set (must be dropped), prompt-injection-style input that doesn't change authorization or moderation outcomes.
7. **Upload validation**: wrong MIME, spoofed extension, mismatched magic bytes, oversized, empty, and corrupt files are rejected **without calling Claude or Cloudinary** (assert that the mocks weren't called).
8. **Ratings**: only participants, only after `RETURNED`, once per loan, trust score hidden below three ratings.
9. **Private pickup location** (if US-10 is built): never present in responses for non-participants or in search or listing payloads.
10. **Open-request notifications (US-4)**:
    - Creating an open request notifies lenders in the requester's community.
    - No member of any other community receives the notification.
    - Non-members and suspended or removed members aren't recipients.
    - The notification content excludes the requester's email and any location.
    - These tests are independent of the delivery method, which is undecided (`docs/architecture.md` D16). They assert on the recipient list and the content the notification service is given, using a mocked notifier.
11. **Reminders and overdue (US-6)**: reminders are triggered for loans nearing their due date, and the overdue indicator appears only for `PickedUp` loans past their end date. Use fake timers.

## 3. Mocking rules

- **Unit tests never call the real Anthropic API.** Mock the SDK client at the module boundary (for example, inject a client into `src/server/ai/*` functions or mock the module). Use fixture responses for success, malformed, refusal, and timeout cases.
- Integration tests also mock Anthropic and Cloudinary. Only an explicitly separate, manually triggered suite (⚠ needs team decision on whether it exists at all) may hit real external APIs, and it never runs in CI by default.
- Don't mock the authorization guards in authorization tests. Test the real guard against real database rows.
- Freeze time (fake timers) for overdue, reminder, and date tests.

## 4. Database integration tests

- Use a **dedicated test PostgreSQL database**, never a shared dev or production database. The connection string comes from a test-only environment variable. Claude Code must not read or edit `.env*` files without explicit authorization.
- Apply the schema to the test database through Prisma migrations. **Creating or running migrations, even against the test database, needs explicit human approval** until the team agrees on a standing rule for test databases.
- Isolate tests: truncate tables or use per-test transactions between tests. ⚠ Choose the approach once Prisma is installed.
- Use factories that create `User` → `Community` → `Membership` → `Item` → `Loan` graphs, so cross-user and cross-community scenarios are cheap to write.
- Concurrency tests (overlapping approvals) run against a real Postgres. They can't be simulated with mocks.

## 5. End-to-end tests (Playwright)

- Cover the critical flows: sign in → join community → create listing from photo (AI mocked at the server) → block dates → search → request → approve → pickup → return → rate. Plus chat between two participants, and an admin moderation flow.
- **Google OAuth can't be automated reliably.** ⚠ Needs team decision (D14 in `docs/architecture.md`). One option is a test-only credentials or session-seeding path that's **only enabled when an explicit test flag is set and is impossible to enable in production**. Whatever is chosen must be reviewed against `docs/security.md`.
- E2E runs against `npm run build && npm run start` (production mode) with the test database.

## 6. TDD workflow (red, green, refactor)

TDD applies to **designated stories**, marked on the GitHub Issue. Proposed candidates, ⚠ to be confirmed by the team: US-1 (authorization), US-3/US-5 (overlap and request rules), US-6 (state machine), US-7 (rating rules), US-9 (message access and validation).

1. **Red**: write failing tests derived from the issue's acceptance criteria. Run them. Confirm they fail **for the expected reason** (an assertion or missing behavior), **not** because of a syntax, import, or configuration error.
2. **Green**: implement the **minimum** code to pass. Run the tests again.
3. **Refactor**: clean up without changing behavior. Run the tests again and keep them green.

### Checkpoint reports

At **each** checkpoint, Claude Code **stops** and reports:

```
Checkpoint: RED | GREEN | REFACTOR
Issue: #<number> <title>
Command: <exact command run>
Result: <N passed / M failed>, with relevant output excerpt (actual, not paraphrased)
Why it fails (RED only): <expected reason>
Files changed:
  - path/to/file.ts (new | modified)
Suggested commit message: <type>: <summary>
```

Then it waits for the human to commit before continuing.

## 7. Human-controlled Git workflow

| Claude Code does | The human does |
| --- | --- |
| Writes and edits tests and code in authorized files | **All** Git mutations: `add`, `commit`, `push`, `pull`, `merge`, `rebase`, `reset`, `stash`, `checkout`/`switch`, branching, tagging |
| Runs tests, lint, type-check, and build | Opens, reviews, and merges pull requests |
| Uses read-only Git (`status`, `diff`, `log`, `show`, `blame`) to report changes | Decides when each checkpoint gets committed |
| Stops at red, green, and refactor checkpoints with evidence | Approves migrations, dependency installs, and destructive operations |

Claude Code never runs a Git command that changes the index, history, refs, branches, remotes, or pull requests.

## 8. Commands

**Available now:**

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run build` | Production build (also type-checks) |

**Planned (don't exist yet; names to be confirmed when tooling is added):** `npm test` (Vitest), `npm run test:coverage`, `npm run test:e2e` (Playwright).

## 9. Planned CI (GitHub Actions)

> **Not implemented.** There's no `.github/workflows/` directory. This is the intended design. **Owner: Pranav** (CI/CD, Sprint 1). The specific job steps below are proposed.

On every pull request to `main` (and on pushes to `main`):

1. `npm ci`
2. `npm run lint`
3. `npx tsc --noEmit`
4. Unit and integration tests with coverage, **failing below 70%**, against a PostgreSQL **service container** with migrations applied
5. `npm run build`
6. Playwright E2E against the built app (⚠ depends on the D14 auth strategy)

CI rules:
- No real Anthropic or Cloudinary calls. The SDKs are mocked, and no production secrets are configured for test jobs.
- Secrets, if any are ever needed, come from GitHub encrypted secrets, are never printed, and are never available to workflows triggered from forks.
- Upload Playwright traces and reports as artifacts on failure.

## 10. Definition of done (testing)

- [ ] Acceptance criteria from the issue are covered by tests
- [ ] Authorization tests cover the unauthenticated, cross-user, and cross-community cases for every new action or route
- [ ] New Zod schemas have valid, boundary, and invalid tests
- [ ] Anthropic and Cloudinary are mocked. No real API calls in tests
- [ ] Coverage stays at or above 70% once tooling exists
- [ ] Lint, type check, and build pass, with **actual output reported**
