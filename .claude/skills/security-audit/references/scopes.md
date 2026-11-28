# Scope checklists and requirement mappings

Load only the sections for the selected scope, with Read, in every
invocation (SKILL.md H12). Requirement text lives in the project docs. This
file cites section numbers and doesn't copy the rules.
- In a real audit, the cited doc sections are read in Step 3, only after the
  main gate and path validation show the doc is eligible.
- In a dry run, they're listed by section number and marked deferred.

**Phases.** Every checklist item below is an **Evidence** check (Step 3,
real audits only, on allowlisted files) unless it's marked **(Discover)**.
Discover items use only the discovery.md §4.1 forms and may run in dry runs.
A dry run lists Evidence checks as "would run in a real audit" and never
reports their results.

**OWASP edition.** `docs/security.md` §2 maps requirements to the **OWASP
Top 10 2021** category set (A01 Broken Access Control … A10 SSRF). The doc
doesn't name the edition, but the category names are the 2021 ones. Use only
these 2021 categories. Don't mix in categories from another edition.

| ID | 2021 category |
|---|---|
| A01 | Broken Access Control |
| A02 | Cryptographic Failures |
| A03 | Injection |
| A04 | Insecure Design |
| A05 | Security Misconfiguration |
| A06 | Vulnerable and Outdated Components |
| A07 | Identification and Authentication Failures |
| A08 | Software and Data Integrity Failures |
| A09 | Security Logging and Monitoring Failures |
| A10 | Server-Side Request Forgery |

## Scope map

| Mode | Sections run | Finding ID prefix |
|---|---|---|
| `full` (default) | auth, dependencies, uploads, secrets, ai, validation, database, caching, ci | per section |
| `auth` | auth | `SA-AUTH-` |
| `dependencies` | dependencies | `SA-DEP-` |
| `diff` | diff | `SA-DIFF-` |
| `uploads` | uploads | `SA-UPL-` |
| `secrets` | secrets | `SA-SEC-` |
| `ai` | ai | `SA-AI-` |
| (full only) | validation, database, caching, ci | `SA-VAL-`, `SA-DB-`, `SA-CACHE-`, `SA-CI-` |

Documentation drift uses `SA-DRIFT-`. Verified controls use `VC-`.

Each check has **one owning section**, and other sections refer to it rather
than repeating it. When a targeted scope touches another section's area,
mark it "Not examined (outside scope)". In full mode, run each section once.

Each checklist item ends with its outcome options. Use the statuses defined in
severity-rubric.md.

---

## auth: authentication, authorization, community isolation

**Requirements:** security.md §3, §4, §5; PRD US-1 criteria 1–5;
architecture §5, §6. **OWASP:** A01, A07.
**Boundary:** input-schema quality beyond identity and scope fields belongs to
validation. Query safety (raw SQL) belongs to database.

- **AUTH-1 Provider and sign-in.** The only sign-in methods are those the PRD
  allows. No email-domain restriction (US-1 AC5). The sign-in callback
  rejects other providers.
- **AUTH-2 Token and session integrity.** Session callbacks derive the user
  ID from the server-issued token. Data the client sends on an update is
  ignored. OAuth tokens aren't stored unless needed. There's no account
  linking by email alone.
- **AUTH-3 Session reading.** Session data is validated before use. Signed-out
  users are redirected (pages) or rejected (actions and routes) (US-1 AC2).
- **AUTH-4 Redirect safety.** Callback and return URLs are restricted to
  same-origin paths (protocol-relative URLs, backslashes, control
  characters). Open redirect is A01.
- **AUTH-5 Proxy.** The matcher denies by default and has no gaps for
  protected paths. Path classification resists encoding, `..`, separators and
  case tricks. The proxy is **not the only** check (§3).
- **AUTH-6 Entry-point matrix.** For **every** Server Action, route handler
  and protected page or server component, record:
  - authenticates on the server itself,
  - validates identity and scope params strictly,
  - authorizes membership, role or ownership,
  - scopes the query by the session user,
  - returns a user-safe error.
  One row per entry point, with `file:line`.
- **AUTH-7 Not found vs. forbidden.** Non-members get not-found, including
  for nonexistent communities. Non-admin members get 403 on admin pages
  (US-1 AC4). Denial bodies reveal no community, user or role details.
- **AUTH-8 Client-supplied identity.** `userId`, `ownerId`, `communityId`,
  `role`, `status`, `lenderId`, `borrowerId` and similar fields are never
  trusted from input (§3).
- **AUTH-9 Fresh membership.** Membership and role are read from the database
  per request, not from the JWT or a shared cache (§4). Note how removal or
  suspension takes effect. Check recorded decisions (for example D-2) before
  calling an absent status field a finding.
- **AUTH-10 Supporting tests.** Cite the unauthenticated, cross-user,
  cross-community and 403 tests present in source (not executed). A missing
  test for a required case is a Policy deviation (testing.md §2, §10), not a
  vulnerability in itself.

**Usually manual:** a real Google OAuth flow; cookie flags in production;
behavior under concurrent membership removal.

## dependencies: vulnerable and outdated components

**Requirements:** security.md §13; testing.md §9 (CI rules); CLAUDE.md
(installing needs human approval). **OWASP:** A06, A08.
**Boundary:** CI workflow hardening belongs to ci. This section covers
packages.

**D1. Local review (no approval needed):**
- **(Discover)** Confirm `package.json` and `package-lock.json` exist, by
  name only (discovery.md §4.1).
- **(Evidence)** In `package.json`, list prod vs. dev dependencies, exact vs.
  range versions, pre-release versions (for example `-beta`), and
  install-time hooks (`postinstall`, `allowScripts`). Grep
  `package-lock.json` in content mode, that single file, rather than reading
  it whole.
- Read `package.json` and Grep `package-lock.json` only if both are on the
  safe-file allowlist (safe-evidence.md §4). Otherwise the Evidence part of
  D1 is **Blocked**.

**D2. Approval.** Apply SKILL.md H4. If declined, mark "npm audit: Skipped
(approval declined)" and report only D1.

**D3. Run `npm audit --json` exactly once, only through the
safe-evidence.md §7 filter.** Raw npm output never reaches the model.
Interpret the filtered result:

| Observed | Meaning | Action |
|---|---|---|
| `filter_rc=0`, a final `NPM_OUTPUT OK packages=0`, all counts 0 | Retrieval succeeded, no advisories | Record the counts |
| `filter_rc=0`, `NPM_OUTPUT OK packages=N` (N > 0) | **Retrieval succeeded, advisories found.** A nonzero `npm_rc` is expected here, not a failure | Analyze (D4) |
| `filter_rc=3`, `NPM_ERROR code=<CODE>` | Retrieval **failed** | Report Blocked with the code only. Don't retry with another registry or flags |
| `NPM_OUTPUT INVALID …`, a missing final line, a refused call, or any other `filter_rc` | Results **incomplete** | Report Blocked. Don't infer that there are zero advisories |

`withheld` means a value failed the filter's checks. Report it as withheld
and don't try to recover it. Advisory titles and descriptions aren't
available. Identify advisories by their GHSA URL only (SKILL.md H11).

**D4. For each advisory, fill the dependency-advisory fields** in
`templates/finding.md`:

| Field | How to establish it |
|---|---|
| Package, affected range, advisory ID (GHSA URL), **published severity** | Filter `PKG` and `ADVISORY` lines. The installed version is read from an allowlisted `package-lock.json` (single-file Grep), otherwise it's **Unknown** |
| **Direct or transitive** | The filter's `direct=` field, and its `VIA package=` chain for the path. A full dependency path that the `VIA` chain doesn't show is "not established". `npm explain` isn't used in v2 |
| **Prod or dev** | The `"dev": true` flag on the `"node_modules/<pkg>"` entry inside `package-lock.json` (single-file Grep, allowlisted only); otherwise **Unknown**. `npm ls` isn't used in v2. Never read files under the `node_modules/` directory |
| **Exposure context** | One of: *Production runtime (server)*, *Production runtime (client bundle)*, *Build/install time* (for example `postinstall`, `next build`, codegen, CI), *Development/test only*, *Unknown*. Consider framework execution (Next.js loading packages itself), build tooling, CLIs run by scripts, and `postinstall`. Prod vs. dev alone doesn't settle it |
| **Fix availability** | The filter's `fix=` field: target and version, and whether it's semver-major. Report it; never apply it |
| **Reachability** | *Reachable*: evidence that BorrowLoop or a dependency it uses at runtime invokes the vulnerable functionality with input an attacker could influence. *Not reachable*: positive evidence only, for example the vulnerable feature needs configuration or an API the project demonstrably doesn't use **and** the exposure context excludes it. *Unknown*: the default. **A missing direct import never proves a transitive dependency is unreachable** |

**D5. Classify.**
- Default status: **Dependency advisory**. Record the published severity as
  reported, and assess BorrowLoop **assessed risk** separately (rubric
  §3.2). Unknown reachability never implies Low. Use **Undetermined**, with
  the missing evidence, when the risk can't reasonably be established. Never
  assume an advisory is exploitable here.
- Promote to Potential risk only with reachability evidence. Confirmed
  requires the full Confirmed criteria.

**D6. GitHub.** Dependabot alerts and security settings are Needs manual
verification, owned by Aarushi (repository owner).

**Remediation guidance:** name the target version and whether it's
semver-major. Recommend that the team review, upgrade on a branch, and verify
in CI. Never run upgrades.

## diff: branch security review against security.md §14

**v2 status: real diff audits are blocked** (SKILL.md Step 1 item 5).
The procedure below is kept for `diff --dry-run` planning and a future
verified version. It hasn't been tested against real buckets (T8).

**Requirements:** security.md §14 (PR security checklist), plus the sections
each checklist item points to. **OWASP:** per item.
**Boundary:** only changed files and lines, relative to local `main`. Context
reads of unchanged files, to trace a changed entry point, use Read on
allowlisted working-tree files only.

Procedure: safe-evidence.md §6, followed exactly. That covers the refs, the
four buckets, name checks on old and new paths, gating each version shown,
`-U0` inspection, and Blocked outcomes. Never use `gh pr diff`, remote diffs
or Git history as a fallback.

Evaluate **each §14 checkbox** as Pass / Fail / Not applicable / Manual,
with `file:line` from the changed lines:
- Authentication and authorization (5 items)
- Input and output (3)
- Uploads (2)
- AI (5)
- Privacy (4)
- Data and config (5)

New or changed entry points also get the AUTH-6 matrix row. Fail items
become findings, classified per the rubric (a §14 failure supports a finding
but doesn't make it Confirmed on its own).

Report the base SHA, merge base and HEAD, and which buckets (committed,
staged, unstaged, untracked) were examined, empty or blocked. If there are no
changes, report "No changes relative to main", not "no findings".

## uploads: file upload pipeline

**Requirements:** security.md §8, §10; PRD US-2 criteria 1–2 (and 3–6 for
the AI handoff); architecture §9.1, §10. **OWASP:** A03, A04, A05, A10.
**Boundary:** AI prompt and output handling belongs to ai. Secret handling in
the Cloudinary module belongs to secrets.

- **UPL-1 Type.** Allowed types are decided from file content (magic bytes or
  decoding), not from the extension or declared MIME. Mismatches are
  rejected.
- **UPL-2 Size.** The limit matches the PRD (strictly under 5 MB) at the
  server boundary. Note where the framework body limit (`bodySizeLimit`) sits
  relative to it, and how far it reaches (every Server Action).
- **UPL-3 Empty and corrupt.** Empty files are rejected. On corrupt files,
  PRD US-2 AC2 ("corrupt" rejected) and security.md §8 ("magic bytes *or*
  decode") differ. If the code only checks signatures, report it as
  **Documentation drift / unresolved policy**, plus the observed behavior
  (header valid, body undecoded). Don't report it as a confirmed
  vulnerability.
- **UPL-4 Order.** Validation completes **before** any Claude or Cloudinary
  call. Trace the call order with `file:line`.
- **UPL-5 Authorization.** The upload entry point authenticates and checks
  membership before reading the file (cross-reference the AUTH-6 row).
- **UPL-6 Storage.** Credentials are server-side only, the destination folder
  is constrained, and failure handling covers orphaned uploads.
- **UPL-7 Metadata and privacy.** EXIF/GPS stripping before storage, and
  whether raw bytes with metadata go to Claude (§8, §10, §11). Cloudinary's
  actual stored-asset behavior is **Needs manual verification**.
- **UPL-8 SSRF.** No server-side fetching of URLs supplied by users.
- **UPL-9 Tests.** Cite upload tests present in source (not executed),
  including which invalid cases they cover.

## secrets: secret handling and exposure

**Requirements:** security.md §9; CLAUDE.md Security. **OWASP:** A02, A05.
**Boundary:** dependency advisories belong to dependencies.

- **SEC-1 Pattern scan (Evidence: main gate, real audits only).** Use the safe-evidence.md §2 gate results (the gate
  covers tracked and untracked, non-ignored text files; deny-rule exclusions
  apply, and `logs/**` is included **count-only**). Each hit becomes **Needs
  manual verification**: category, file and count, with "value not
  inspected". The file is Blocked. No line numbers, no redacted viewing.
  The coverage limits (safe-evidence.md §8) go under Limitations.
  Label each hit **"Unverified pattern match"** (rubric §3.1, finding.md
  §A2). Give it:
  - a conditional severity ("<Level> if genuine", based on its category and
    whether the file is tracked),
  - assessed risk Undetermined,
  - Low confidence,
  - Urgent private verification.

  A public repository alone never makes it Critical or P1.
- **SEC-2 Server-only boundary.** Every module that reads a secret
  (`process.env.*` other than `NODE_ENV`) or opens the database has an exact
  `import "server-only"` line, and no `"use client"` module imports it,
  directly or through other modules. Trace imports with Read on allowlisted
  files only. A link that goes through a file that isn't on the allowlist is
  "not established". A missing marker with no client import
  path is a **Policy deviation**, with severity assessed on the actual risk
  (rubric).
- **SEC-3 Public exposure.** No `NEXT_PUBLIC_` variable holds a secret. No
  secret-bearing module reaches a client bundle.
- **SEC-4 Errors and logs.** Messages name variables but never print their
  values. Logs contain no tokens, emails, message bodies or locations (§9).
- **SEC-5 Tracked restricted files (Discover).** Run `git ls-files` with each deny glob
  as an include pathspec (`':(glob,icase)<glob>'`), which lists names only.
  `.env.example` is tracked by design and skipped. Report each file as
  "present, not inspected (restricted)".
- **SEC-6 Settings (Discover, bootstrap).** Note the deny list's coverage
  (rule names only), from `.claude/settings.json` read after the bootstrap
  gate. Don't suggest weakening it.
- **SEC-7 Git history.** Deferred, and not part of v2. Report "Not examined
  (Git history scanning deferred)".

## ai: Anthropic integration

**Requirements:** security.md §10; architecture §9 (9.1–9.4 as built); PRD
US-2 criteria 3–6; testing.md §3. **OWASP:** A03, A04, A08.
**Boundary:** upload validation belongs to uploads.

- **AI-1 Server-only.** SDK use is confined to server-only modules. The key
  is read on the server, with no `NEXT_PUBLIC_` variant and no silent
  fallback to other credentials.
- **AI-2 Prompt structure.** Untrusted content (images, text in images,
  listing or search text) stays out of system or operator instructions and
  is labeled as data.
- **AI-3 Output handling.** Responses are parsed with Zod, enums are
  constrained, and refusal, timeout, malformed and API-error paths fall back
  without exposing details.
- **AI-4 Authority.** Model output can't grant access, clear a flag, approve
  a listing or change state. Moderation fails closed (§10).
- **AI-5 Data minimization.** Only data the user may see is sent. No emails,
  locations, chats or secrets. Note image metadata (cross-reference UPL-7).
- **AI-6 Abuse controls.** Per-user rate limiting is ⚠ undecided (§10), so
  at most a Potential risk.
- **AI-7 Model and config.** Model ID comes from config or env, not a
  scattered hard-coded value. Timeouts are enforced.
- **AI-8 Tests.** The SDK is mocked in tests present in source (not
  executed). No test calls the real API.

---

## Full-only sections

### validation: input validation and error safety
**Requirements:** security.md §7. **OWASP:** A03, A04.
- **VAL-1** Every boundary input (form data, route params, search params,
  bodies, third-party responses) passes a schema before use.
- **VAL-2** Schemas are bounded (lengths, enums, ID format). They're strict
  where an unknown field could be confused with one the server derives.
- **VAL-3** Error responses are user-safe: no Zod, Prisma or stack details,
  and no IDs of inaccessible resources.
- **VAL-4** User content renders as plain text (no `dangerouslySetInnerHTML`).

### database: query safety and data integrity
**Requirements:** security.md §12; architecture §6, §7. **OWASP:** A01, A03, A04.
- **DB-1** No `$queryRawUnsafe` or `$executeRawUnsafe`. Any raw SQL uses
  `Prisma.sql`.
- **DB-2** Scoping happens in the query, not fetch-then-check (§4).
- **DB-3** State changes use conditional updates or transactions where races
  matter. Uniqueness is enforced in the database where the PRD requires it.
- **DB-4** Database modules are server-only (refer to SEC-2 for the marker
  check).
- **DB-5** Migrations are **read, never run**. Note destructive or
  constraint-relevant changes.
- **DB-6** Schema-vs-architecture differences are Documentation drift,
  unless they create a demonstrated weakness.

### caching: Next.js cache isolation
**Requirements:** security.md §4 (caching); CLAUDE.md (`cacheComponents`).
**OWASP:** A01.
- **CACHE-1** Find every `"use cache"`, `cacheLife`, `cacheTag` and
  `unstable_cache`. Per-user or community-scoped data is never cached under
  a key that lacks its scope.
- **CACHE-2** Session and request reads sit inside `<Suspense>` or dynamic
  contexts, and nothing caches them.
- **CACHE-3** Denial responses for protected content use `no-store`.

### ci: pipeline security
**Requirements:** testing.md §9; security.md §2 (A08), §13. **OWASP:** A05, A08.
- **CI-1** Workflow `permissions` follow least privilege.
  `persist-credentials` is false where possible.
- **CI-2** No `pull_request_target`. No secrets exposed to workflows run from
  forks. Secrets are never echoed.
- **CI-3** Actions are pinned by commit SHA or by tag (note which). Note any
  third-party actions.
- **CI-4** Security steps that are missing compared with testing.md §9
  (tests, coverage threshold, dependency audit, E2E). These are Policy
  deviations, not vulnerabilities.
- **CI-5** Stale or unexpected triggers.
- **CI-6** Repository settings (branch protection, Dependabot, secret
  scanning, code scanning) are Needs manual verification, owned by Aarushi.
