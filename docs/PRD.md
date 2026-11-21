# BorrowLoop: Product Requirements Document

> **Status (2026-11-20):** Nothing in this document is implemented yet. The repository is still an unmodified `create-next-app` scaffold (see `CLAUDE.md`). This PRD describes the **planned** product. Each user story becomes one or more GitHub Issues, and an issue's acceptance criteria are the source of truth for TDD tests (see `docs/testing.md`).
>
> Items marked **⚠ Needs team decision** are open questions. Don't treat them as settled until the team records a decision.
>
> Items marked **(Proposed)** are design details added while writing this PRD. They aren't part of the confirmed Project 3 proposal. They need team agreement before they count as requirements.

Related documents: `docs/architecture.md`, `docs/testing.md`, `docs/security.md`.

---

## 1. Product summary

BorrowLoop is a **free community lending platform** for university students and neighbors. Members lend each other items such as tools, textbooks, cameras, and small appliances for short periods so they don't have to buy them.

### Goals

- Make it easy to lend and borrow everyday items inside a trusted community.
- Use AI (Claude) to cut down on friction: creating listings from a photo and finding items from a plain-language description.
- Keep communities safe through moderation, ratings, and strict privacy for messages and pickup locations.

### Non-goals (v1)

- **No payments, deposits, rental fees, or insurance.** Loans are free.
- No restriction to university email domains. Anyone with a Google account can sign in. Access to a community's data is controlled by community membership.
- *(Proposed)* No delivery or shipping. Hand-offs happen in person.
- *(Proposed)* No native mobile apps. The web app should be responsive.

---

## 2. Roles

One account can act as **both lender and borrower**. The role depends on the action: you're the lender for loans of your items and the borrower for loans you request. **Community admin** is a per-community role stored on the membership.

| Role | Responsibilities |
| --- | --- |
| **Lender** | Lists items, manages availability (blocks dates), approves or declines loan requests, confirms hand-off (pickup) and return. |
| **Borrower** | Searches for items, requests loans, picks up and returns items, rates lenders after return. |
| **Community admin** | Moderates listings (including AI-flagged ones), handles user reports, manages community membership. |

---

## 3. Glossary

| Term | Meaning |
| --- | --- |
| Community | A group of members (for example, a dorm, campus, or neighborhood) whose listings are visible only to its members. |
| Listing / Item | Something a lender offers to lend. |
| Blocked dates | Date ranges a lender marks as unavailable. |
| Loan | A request by a borrower to borrow a specific item for a specific date range, and its lifecycle. |
| Open request | A "wanted" post a borrower creates when search finds no match. |
| Trust score | An aggregate of a user's ratings, shown once they have at least three ratings. |
| Flagged listing | A listing that Claude or a member has marked for admin review. |

---

## 4. Release plan

### Required vs. stretch

- **Required (v1):** US-1 through US-9.
- **Optional:** US-10 (private pickup map) in Sprint 3, and the **Borrow Match agent** (see `docs/architecture.md` §9.4), which isn't assigned to a sprint.

### Sprint schedule (confirmed)

| Sprint | Dates | Required stories | Optional |
| --- | --- | --- | --- |
| Sprint 1 | Nov 19–30 | US-1, US-2, US-3 | — |
| Sprint 2 | Dec 1–7 | US-4, US-5, US-6 | — |
| Sprint 3 | Dec 8–15 | US-7, US-8, US-9 | US-10 |
| Unscheduled | — | — | Borrow Match agent |

### Ownership (confirmed for Sprint 1)

| Owner | Responsibilities |
| --- | --- |
| Pranav | US-1, US-3, CI/CD, Claude Code setup |
| Aarushi | US-2, database and Prisma schema coordination, Cloudinary, task board |

Ownership for Sprint 2 and Sprint 3 hasn't been assigned yet. ⚠ Needs team decision.

---

## 5. User stories and acceptance criteria

Conventions:
- "Member" means a user with an **active membership** in the relevant community.
- Every acceptance criterion that involves access control must be enforced **on the server** (see `docs/security.md`).

### Sprint 1 (Nov 19–30): Foundation and listings

#### US-1: Google sign-in and community membership (Required · Owner: Pranav)

> As a student or neighbor, I want to sign in with Google and join my community so that I see only listings from people I share a community with.

**Acceptance criteria**
1. Users sign in with Google (Auth.js + Google OAuth). No other sign-in method in v1.
2. Unauthenticated users who request any protected page are **redirected to sign-in**. Unauthenticated calls to protected Server Actions or route handlers are rejected.
3. Users see **only listings from communities where they are active members**. Listings from other communities never show up in pages, search results, AI results, or API responses. *(Proposed)* Requests for them by ID behave as not found.
4. Non-admin users who request community admin pages receive **403 Forbidden**. This is checked on the server.
5. Registration is **not** restricted to university email domains.

**⚠ Needs team decision**
- How users join a community: invite code or link, admin approval of join requests, or both.
- Whether a user can belong to **multiple communities** in v1 and, if so, how they switch between them.
- How the first admin of a community is created.

#### US-2: AI photo-to-listing (Required · Owner: Aarushi)

> As a lender, I want to upload a photo of my item and get suggested listing details so that I can create a listing quickly.

**Acceptance criteria**
1. Accept **JPEG and PNG only**, with file size **under 5 MB**. The server validates both type and size. *(Proposed)* Type is checked by inspecting the file content, not only the declared MIME type or extension.
2. Invalid uploads (wrong type, too large, empty, or corrupt) are **rejected with a clear message and without calling Claude** or uploading to Cloudinary.
3. For a valid image, Claude suggests **title, category, condition, and description** within **10 seconds**. *(Proposed)* If Claude doesn't respond in time or returns malformed output, the user sees a friendly message and can fill in the form by hand.
4. All suggestions are **editable** before saving. Nothing is published without the lender saving it.
5. If Claude identifies the item as **prohibited or unsafe**, the listing is **flagged for admin review** (see US-8). Claude only flags. It never removes or auto-approves listings.
6. *(Proposed)* Category and condition suggestions must be values from the app's fixed lists. Anything else is discarded.

**⚠ Needs team decision**
- The fixed lists of categories and conditions.
- The prohibited-items policy (for example, weapons, alcohol, prescription drugs, hazardous materials).
- Whether a flagged listing is hidden until reviewed. The proposed default is yes: hidden from other members until an admin approves it.
- Behavior when the safety check itself fails or times out. Options are to hold for review (fail closed) or publish and let members report it.
- Maximum number of photos per listing.

#### US-3: Availability (Required · Owner: Pranav)

> As a lender, I want to block dates when my item isn't available so that borrowers only request dates I can actually lend it.

**Acceptance criteria**
1. Lenders can add and remove **blocked date ranges** on their own items only.
2. Borrowers see blocked dates **and** dates reserved by approved loans as **unavailable**.
3. Borrowers can't submit a loan request that overlaps unavailable dates. This is enforced on the server, not only in the date picker.
4. Start date must be on or before end date. *(Proposed)* Dates in the past can't be newly blocked or requested.

**⚠ Needs team decision**
- Date granularity: whole days (proposed) or time slots.
- Time zone rules. The proposal is to store calendar dates (no time), interpreted in the community's time zone.
- Whether a lender can block dates that overlap an already approved loan.

### Sprint 2 (Dec 1–7): Borrowing

Owners for Sprint 2 stories: ⚠ not yet assigned.

#### US-4: Natural-language search (Required)

> As a borrower, I want to describe what I need in plain language, such as "a drill for this Saturday", so that I can find available items without browsing categories.

**Acceptance criteria**
1. Borrowers enter a plain-language need, optionally including dates.
2. The server first **retrieves candidates from the database**, limited to the borrower's communities, active listings, items not owned by the borrower, and items available for the requested dates. **Claude then ranks** those candidates and gives a short **explanation for each match**. See `docs/architecture.md` §9.2.
3. Results only ever include items from the retrieved candidate set. Claude can't introduce items, and items the borrower can't access never appear.
4. When no available item matches, the borrower can create an **open request** describing what they need. Members of the same community can see it.
5. When an open request is created, **lenders in the borrower's community are notified**. Notifications never go to anyone outside that community.
6. *(Proposed)* If Claude is unavailable, search falls back to non-AI keyword results without explanations.

**⚠ Needs team decision**
- How notifications are delivered (for example, in-app or email). This is undecided.
- Who counts as a "community lender" for notifications. *(Proposed)* Every active member except the requester.
- When open requests expire.

#### US-5: Loan requests (Required)

> As a borrower, I want to request an item for specific dates, and as a lender I want to approve or decline requests.

**Acceptance criteria**
1. A borrower can request an item for a date range from an active listing in their community.
2. The server **rejects requests that overlap an approved loan** or blocked dates for that item.
3. **Users cannot borrow their own items.**
4. **Approval reserves the dates.** Approval is rejected if another loan was approved for overlapping dates in the meantime. *(Proposed)* The check must be safe against concurrent approvals.
5. **Declining keeps the dates available.** A declined request reserves nothing.
6. Only the item's lender can approve or decline.

**⚠ Needs team decision**
- Whether several pending (Requested) loans may overlap. The proposal is yes. When one is approved, the others that overlap are automatically declined or left for the lender to decline.
- Maximum loan length and how far ahead loans can be booked.

#### US-6: Loan lifecycle (Required)

> As a lender and borrower, I want clear loan states so we both know where a loan stands.

**Acceptance criteria**
1. The server enforces this state machine. Any other transition is rejected.

   ```
   Requested ──approve──▶ Approved ──pickup──▶ PickedUp ──return──▶ Returned
       │                     │
       ├──decline──▶ Declined│
       └──cancel───▶ Cancelled ◀──cancel──┘
   ```

   The states and transitions above are confirmed. The "Who" column is **(Proposed)**. It's inferred from the role descriptions and hasn't been confirmed.

   | From | To | Who (Proposed) |
   | --- | --- | --- |
   | Requested | Approved | Lender |
   | Requested | Declined | Lender |
   | Requested | Cancelled | Borrower |
   | Approved | Cancelled | Borrower (lender: ⚠ needs team decision) |
   | Approved | PickedUp | Lender confirms hand-off |
   | PickedUp | Returned | Lender confirms return |

2. `Returned`, `Declined`, and `Cancelled` are **terminal**.
3. **Due-date reminders** go to the borrower before the end date.
4. A loan is **overdue** when it's `PickedUp` and the current date is past its end date. Both participants see an **overdue indicator**. *(Proposed)* Overdue is computed, not stored as a separate state.
5. *(Proposed)* Cancelling an approved loan frees its reserved dates.

**⚠ Needs team decision**
- How reminders are delivered (in-app only, or email too) and how they're scheduled.
- Reminder timing (for example, 24 hours before the due date).
- Whether the borrower must also confirm pickup and return (two-party confirmation).

### Sprint 3 (Dec 8–15): Trust and communication

Owners for Sprint 3 stories: ⚠ not yet assigned. US-10 is optional in this sprint.

#### US-7: Ratings (Required)

> As a borrower, I want to rate lenders after a loan so the community can build trust.

**Acceptance criteria**
1. Only **participants of a loan** can rate, and only **after the loan is `Returned`**.
2. Each participant can rate **once per loan**. Duplicates are rejected on the server and by a database uniqueness constraint.
3. A user's **trust score is shown only once they have at least three ratings**. Below that, the UI shows something like "New member" or "Not enough ratings yet."
4. *(Proposed)* Ratings use a fixed scale with an optional short comment of bounded length.

**⚠ Needs team decision**
- Whether ratings go both ways (lenders also rate borrowers) or only borrower → lender as stated in the roles.
- Rating scale (proposed 1–5) and how the trust score is calculated (proposed: mean rating).
- Whether ratings can be edited or deleted, and any rating window (for example, within 14 days of return).

#### US-8: Moderation (Required)

> As a community admin, I want to review flagged listings so that unsafe or prohibited items are handled.

**Acceptance criteria**
1. Admins see a queue of **flagged listings** for their community only: AI flags (US-2) and member reports.
2. Admins can **approve** (publish or unflag) or **remove** a flagged listing.
3. The **lender is notified** of the decision.
4. **Every decision is logged.** *(Proposed)* Each log entry records the admin, decision, reason, and timestamp, and logs can't be edited through the app.
5. Only admins of that community can see the queue or act on it. Everyone else gets 403.
6. Admins handle **reports**. *(Proposed)* Members can report a listing or a user, and reports go to the same admin queue.

**⚠ Needs team decision**
- Whether removal is a soft delete (proposed) or a hard delete.
- Whether lenders can appeal.
- Membership management actions (remove or suspend a member) and what happens to their active loans.

#### US-9: Loan chat (Required)

> As a loan participant, I want to message the other person about pickup and return.

**Acceptance criteria**
1. Each loan has one conversation. **Only the loan's borrower and lender** can read or post. Everyone else, including other community members, gets a not-found or forbidden response.
2. New messages **appear for the other participant within five seconds** without a manual reload.
3. Messages must be **1–1,000 characters** after trimming. Empty or longer messages are rejected on the server.
4. Once the loan is closed (`Returned`, `Declined`, or `Cancelled`), the chat is **read-only**.
5. Users see **unread message counts**.
6. *(Proposed)* Messages are rendered as plain text, never as HTML.

**⚠ Needs team decision**
- Delivery mechanism for the five-second requirement: polling (needs no new infrastructure) or a push mechanism. See `docs/architecture.md` §11.
- Whether admins can read chats when handling a dispute. The proposal is no in v1. If yes, access must be explicit and logged.

### Sprint 3 (Dec 8–15): Optional

#### US-10: Private pickup map (Optional)

> As a loan participant, I want to see the agreed pickup spot on a map.

**Acceptance criteria**
1. A pickup pin can be set for an **approved** loan.
2. The pin is **visible only to that loan's participants**.
3. **Exact locations are never public.** They never appear on listings, search results, AI prompts, public pages, logs, or other members' views. *(Proposed)* Listings may show at most a coarse area, such as a neighborhood name.
4. *(Proposed)* The pin is hidden once the loan is closed. Data retention ⚠ needs team decision.

**⚠ Needs team decision:** map provider (none chosen, and none should be added without team agreement), and who can set or change the pin.

### Unscheduled optional stretch

#### Borrow Match agent (Optional, no sprint assigned)

An optional conversational assistant built on the Claude Agent SDK. It helps a borrower find an item and **drafts** a loan request, but **never submits a loan without explicit user confirmation**. See `docs/architecture.md` §9.4.

---

## 6. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Security | OWASP Top 10, with access control as the top risk. See `docs/security.md`. |
| Privacy | Community isolation. Chats and pickup locations are visible only to loan participants. |
| AI latency | Photo-to-listing suggestions within 10 s, with a manual fallback. |
| Chat latency | Messages visible within 5 s. |
| Quality | At least 70% test coverage once tooling exists. TDD for designated stories. See `docs/testing.md`. |
| Accessibility *(Proposed)* | Keyboard-usable forms and date pickers, with alt text for item photos (Claude can suggest it, and the lender can edit it). |
| Responsiveness *(Proposed)* | Usable on mobile browsers. |
