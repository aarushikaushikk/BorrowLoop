# BorrowLoop: Architecture

> **Status (2026-11-20): proposed architecture, not implemented.** The repository is an unmodified `create-next-app` scaffold. Today the only dependencies are `next` 16.4, `react`/`react-dom` 19.3, Tailwind CSS v4 (via `@tailwindcss/turbopack`), ESLint 9, and TypeScript. Everything else here (Prisma, Auth.js, Cloudinary, the Anthropic SDK, Zod) is **planned**. Don't write code that assumes a dependency until it's in `package.json`.
>
> Items marked **⚠ Needs team decision** are open. Record decisions in §12 before relying on them.
>
> **Confirmed** in the Project 3 proposal: the stack in §2 (with database hosting undecided), the entity list in §4, retrieval before Claude ranking for matching (§9.2), and the Borrow Match agent's three tools and its rule never to submit a loan without user confirmation (§9.4). **Everything else** in this document is **proposed**: helper names, field names, module layout, flows, and concurrency strategies. It needs team agreement (and Aarushi's, for schema matters) before implementation.
>
> Framework doc paths below are relative to `node_modules/next/dist/docs/`, unless written in full.

## Ownership (confirmed for Sprint 1)

| Owner | Architecture areas |
| --- | --- |
| Pranav | Claude Code setup, CI/CD (GitHub Actions), auth and community membership (US-1), availability (US-3) |
| Aarushi | Database and Prisma schema coordination, Cloudinary, photo-to-listing (US-2), task board |

Owners for later areas (US-4 through US-10, the Borrow Match agent) aren't assigned yet.

Related documents: `docs/PRD.md`, `docs/testing.md`, `docs/security.md`, `CLAUDE.md`.

---

## 1. Current state (implemented)

| Area | Current state (verified from repo config) |
| --- | --- |
| Framework | Next.js 16.4 App Router, `src/app/`, alias `@/*` → `./src/*` |
| Language | TypeScript, `strict: true` |
| Next config | `cacheComponents: true`, `partialPrefetching: true`, Turbopack rule routing `*.css` through `@tailwindcss/turbopack` |
| Styling | Tailwind CSS v4. Tokens are in `src/app/globals.css`. There's no `tailwind.config.*` and no PostCSS config |
| Lint | ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript) |
| App code | Template placeholder page and layout only |
| Database, auth, AI, tests, CI | **None** |

## 2. Planned stack

| Concern | Planned choice | Notes |
| --- | --- | --- |
| Framework | Next.js App Router, strict TS | Read `node_modules/next/dist/docs/` before using any framework API. This version differs from older Next.js. |
| Mutations | **Server Actions** for app forms | `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` |
| HTTP endpoints | **Route handlers** for OAuth callbacks, webhooks, upload signing, polling endpoints | `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` |
| Request interception | *(Proposed)* `proxy.ts` (formerly middleware) for optimistic redirects only | `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`. Never the only auth check. |
| Database | PostgreSQL + Prisma ORM | ⚠ Hosting provider undecided. Schema coordination: Aarushi |
| Auth | Auth.js + Google OAuth | See also `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` |
| Images | Cloudinary | Item photos. Owner: Aarushi |
| AI | Anthropic TypeScript SDK, **server-side only** | Optional Claude Agent SDK for Borrow Match. Check current SDK docs for model IDs and API shapes. Don't hard-code from memory. |
| Validation | Zod | At every boundary |
| UI | Tailwind v4, possibly shadcn/ui | ⚠ shadcn/ui not confirmed |
| Hosting | Vercel | |
| CI/CD | GitHub Actions | Not set up yet. Owner: Pranav. Planned checks are in `docs/testing.md` §9 |

No other technologies should be added without team agreement.

## 3. System overview (proposed)

```
Browser (Server Components HTML + small Client Components)
   │  form submit → Server Action          │  HTTP → Route handler
   ▼                                       ▼
┌──────────────────────── Next.js on Vercel ─────────────────────────┐
│ proxy.ts: optimistic "signed in?" redirect only                    │
│                                                                    │
│ Server Actions / Route handlers / Server Components                │
│   1. auth: requireUser()           (Auth.js session)               │
│   2. validate: Zod schema          (form data, params, bodies)     │
│   3. authorize: membership/role/ownership guard                    │
│   4. domain service (loan state machine, availability, ...)        │
│   5. data access layer (server-only, Prisma)                       │
│                                                                    │
│ AI services (server-only): Anthropic SDK → Zod-parse output        │
└───────┬───────────────────────┬───────────────────────┬────────────┘
        ▼                       ▼                       ▼
   PostgreSQL              Cloudinary            Anthropic API
   (Prisma)               (item photos)            (Claude)
```

### Proposed module layout

> ⚠ Proposed. Confirm with the team before creating these folders.

```
src/
  app/                      # routes only: pages, layouts, route handlers, actions colocated per feature
    (auth)/sign-in/
    (app)/c/[communityId]/  # community-scoped routes
      items/ loans/ search/ admin/
    api/                    # route handlers (auth callback, polling, upload)
  server/                   # all files start with `import "server-only"`
    auth/                   # session helpers, requireUser, guards
    db/                     # Prisma client singleton
    dal/                    # data access functions, always take the authorized user
    domain/                 # pure logic: loan state machine, date overlap, trust score
    ai/                     # Anthropic client, prompts, Zod output schemas
    images/                 # upload validation, Cloudinary client
  lib/
    validation/             # shared Zod schemas (safe for client import, no secrets)
  components/               # UI components
```

Rules:
- Everything under `src/server/` imports `server-only` and is **never** imported by a Client Component.
- `src/server/domain/` is **pure**: no Prisma, no I/O. That keeps the state machine and overlap logic easy to unit test.
- Data access functions take the **authenticated user (or a verified context)** as a parameter and apply scoping in the query itself.

## 4. Proposed data model

> **Aarushi owns database and Prisma schema coordination.** The **entity names** below come from the confirmed proposal. The **fields, enums, constraints, and indexes are proposed** for discussion. This isn't a finalized schema. Coordinate with Aarushi before writing `schema.prisma`, and get explicit human approval before creating or running any migration.

### Entities

| Entity | Purpose | Key proposed fields | Key constraints / indexes |
| --- | --- | --- | --- |
| **User** | An account (Auth.js) | `id`, `name`, `email`, `image`, `createdAt` | `email` unique. Auth.js adapter tables (Account, Session, VerificationToken) are added according to Auth.js docs. |
| **Community** | A lending group | `id`, `name`, `slug`, `timeZone`, `joinCode?`, `createdAt` | `slug` unique |
| **Membership** | A user's membership in a community | `id`, `userId`, `communityId`, `role` (`MEMBER` \| `ADMIN`), `status` (`PENDING` \| `ACTIVE` \| `SUSPENDED` \| `REMOVED`), `joinedAt` | unique(`userId`, `communityId`) |
| **Item** | A listing | `id`, `communityId`, `ownerId`, `title`, `description`, `category`, `condition`, `status` (`DRAFT` \| `PENDING_REVIEW` \| `ACTIVE` \| `REMOVED`), `flaggedReason?`, `createdAt`, `updatedAt` | index(`communityId`, `status`). `ownerId` must be an active member of `communityId`. |
| **ItemPhoto** | A Cloudinary photo of an item | `id`, `itemId`, `cloudinaryPublicId`, `url`, `width`, `height`, `altText`, `position` | index(`itemId`) |
| **Availability** | A lender-blocked date range | `id`, `itemId`, `startDate`, `endDate` (calendar dates, inclusive), `note?` | index(`itemId`, `startDate`) |
| **Loan** | A request and its lifecycle | `id`, `itemId`, `borrowerId`, `lenderId` (copied from item owner at request time), `communityId`, `startDate`, `endDate`, `status` (`REQUESTED` \| `APPROVED` \| `PICKED_UP` \| `RETURNED` \| `DECLINED` \| `CANCELLED`), timestamps for each transition, `pickupLat?`, `pickupLng?` (US-10, private) | index(`itemId`, `status`). App-enforced: `borrowerId ≠ lenderId`, `startDate ≤ endDate`. |
| **BorrowRequest** | An open "wanted" post (US-4). Creating one triggers a notification to community lenders | `id`, `communityId`, `requesterId`, `description`, `startDate?`, `endDate?`, `status` (`OPEN` \| `FULFILLED` \| `CLOSED`), `expiresAt?` | index(`communityId`, `status`) |
| **Rating** | A post-return rating | `id`, `loanId`, `raterId`, `rateeId`, `score`, `comment?`, `createdAt` | unique(`loanId`, `raterId`) |
| **Report** | A moderation item (AI flag or member report) and its decision log | `id`, `communityId`, `itemId?`, `reportedUserId?`, `reporterId?` (null for AI flags), `source` (`AI` \| `MEMBER`), `reason`, `status` (`OPEN` \| `APPROVED` \| `REMOVED` \| `DISMISSED`), `resolvedById?`, `resolvedAt?`, `resolutionNote?` | index(`communityId`, `status`) |
| **Conversation** | One chat per loan | `id`, `loanId`, `borrowerLastReadAt?`, `lenderLastReadAt?` | unique(`loanId`) |
| **Message** | A chat message | `id`, `conversationId`, `senderId`, `body` (1–1,000 chars), `createdAt` | index(`conversationId`, `createdAt`) |

### Relationships

```
User 1─* Membership *─1 Community
Community 1─* Item 1─* ItemPhoto
Item 1─* Availability
Item 1─* Loan *─1 User (borrower)        Loan 1─1 Conversation 1─* Message
Loan 1─* Rating (at most one per rater)
Community 1─* BorrowRequest, Report
```

### Open modeling questions (⚠ Needs team decision / Aarushi)

- Whether `Loan.communityId` and `lenderId` are denormalized (proposed, so queries can be scoped cheaply) or always derived via `Item`.
- Whether unread tracking uses per-participant `lastReadAt` on `Conversation` (proposed) or a separate participant table.
- Whether moderation decisions need a separate immutable audit-log entity or `Report` resolution fields are enough.
- Whether pickup location lives on `Loan` (proposed) or in a separate table with stricter access.
- How to enforce no overlapping approved loans at the database level (see §7).
- Whether notifications (US-4 open requests, US-6 reminders, US-8 moderation outcomes) need stored records, for example for in-app delivery or read state. No notification entity is in the confirmed entity list, so adding one needs team agreement. This depends on D16.

## 5. Authentication

Auth.js with Google is confirmed. The approach below is proposed.

- Auth.js with the Google provider. Sessions are resolved on the server.
- **Defense in depth:**
  1. `proxy.ts` can do an **optimistic** redirect to sign-in for unauthenticated users. It's only a UX shortcut, **never** the authorization check.
  2. Every Server Component that reads protected data, every Server Action, and every route handler calls `requireUser()` (or equivalent) itself. Server Actions are publicly reachable POST endpoints, so each one authenticates on its own.
- With `cacheComponents: true`, session reads are dynamic and must sit inside `<Suspense>`. Read `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` before implementing. **Never** cache per-user or permission-scoped data under a shared cache key.
- 403 for non-admins (US-1): Next's `forbidden()` is **experimental** and requires `experimental.authInterrupts` in `next.config.ts` (see `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/forbidden.md`). ⚠ Needs team decision: enable it, or render a custom 403 another way. Changing `next.config.ts` needs human approval.

## 6. Authorization and community isolation

**Principle:** derive access from the authenticated user's memberships on the server. **Never trust client-supplied IDs** (`communityId`, `userId`, `lenderId`, `role`) for authorization.

### Guards (proposed)

| Guard | Checks | Used by |
| --- | --- | --- |
| `requireUser()` | Valid session | Everything protected |
| `requireMember(user, communityId)` | Membership exists with `status = ACTIVE` | Community pages, listings, search, open requests |
| `requireAdmin(user, communityId)` | Active membership with `role = ADMIN` | Moderation queue, membership management |
| `requireItemOwner(user, itemId)` | `item.ownerId = user.id` (and owner still an active member) | Edit item, photos, blocked dates, approve/decline |
| `requireLoanParticipant(user, loanId)` | `user.id ∈ {loan.borrowerId, loan.lenderId}` | Loan detail, chat, pickup map, ratings |

### Rules

- **Scope in the query.** Data access functions filter by the user's active community IDs, for example `where: { id, community: { memberships: { some: { userId, status: "ACTIVE" } } } }`. They never fetch by ID first and check later.
- **Not found vs. forbidden** *(proposed)*. For resources in a community the user can't access, respond as **not found**, so the existence of other communities' data isn't revealed. Use **403** for admin pages where the user is a member but not an admin (US-1).
- **Derived fields are set on the server.** `ownerId`, `borrowerId`, `lenderId`, `communityId`, `raterId`, and `senderId` come from the session and the database, never from form input.
- **AI never grants access.** Claude only sees data the user is already authorized to see, and its output is filtered back to that set.

## 7. Availability and booking rules

Confirmed: blocked dates and approved loans show as unavailable, overlapping approved loans are rejected, and users can't borrow their own items. The date model and enforcement details below are proposed.

- **Dates are calendar dates, inclusive on both ends** (proposed. ⚠ confirm time-zone handling).
- Two ranges overlap when `a.start ≤ b.end && b.start ≤ a.end`. Put this in one pure, well-tested function in `src/server/domain/`.
- **Unavailable dates for an item** = its `Availability` blocks ∪ its loans in status `APPROVED` or `PICKED_UP`. `REQUESTED`, `DECLINED`, `CANCELLED`, and `RETURNED` loans don't block dates.
- **On request (US-5):** reject if the range overlaps unavailable dates, if the borrower owns the item, if the item isn't `ACTIVE`, or if the borrower isn't an active member of the item's community.
- **On approval:** recheck overlap **inside a database transaction**, so two overlapping requests can't both be approved at the same time.
  - ⚠ Needs team decision (Aarushi): the concurrency strategy. Options:
    1. A PostgreSQL exclusion constraint on (`itemId`, daterange) for active statuses. Strongest guarantee, but needs a hand-written SQL migration and the `btree_gist` extension.
    2. A serializable transaction, or locking the item row, before the overlap check.
  - Either option goes through a Prisma migration with explicit human approval.

## 8. Loan lifecycle

The states and transitions are confirmed (`docs/PRD.md` US-6). The actor for each transition and the implementation below are proposed.

*(Proposed)* The state machine is a **pure function** in the domain layer. Given `(currentStatus, action, actorRole)`, it returns the next status or a typed error. Server Actions call it, then persist with a conditional update (`where: { id, status: currentStatus }`) so concurrent transitions fail safely.

| From | Action | To | Actor (proposed) | Side effects |
| --- | --- | --- | --- | --- |
| REQUESTED | approve | APPROVED | lender | Overlap recheck in a transaction. Dates are reserved. |
| REQUESTED | decline | DECLINED | lender | Nothing reserved |
| REQUESTED | cancel | CANCELLED | borrower | — |
| APPROVED | cancel | CANCELLED | borrower (lender ⚠) | Dates freed |
| APPROVED | confirmPickup | PICKED_UP | lender | — |
| PICKED_UP | confirmReturn | RETURNED | lender | Ratings unlocked. Chat becomes read-only. |

- Terminal states: `RETURNED`, `DECLINED`, `CANCELLED`. The chat is read-only in all of them.
- **Overdue** = `PICKED_UP` and today (in the community time zone) is after `endDate`. It's computed, not stored.
- **Due-date reminders** are confirmed. ⚠ The scheduling mechanism (D9) and delivery channel (D16) need team decision. No scheduler or email provider has been chosen.

## 9. AI features

All Anthropic calls happen in `src/server/ai/` (server-only). `ANTHROPIC_API_KEY` is read only on the server and never uses a `NEXT_PUBLIC_` prefix. Every model response is parsed with a Zod schema, and malformed, refused, or timed-out responses fall back gracefully. Model IDs and API shapes come from **current SDK docs**, not memory.

### 9.1 Photo-to-listing (US-2 · Owner: Aarushi)

Confirmed: JPEG/PNG under 5 MB, invalid uploads rejected without calling Claude, suggestions (title, category, condition, description) within **10 seconds**, editable by the user, and prohibited items flagged for admin review. The flow and output schema below are proposed.

```
upload → server validation (JPEG/PNG magic bytes, < 5 MB, decodable)
       ├─ invalid → reject, no Claude call, no Cloudinary upload
       └─ valid → Claude vision (≤ 10 s timeout)
                  → Zod: { title, category ∈ enum, condition ∈ enum, description, altText, safety: { prohibited: boolean, reason? } }
                  → prefill editable form
                  → on save: Cloudinary upload + Item (status ACTIVE, or PENDING_REVIEW if flagged) + Report(source=AI) when flagged
```

- Server Actions cap request bodies at **1 MB by default** (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`). A 5 MB upload needs either `serverActions.bodySizeLimit` raised in `next.config.ts` or a route handler. ⚠ Needs team decision, and the config change needs human approval.
- ⚠ Needs team decision: whether the image goes to Cloudinary before the Claude call (and Claude gets a URL) or after (Claude gets base64). Either way, validation happens first.
- Text visible in the photo is untrusted input. The prompt tells Claude to treat it as content, not instructions, and safety flagging can only **add** a flag. Nothing the model says can clear one.

### 9.2 Natural-language matching (US-4): retrieval first, then ranking

Confirmed: database retrieval and availability filtering happen before Claude ranks and explains, and lenders are notified about open requests. The step details are proposed.

1. **Parse intent.** Turn the query into structured `{ keywords[], category?, startDate?, endDate? }`. This can be done with Claude, returning Zod-validated output. Dates are re-validated on the server, and an unparseable query falls back to plain keywords.
2. **Retrieve from the database** with Prisma. Filter to the user's active communities, `status = ACTIVE`, `ownerId ≠ user.id`, and keyword/category match. Limit to a bounded candidate set (for example, 20–30 items).
3. **Filter by availability** for the requested dates (§7).
4. **Rank with Claude.** Send only the candidates' non-sensitive fields (id, title, category, condition, description). Never send owner emails, locations, or chats. Claude returns `[{ itemId, rank, explanation }]`.
5. **Validate.** Zod-parse the response, **drop any `itemId` not in the candidate set**, and truncate explanations.
6. **Fallback.** If Claude fails, return step-3 results in database order without explanations.
7. **No available match → open request.** Offer to create a `BorrowRequest`. When one is created, **notify lenders in the requester's community** (confirmed requirement).
   - Recipients are taken on the server from active memberships of the request's community. *(Proposed)* Recipients are all active members except the requester.
   - The notification includes only the request's description and dates and a link that requires sign-in and membership. It never includes the requester's email or any location.
   - The delivery method is undecided (D16).

Claude ranks and explains. It never decides what the user is allowed to see.

### 9.3 Listing safety (US-2 / US-8)

Claude **flags** prohibited or unsafe items for admin review (confirmed). *(Proposed)* Flagging creates a `Report` with `source = AI` and sets the item to `PENDING_REVIEW`. **Only an admin** can approve or remove. Claude never auto-removes or auto-approves.

### 9.4 Borrow Match agent (optional stretch)

A conversational assistant built on the **Claude Agent SDK** (⚠ verify the current SDK API before building). It exposes three tools, each running as server code **with the signed-in user's identity and guards**:

| Tool | Does | Must not |
| --- | --- | --- |
| `search_items` | Runs the §9.2 retrieval for the current user's communities | Return items outside the user's communities |
| `check_availability` | Checks a specific item and date range against §7 | Reserve anything |
| `draft_request` | Builds a **draft** loan request (item, dates, message) and returns it to the UI | Create a `Loan` |

- **The agent never submits a loan.** Submission happens only when the user clicks a confirm button in the UI, which calls the normal loan-request Server Action with all of its validation and authorization.
- Tool inputs from the model are Zod-validated. Tool outputs passed back to the model contain only data the user can already see.
- User messages and listing text are possible prompt injection. Tools can't elevate privileges because they run with the user's guards no matter what the model asks for.

## 10. Images (Cloudinary · Owner: Aarushi)

Cloudinary is confirmed. The handling below is proposed.

- Upload only after server-side validation (type by magic bytes, size < 5 MB).
- Store `publicId` and derived URLs on `ItemPhoto`. Serve transformed sizes through Cloudinary URLs.
- ⚠ Needs team decision: server-side upload (proposed, simplest to validate) or signed direct uploads through a route handler. Direct uploads need Cloudinary-side restrictions (format, size) plus server verification of the result.
- Strip EXIF metadata (it may contain GPS location). ⚠ Confirm the Cloudinary setting.
- Cloudinary secrets are server-only.

## 11. Chat (US-9)

Confirmed: participant-only access, 1–1,000 character messages, read-only chats for closed loans, unread counts, and delivery within five seconds. The implementation below is proposed.

- Messages are created by a Server Action guarded by `requireLoanParticipant`, which rejects posts when the loan is terminal and validates 1–1,000 characters with Zod after trimming.
- The five-second delivery requirement: ⚠ needs team decision. Polling a guarded route handler every few seconds needs no new infrastructure. A push or realtime service would be a new technology and needs team agreement.
- Unread count = messages from the other participant newer than the viewer's `lastReadAt`.
- Message bodies render as plain text.

## 12. Decisions requiring team confirmation

| # | Decision | Options / proposal | Owner |
| --- | --- | --- | --- |
| D1 | PostgreSQL hosting provider | Undecided | Team |
| D2 | Final Prisma schema (§4) | Proposal above | Aarushi (database/Prisma coordination) |
| D3 | Overlap concurrency strategy | Exclusion constraint vs. transaction locking | Aarushi + team |
| D4 | Community joining and multi-community membership | Invite code / approval / both | Team |
| D5 | 403 mechanism | `forbidden()` (experimental, needs config) vs. custom | Team |
| D6 | Upload path and 5 MB body limit | Raise `bodySizeLimit` vs. route handler. Cloudinary before or after Claude | Aarushi (US-2, Cloudinary) + team |
| D7 | Flagged-listing visibility and safety-check failure mode | Hidden until review (proposed). Fail open or closed | Team |
| D8 | Chat delivery for ≤ 5 s | Polling (proposed) vs. realtime service | Team |
| D9 | Reminder scheduling and channel | Undecided | Team |
| D10 | Ratings direction, scale, trust score formula | Borrower → lender, 1–5, mean (proposed) | Team |
| D11 | Map provider for US-10 | Undecided | Team |
| D12 | shadcn/ui adoption | Undecided | Team |
| D13 | Date and time-zone model | Calendar dates in community time zone (proposed) | Team |
| D14 | E2E authentication strategy | See `docs/testing.md` §5 | Team (CI/CD: Pranav) |
| D15 | Module layout (§3) | Proposal above | Team |
| D16 | Notification delivery (US-4 open requests, US-6 reminders, US-8 moderation outcomes) | In-app, email, or both. Undecided. May need a stored entity (§4) | Team |
| D17 | Owners for Sprint 2–3 stories and the Borrow Match agent | Not assigned | Team |

When a decision is made, update this table and the relevant section rather than leaving the proposal text in place.
