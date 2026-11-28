# Discovery, preflight and safe evidence collection

This is how the skill finds the **current** implementation, and how it
collects evidence without exposing restricted files or secret values. Don't
assume a file exists because these notes mention it. Discover it.

## Contents

1. Shell environment (Windows)
2. Preflight
3. Restricted paths (deny rules → exclusions)
4. Sensitive-content gate and secret-pattern categories
5. Inventory search patterns
6. Diff collection (diff scope)
7. Command reference

---

## 1. Shell environment (Windows)

BorrowLoop is developed on Windows. The Claude Code Bash tool runs **Git
Bash** (POSIX). The commands below are designed to need **no pipes** wherever
possible, so they behave the same in Git Bash and PowerShell. Use the Bash
tool.

| Need | Git Bash | PowerShell alternative |
|---|---|---|
| Count-only secret gate (`git grep -c`) | ✅ | ✅ Same command, single-quoted. ⚠ Windows PowerShell 5.1 can mangle embedded `"` in native arguments, so prefer Git Bash for the patterns that contain `"` |
| Redacting viewer (`sed -E` pipe) | ✅ | ❌ No safe equivalent assumed. **Skip the content** and report Blocked |
| Changed-content gate (`git diff -G`) | ✅ | ✅ Same command |
| Line numbers for gate hits (`git grep -n … \| cut -d: -f1,2`) | ✅ Optional | ❌ Don't use; report file and count only |

If `sed` or `cut` is unavailable, or a pipeline fails, **don't fall back to
an unredacted command**. Skip the affected content and report it as Blocked.

## 2. Preflight

Run these as separate tool calls. Each is read-only.

| Command | Purpose | Expected permission |
|---|---|---|
| `git branch --show-current` | Branch name | Will prompt unless allowlisted |
| `git rev-parse HEAD` | HEAD SHA | Will prompt unless allowlisted |
| `git status --short --branch` | Dirty tree, staged and unstaged, untracked | Allowlisted (`git status *`) at v1 authoring |
| Read `.claude/settings.json` | Deny rules (section 3) and the allow list (to predict prompts) | Read |

Record: branch, HEAD, clean or dirty, and the counts of staged, unstaged and
untracked files. Don't read `.claude/settings.local.json` or user settings.
Deny rules in those files still apply to tool calls. Any refusal is reported
as Blocked.

## 3. Restricted paths

Turn every `Read(<glob>)` entry under `permissions.deny` in
`.claude/settings.json` into a Git exclusion pathspec:
`':(exclude,glob)<glob>'`. Always add these baseline exclusions, even if
the settings file changes:

```
':(exclude,glob)**/.env' ':(exclude,glob)**/.env.*'
```

At v1 authoring, the deny list produced these exclusions:

```
':(exclude,glob)**/.env' ':(exclude,glob)**/.env.*' ':(exclude,glob)**/*.pem' ':(exclude,glob)**/*.key' ':(exclude,glob)**/*.p12' ':(exclude,glob)**/*.pfx' ':(exclude,glob)**/id_rsa*' ':(exclude,glob)**/id_ed25519*' ':(exclude,glob)**/credentials*.json' ':(exclude,glob)**/service-account*.json' ':(exclude,glob)**/secrets/**'
```

Rebuild the list from the live settings at each run. Below, `<EXCL>` means
this full list. Every Git command that lists or searches content must end
with `-- . <EXCL>`.

**Session exports and transcripts** (`logs/**`, `**/*.jsonl`, and files whose
names contain `transcript` or `session`) are **count-scan only**. Never read
their content, even redacted.

## 4. Sensitive-content gate

### Secret-pattern categories (POSIX ERE)

| Category | Pattern |
|---|---|
| ANTHROPIC_KEY | `sk-ant-[A-Za-z0-9_-]{20,}` |
| GOOGLE_OAUTH_SECRET | `GOCSPX-[A-Za-z0-9_-]{20,}` |
| GOOGLE_API_KEY | `AIza[0-9A-Za-z_-]{35}` |
| AWS_ACCESS_KEY | `(AKIA\|ASIA)[0-9A-Z]{16}` |
| GITHUB_TOKEN | `(ghp\|gho\|ghu\|ghs\|ghr)_[A-Za-z0-9]{36}` or `github_pat_[A-Za-z0-9_]{50,}` |
| PRIVATE_KEY | `-----BEGIN ([A-Z]+ )?PRIVATE KEY-----` |
| DB_URL_WITH_PASSWORD | `postgres(ql)?://[^:/@[:space:]]+:[^@/[:space:]]+@` |
| CLOUDINARY_URL | `cloudinary://[0-9]+:[^@[:space:]]+@` |
| JWT | `eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` |
| GENERIC_ASSIGNMENT | `(SECRET\|PASSWORD\|API_KEY\|TOKEN\|secret\|password\|apiKey\|api_key\|token)[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*"[A-Za-z0-9+/_=.-]{16,}"` |

(The `\|` in the table means `|`.) GENERIC_ASSIGNMENT only matches
double-quoted literals, because a single quote can't appear inside a
single-quoted shell argument. That's a known gap; list it under Limitations.

**COMBINED** (all categories, for gating):

```
sk-ant-[A-Za-z0-9_-]{20,}|GOCSPX-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|(AKIA|ASIA)[0-9A-Z]{16}|(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|postgres(ql)?://[^:/@[:space:]]+:[^@/[:space:]]+@|cloudinary://[0-9]+:[^@[:space:]]+@|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(SECRET|PASSWORD|API_KEY|TOKEN|secret|password|apiKey|api_key|token)[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*"[A-Za-z0-9+/_=.-]{16,}"
```

### Gate commands. Output is sanitized by Git itself.

`-c` prints only `path:count`. Matching text is never printed.

```
git grep --untracked -c -I -E -e '<COMBINED>' -- . <EXCL>
```

- Exit code 1 with no output means no matches. **That isn't an error.** Exit
  code 128 is an error, such as a bad pattern: report the gate as Blocked and
  don't read any content.
- To narrow the scan to the scope's paths, replace `.` with those paths and
  keep `<EXCL>`.
- To categorize a hit (secrets or full mode), re-run the same count-only
  command with one category pattern at a time.
- Optional, Git Bash only: get line numbers without content with
  `git grep --untracked -n -I -E -e '<CATEGORY>' -- <path> | cut -d: -f1,2`.
  If `cut` might not apply, don't run it.

Every file with a count above 0 goes on the **gated list**.

### Inspecting a gated file (Git Bash only)

These files may be read only through redaction, so matches are masked before
output reaches you:

```
sed -E 's#<COMBINED>#[REDACTED]#g' -- '<path>'
```

- **Never** use redacted viewing for PRIVATE_KEY hits, because key bodies
  span lines the pattern doesn't match. Never use it for session exports
  either. Both are Blocked.
- If the shell isn't Git Bash, or `sed` fails, skip the file and report it
  as Blocked.
- `[REDACTED]` text is never evidence that a credential is real or fake.
  Every hit is a **Needs manual verification** item: report the category and
  the file, and say "value not inspected".

Residual risk to list under Limitations: credentials that don't match a
pattern can still appear in files that weren't gated.

## 5. Inventory search patterns

In this table, `\|` is Markdown escaping for the regex alternation `|`.

During **discovery** (step 2, and the whole dry run), use filename and
`files_with_matches` searches only, never content mode. Content reads happen
in step 3, after the gate, and only on files that aren't gated.

| Concern | How to find it |
|---|---|
| Server Actions | Grep `"use server"` (files_with_matches) and list the exported async functions in each |
| Route handlers | Glob `src/app/**/route.ts`, `src/app/**/route.js` |
| Request proxy (formerly middleware) | Glob `src/proxy.ts`, `src/middleware.ts`, `proxy.ts`, `middleware.ts`; check the exported `config.matcher` |
| Protected pages and server content | Glob `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/app/**/*-content.tsx` |
| Auth config and session | Grep `NextAuth\(\|next-auth\|requireUser\|getCurrentUser\|auth\(\)` |
| Guards and access rules | Grep `authorize\|require[A-Z][a-zA-Z]*\(\|decide[A-Z][a-zA-Z]*Access\|getCommunityAccess` |
| Data access | Grep `getDb\(\|PrismaClient\|\.findMany\|\.findFirst\|\.findUnique\|\.create\|\.update\|\.delete\|\$transaction` |
| Raw SQL | Grep `\$queryRaw\|\$executeRaw\|Unsafe\|Prisma\.sql` |
| Server-only markers | Grep `^import "server-only"` (exact). A comment that merely mentions server-only doesn't count |
| Client components | Grep `"use client"`, then follow their imports |
| Env and secret usage | Grep `process\.env\.` and `NEXT_PUBLIC_` |
| Zod boundaries | Grep `safeParse\|\.parse\(\|z\.(strictObject\|object\|enum)` |
| Uploads | Grep `File\b\|formData\.get\|arrayBuffer\|bodySizeLimit\|upload` |
| Cloudinary | Grep `cloudinary` |
| Anthropic | Grep `@anthropic-ai/sdk\|messages\.create\|ANTHROPIC_` |
| Caching | Grep `"use cache"\|cacheLife\|cacheTag\|unstable_cache\|revalidateTag\|revalidatePath` |
| Unsafe rendering | Grep `dangerouslySetInnerHTML\|innerHTML\|eval\(\|new Function` |
| Logging | Grep `console\.(log\|error\|warn\|info)` |
| Tests | Glob `**/*.test.ts`, `**/*.test.tsx`; vitest config `vitest.config.*` |
| CI | Glob `.github/workflows/*.yml`, `.github/dependabot.yml`, `.github/codeql*` |
| Config | `next.config.*`, `package.json`, `package-lock.json` (Grep only, as it's large), `prisma/schema.prisma`, `prisma/migrations/**` |

Exclude generated, ignored and vendored paths from inventory: `node_modules/`
(the dependency procedure may read `node_modules/<pkg>/package.json` only),
`src/generated/`, `.next/`, `coverage/`. Never search `logs/**` except with
the count-only gate.

Hints from v1 authoring (2026-11-26), to verify and never assume:
- guards were in `src/server/auth/`, data access in `src/server/dal/`,
  pure rules in `src/server/domain/`, AI in `src/server/ai/`, upload
  validation in `src/server/images/`;
- Cloudinary and Prisma factories were in `src/lib/`;
- the only route handler was Auth.js.

## 6. Diff collection (diff scope)

Base is local `main`. Don't fetch. If `main` is missing, mark the diff scope
Blocked and stop.

1. **Record refs:**
   - `git rev-parse main` (base tip),
   - `git merge-base main HEAD` (merge base),
   - `git rev-parse HEAD`.
   Note that local `main` may be behind the remote.
2. **List names only**, in four buckets, each a separate call:
   - Committed: `git diff --name-status main...HEAD`
   - Staged: `git diff --cached --name-status`
   - Unstaged: `git diff --name-status`
   - Untracked: `git ls-files --others --exclude-standard`
3. **Apply the deny rules to the names.** Any changed path matching a
   restricted glob or `.env*` is reported as "changed, not inspected
   (restricted)" and dropped. So is any session export.
4. **Gate the changed content.** `-G` lists only file names, never text:
   - `git diff -G'<COMBINED>' --name-only main...HEAD -- . <EXCL>`
   - `git diff --cached -G'<COMBINED>' --name-only -- . <EXCL>`
   - `git diff -G'<COMBINED>' --name-only -- . <EXCL>`
   - Untracked: the section 4 gate restricted to those paths.
5. **Inspect contents** of the remaining files, per file and per bucket:
   - `git diff main...HEAD -- '<path>'`
   - `git diff --cached -- '<path>'`
   - `git diff -- '<path>'`
   - untracked files: Read.
   Files caught by the gate may only be viewed with the redacting pipe (Git
   Bash):
   `git diff main...HEAD -- '<path>' | sed -E 's#<COMBINED>#[REDACTED]#g'`.
   Otherwise they're Blocked.
6. Report which buckets were examined, empty, or blocked.

## 7. Command reference

| Command | Read-only | Network | Notes |
|---|---|---|---|
| `git status`, `git diff`, `git log` | ✅ | ❌ | Allowlisted at v1 authoring |
| `git rev-parse`, `git merge-base`, `git ls-files`, `git grep`, `git branch --show-current` | ✅ | ❌ | Will prompt unless allowlisted |
| `npm ls <pkg> --all [--omit=dev]`, `npm explain <pkg>` | ✅ (repo) | ❌ | Read `node_modules` and the lockfile. May write npm logs outside the repo. A nonzero exit can mean tree problems, not failure: read the output |
| `npm audit --json` | ✅ (repo) | ✅ registry | **H4 conversational approval every run.** Sends dependency metadata. May write cache or logs outside the repo |
| `gh issue view`, `gh pr view`, `gh pr diff` | ✅ | ✅ GitHub | Only if context requires. Apply the section 3 rules to `gh pr diff` (prefer local git) |

**Never:** `npm audit fix`, `npm install`/`ci`/`update`, `npx <tool>`, `prisma *`, `npm test`/`run *`, `next *`, `git show <rev>:<path>`, `git log -p`, `git log -G`/`-S` (history secret search was deferred in v1), or any Git mutation (SKILL.md H2).
