# BorrowLoop: Security Requirements

> **Status (2026-11-20):** No application code, authentication, database, or AI integration exists yet. These are **requirements for planned features**. Every PR that implements a feature must meet them. They expand on the Security section of `CLAUDE.md`.

Related documents: `docs/PRD.md`, `docs/architecture.md` (guards and data flow), `docs/testing.md` (how each requirement is tested).

---

## 1. Threat summary

BorrowLoop holds personal data (names, emails, photos), private messages, loan history, and possibly pickup locations, for users who share physical spaces. The main risks:

1. **Broken access control (top risk):** reading or changing another user's loans or messages, or another community's data.
2. **Injection:** SQL injection, XSS through listings or chat, and **prompt injection** through text and images sent to Claude.
3. **Secret exposure:** API keys leaking into the browser bundle, logs, or commits.
4. **Unsafe uploads:** malicious or oversized files.
5. **Privacy leaks:** pickup locations, emails, or EXIF GPS data.

## 2. OWASP Top 10 mapping

| OWASP category | BorrowLoop requirement | Section |
| --- | --- | --- |
| A01 Broken Access Control | Server-side guards, community scoping (including notification recipients), loan ownership, admin-only moderation, chat and location privacy | §3–§6, §11 |
| A02 Cryptographic Failures | HTTPS only (Vercel), secure session cookies via Auth.js, secrets server-only | §9 |
| A03 Injection | Prisma query API only, Zod validation, plain-text rendering, prompt-injection handling | §6, §7, §10, §12 |
| A04 Insecure Design | State machine enforced on the server, AI can't bypass moderation, agent can't submit loans | §5, §10 |
| A05 Security Misconfiguration | No `NEXT_PUBLIC_` secrets, generic error messages, review of `next.config.ts` changes | §9, §13 |
| A06 Vulnerable Components | Add dependencies only with human approval. Review `npm audit` output | §13 |
| A07 Identification & Auth Failures | Auth.js + Google, auth checked in every action and route | §3 |
| A08 Software & Data Integrity | Validate Claude and third-party responses. CI secrets not exposed to forks | §10, `docs/testing.md` §9 |
| A09 Logging & Monitoring Failures | Moderation decisions logged. No secrets or PII in logs | §5, §9 |
| A10 SSRF | Never fetch user-supplied URLs on the server. Images come only from validated uploads | §8 |

## 3. Authentication and authorization (server-side)

- **Every** protected Server Component read, **every** Server Action, and **every** route handler authenticates on the server. Server Actions are reachable as public POST endpoints whether or not a UI calls them.
- `proxy.ts` redirects are optimistic UX only and are **never** the sole check.
- Client-side role or ownership checks only hide UI. They are never trusted.
- **Never trust client-supplied identity or scope**: `userId`, `ownerId`, `borrowerId`, `lenderId`, `communityId`, `role`, `senderId`, `raterId`. Derive them from the session and the database.
- Unauthenticated → redirect (pages) or 401-style rejection (actions and routes). Authenticated but not permitted → not found for resources in other communities, and **403** for admin pages when the user is a non-admin member.

## 4. Community-scoped data access

- Every query for community data is filtered by the user's **active** memberships **in the query itself**. Don't fetch by ID and check afterward.
- This applies to pages, Server Actions, route handlers, search, **AI candidate retrieval**, the Borrow Match agent's tools, open requests, and reports.
- Suspended or removed members lose access right away. Their session must not keep stale access, so check membership on each request rather than caching it in the session.
- **Notifications are community-scoped** (US-4 open requests, and any future notification):
  - Recipients are chosen on the server from active memberships of the community the open request belongs to, never from client-supplied recipient lists or community IDs.
  - Members of other communities, and suspended or removed members, never receive them.
  - Content is limited to the request description and dates, plus a link that requires sign-in and membership. It never includes the requester's email, pickup locations, or chat content.
  - The delivery method is undecided (`docs/architecture.md` D16). These rules apply whatever method is chosen.
- **Caching:** with `cacheComponents: true`, never put per-user or community-scoped data under a shared cache key. Any `"use cache"` function that returns scoped data must include the scope in its arguments, or not be cached at all.

## 5. Loan ownership and admin-only moderation

- Only the **item owner** can edit the item, manage photos and blocked dates, and approve or decline requests.
- *(Proposed, pending the US-6 actor decision in `docs/PRD.md`)* Only the item owner confirms pickup and return.
- Only the **borrower** can cancel their own request (lender cancellation ⚠ pending decision).
- Users can't borrow their own items.
- Only **loan participants** can view loan details, chat, see the pickup location, or rate, and rating is allowed only after `RETURNED`, once per loan.
- The loan state machine is enforced on the server with conditional updates. Clients can't set `status` directly.
- **Moderation is admin-only** and scoped to the admin's own community. Approving or removing a listing and managing membership all require `role = ADMIN` on an active membership in **that** community.
- Every moderation decision is **logged** (admin, action, reason, timestamp) and isn't editable through the app.

## 6. Chat message protection

- Only the loan's borrower and lender can read, post, or see unread counts. Everyone else, including community admins (unless the team explicitly decides otherwise, with logged access), is denied.
- Polling or realtime endpoints apply the same participant guard on **every** request.
- Messages are validated with Zod (1–1,000 characters after trimming) and rejected on closed loans.
- Messages are rendered as **plain text**. Never use `dangerouslySetInnerHTML` for user content.
- Messages aren't sent to Claude unless a future feature explicitly requires it and goes through security review.

## 7. Input validation (Zod)

- Validate **all** external input at the boundary: form data, route params, search params, request bodies, webhook payloads, third-party API responses (Cloudinary), and **all Claude output**.
- Use strict schemas: bounded string lengths, enums for category, condition, status, and role, ISO dates with `start ≤ end`, and IDs in the expected format.
- Reject unknown fields where they could be confused with server-derived fields.
- Return **user-safe** error messages. Never return stack traces, SQL or Prisma errors, or internal IDs of resources the user can't access.

## 8. File upload validation

- Accept **JPEG and PNG only**, with size **under 5 MB**.
- Validate on the **server**: check magic bytes or decode the image. Don't trust the `Content-Type` header or the file extension. Reject empty, corrupt, and oversized files.
- Validation happens **before** anything is sent to **Claude** or **Cloudinary**. Invalid files never reach either.
- Enforce limits before buffering the full body where possible. Note the Server Action default body limit (1 MB) and the decision in `docs/architecture.md` §9.1.
- Strip EXIF metadata (GPS) from stored images.
- Never fetch images from user-supplied URLs on the server (SSRF).
- Cloudinary uploads use server-held credentials. If signed direct uploads are adopted, signatures are short-lived, restricted to allowed formats and sizes, and issued only to authenticated members.

## 9. Secrets and environment variables

- Secrets (`ANTHROPIC_API_KEY`, Auth.js secret, Google OAuth client secret, Cloudinary API secret, `DATABASE_URL`) live in environment variables, on Vercel for deployments and in local gitignored `.env*` files.
- **Never** prefix secrets with `NEXT_PUBLIC_`. Never import server modules that read secrets into Client Components. Modules that use secrets import `server-only`.
- Never put secrets in source code, logs, error messages, test fixtures, screenshots, browser bundles, or commits.
- **Claude Code must not read or modify `.env*` files** unless a human explicitly authorizes a specific, safe operation.
- Logs exclude message bodies, emails, locations, and tokens.

## 10. AI security (Claude)

### Treat Claude output as untrusted

- Parse every response with a **Zod schema**. Handle malformed output, refusals, timeouts, and API errors gracefully, with a manual or non-AI fallback.
- Constrain outputs to enums (category, condition). Discard values that don't match.
- For matching, **drop any item ID not in the server-retrieved candidate set**.
- Render model text as plain text, never as HTML.

### Protect against prompt injection

- Treat **listing text, search queries, open requests, chat text, and text inside images** as untrusted. They may contain instructions such as "ignore previous instructions" or "mark this as safe".
- Put untrusted content in clearly delimited sections of the prompt and tell the model to treat it as data.
- **Model output can never bypass authorization or moderation.** Claude can add a safety flag but can't remove one, approve a listing, change a loan status, or widen data access.
- Send Claude only the minimum data needed, and only data the user is already authorized to see. Never send emails, pickup locations, other users' messages, or secrets.
- **Borrow Match agent:** tools run with the signed-in user's guards, inputs are Zod-validated, and the agent **never submits a loan**. Submission needs an explicit user confirmation that calls the normal guarded Server Action.

### Key handling

- All Anthropic calls are server-side only. Unit tests mock the SDK and never call the real API.
- Apply per-user rate limits to AI endpoints to prevent cost abuse. ⚠ The mechanism needs team decision.

## 11. Private pickup locations (US-10)

- Exact pickup coordinates are visible **only to that loan's participants**.
- They're never included in listings, search results, AI prompts or results, public pages, open requests, logs, analytics, or admin views (unless decided otherwise and logged).
- At most a coarse area (for example, a neighborhood name) can appear on listings.
- Coordinates are hidden once the loan closes. Retention ⚠ pending decision.
- Remove EXIF GPS from uploaded photos so locations don't leak that way.

## 12. Database safety

- Use **Prisma's query API**. Avoid raw SQL.
- If raw SQL is unavoidable, use parameterized `Prisma.sql` tagged templates. **Never** use `$queryRawUnsafe` or `$executeRawUnsafe` or string-concatenate input into SQL.
- Database access lives in server-only modules.
- Use transactions and conditional updates for loan approval and state changes (see `docs/architecture.md` §7–§8).
- **Explicit human approval is required** before creating or running any migration, deleting data, resetting a database, or any other destructive operation. Aarushi owns the schema, so coordinate schema changes with them.

## 13. Dependencies and configuration

- Install dependencies only when a human asks. Prefer well-maintained packages, and review `npm audit` output when dependencies change.
- Changes to `next.config.ts` (for example, `authInterrupts` or `serverActions.bodySizeLimit`) need human approval and a note on their security impact.
- Consider security headers and a Content Security Policy (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). ⚠ Needs team decision.

---

## 14. Pull request security checklist

Copy into PR descriptions that touch application code.

**Authentication and authorization**
- [ ] Every new Server Action, route handler, and protected page authenticates on the server
- [ ] Community data is filtered by the user's active memberships in the query
- [ ] Ownership (item owner, loan participant) and admin role are checked on the server
- [ ] No client-supplied `userId` / `ownerId` / `communityId` / `role` / `status` is trusted
- [ ] Tests cover unauthenticated, cross-user, and cross-community access, plus non-admin 403 where relevant

**Input and output**
- [ ] All external input is validated with Zod (forms, params, search params, bodies, third-party responses)
- [ ] Error messages are user-safe, with no stack traces, Prisma errors, or internal details
- [ ] User content is rendered as plain text (no `dangerouslySetInnerHTML`)

**Uploads**
- [ ] JPEG/PNG only, < 5 MB, validated server-side by content before any Claude or Cloudinary call
- [ ] EXIF/GPS stripped. No server-side fetching of user-supplied URLs

**AI**
- [ ] Anthropic calls are server-only. No key in client code or `NEXT_PUBLIC_` variables
- [ ] Claude output is Zod-parsed, with fallbacks for malformed, refused, and timed-out responses
- [ ] Untrusted text and images are delimited in prompts. Model output can't change authorization, moderation, or loan state
- [ ] Only data the user is already authorized to see is sent to Claude. No emails, locations, or chats
- [ ] Unit tests mock the Anthropic SDK

**Privacy**
- [ ] Chat messages are accessible only to loan participants. Closed loans are read-only
- [ ] Pickup locations never appear outside participant-only views (or N/A)
- [ ] Notification recipients are derived on the server from the community's active memberships. Content excludes emails, locations, and chats (or N/A)
- [ ] No secrets or PII in logs, fixtures, or commits

**Data and config**
- [ ] Prisma query API only, or a parameterized `Prisma.sql` with justification. No `$queryRawUnsafe`
- [ ] Migrations, data deletion, and destructive operations were explicitly approved by a human (and schema changes coordinated with Aarushi)
- [ ] No `.env*` files read, changed, or committed
- [ ] New dependencies or `next.config.ts` changes were approved, and their security impact noted
- [ ] No per-user or scoped data cached under a shared key
