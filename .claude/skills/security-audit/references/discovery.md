# Discovery, preflight and command reference

This is how the skill finds the **current** implementation by name, and which
command forms it may use. How content is read safely is defined in
`safe-evidence.md`, which takes precedence wherever the two overlap. Don't
assume a file exists because these notes mention it. Discover it.

## Contents

1. Shell environment (Windows)
2. Preflight
3. Restricted paths and the sensitive-content gate (see safe-evidence.md)
4. Inventory: Discover and Evidence (4.1 Discover, 4.2 Evidence, 4.3 search
   log and counts)
5. Command reference

---

## 1. Shell environment (Windows)

BorrowLoop is developed on Windows. The Claude Code Bash tool runs **Git
Bash** (POSIX).

| Need | Requirement |
|---|---|
| Sensitive-content gate and scanned-set list (safe-evidence.md §2, §4) | **Git Bash only.** In any other shell they're Blocked, and so is content inspection in the affected scope |
| Diff name listing and version gating (safe-evidence.md §6) | Git Bash |
| Path validation (safe-evidence.md §5): lexical rules, `git ls-files -s`, and the §5.3 reparse-point check | §5.3 uses `powershell.exe` started from Git Bash with `-EncodedCommand`. Runs during bootstrap (bootstrap targets only, dry runs included) and before any working-tree scan in a real audit. If it's unavailable, refused or incomplete, those paths are Blocked, and a failure during bootstrap blocks bootstrap |
| Reading file content | The **Read tool** only, on allowlisted files. Never a shell command |

There's no redacted-viewing command and no command that extracts line
numbers for secret matches, and none may be improvised. If a required
command can't run, or a pipeline fails, the affected check is **Blocked**.
Never fall back to a less safe command.

## 2. Preflight

These are read-only. Either run them as separate tool calls, or use this
combined form, which records each command's exit code:

```bash
for c in "git rev-parse --show-toplevel" "git branch --show-current" "git rev-parse HEAD" "git status --short --branch -uall"; do echo "== $c"; $c; echo "rc=$?"; done
```

| Command | Purpose | Expected permission |
|---|---|---|
| `git rev-parse --show-toplevel` | Repository root | Will prompt unless allowlisted |
| `git branch --show-current` | Branch name | Will prompt unless allowlisted |
| `git rev-parse HEAD` | HEAD SHA | Will prompt unless allowlisted |
| `git status --short --branch -uall` | Dirty tree: staged, unstaged and untracked files | Allowlisted (`git status *`) |

- Every item needs `rc=0`. Any other code means that item is **Blocked**, and
  the report says so.
- Record: branch, HEAD, clean or dirty, the counts of staged, unstaged and
  untracked files, and whether the shell is Git Bash.
- Then run the bootstrap sequence (safe-evidence.md §1): list the
  bootstrap targets, validate their paths, run the bootstrap gate on the
  validated files, and only then read `.claude/settings.json` and build the
  exclusions (§3).
- Don't read `.claude/settings.local.json` or user settings. Deny rules in
  those files still apply to tool calls, and any refusal is reported as
  Blocked.

## 3. Restricted paths and the sensitive-content gate

These are defined in `safe-evidence.md`: §1 bootstrap set, §2 gate, §3
exclusions and session exports, §4 allowlist, §5 path validation, §6 diff
safety. They aren't repeated here.

## 4. Inventory: Discover and Evidence

Work is split into two phases:
- **Discover** (Step 2): runs in dry runs and real audits. Name listings and
  metadata only. Nothing here reads file text.
- **Evidence** (Step 3): real audits only. Path validation comes first, then
  pattern searches, the main gate, the scanned set and the allowlist
  (safe-evidence.md §2–§5), and then content reads.

A Discover result is a **candidate**. It doesn't tell you what the code does,
and it doesn't mean the gate covered the file.

### 4.1 Discover (names and metadata) and pattern searches

**Exclusions.** `<DEXCL>` is `<EXCL>` (safe-evidence.md §3) plus these fixed
exclusions:

```
':(exclude,glob,icase)logs/**' ':(exclude,glob,icase)**/*.jsonl' ':(exclude,glob,icase)**/*transcript*' ':(exclude,glob,icase)**/*transcript*/**' ':(exclude,glob)src/generated/**' ':(exclude,glob).claude/skills/security-audit/history/**' ':(exclude,icase).claude/skills/security-audit/CHANGELOG.md'
```

If `<EXCL>` couldn't be built (the bootstrap gate or deny-rule conversion
failed), use the baseline `.env` exclusions plus the fixed exclusions only,
and mark every Discover result **partial**. Gitignored paths, such as
`node_modules/`, `.next/` and `coverage/`, never appear in these Git
commands.

**Approved Discover form: name listing.** This runs in Git Bash, in every
run including dry runs. It lists names only and doesn't read file content.

```bash
git -c core.quotePath=true ls-files --cached --others --exclude-standard -- '<pathspec>'... <DEXCL> 2>/dev/null; echo "rc=$?"
```

**Pattern searches (real audits only).** These read file text to find
candidates, so they're a scan. They run only in Step 3, after path
validation (safe-evidence.md §4 order, step 2), and only over the
**explicit list of validated files**, never over directory pathspecs:

```bash
git -c core.quotePath=true grep --untracked -l -I -E -e '<pattern>' -- <validated files> <DEXCL> 2>/dev/null; echo "rc=$?"
```

A dry run lists these searches as "would run in a real audit" and doesn't
run them.

- **Exit codes:** `ls-files` needs `rc=0`. For `grep -l`, `0` means names
  follow, `1` means none, and anything else means the search failed.
- **Failures:** a failed, refused or truncated search makes that count
  **unknown**.
- **Glob syntax:** `<pathspec>` uses `:(glob)` magic for `**`, for example
  `':(glob)src/app/**/route.ts'`.
- **Tool alternatives:** the Glob tool may list names, limited to the
  scope's paths, with results filtered against `<DEXCL>`. A truncation
  notice makes the result partial. The Grep tool reads file content, so it's
  treated like a pattern search: real audits only, after path validation,
  and limited to validated files, with `head_limit: 0`. Never give it a
  directory path, and after the main gate never include gated or
  non-allowlisted files. Prefer the Git forms, because Git applies the
  exclusions itself.
- **Known defect (v2, observed on Git 2.46.0.windows.1):** the name listing
  above, with narrow includes (explicit files, `docs/*.md`,
  `src/app/**/route.ts`) plus exclusion pathspecs, can return **no names
  with `rc=0`** for files that exist. A broad include such as
  `':(glob)src/**'` listed them. `rc=0` alone isn't proof of completeness:
  cross-check with Glob and report any shortfall as **partial**.

In the table, **name** rows are Discover in every run. **Pattern** rows run
only in real audits, as described above. The patterns are POSIX extended
regular expressions for `git grep -E`. In the table, `\|` means `|`.

| Concern | Search |
|---|---|
| Server Actions | pattern: `grep -l` `"use server"` |
| Route handlers | name: `ls-files` `':(glob)src/app/**/route.ts'` `':(glob)src/app/**/route.js'` |
| Request proxy (formerly middleware) | name: `ls-files` `src/proxy.ts` `src/middleware.ts` `proxy.ts` `middleware.ts` |
| Protected pages and server content | name: `ls-files` `':(glob)src/app/**/page.tsx'` `':(glob)src/app/**/layout.tsx'` `':(glob)src/app/**/*-content.tsx'` |
| Auth config and session | pattern: `grep -l` `NextAuth\(\|next-auth\|requireUser\|getCurrentUser\|auth\(\)` |
| Guards and access rules | pattern: `grep -l` `authorize\|require[A-Z][a-zA-Z]*\(\|decide[A-Z][a-zA-Z]*Access\|getCommunityAccess` |
| Data access | pattern: `grep -l` `getDb\(\|PrismaClient\|\.findMany\|\.findFirst\|\.findUnique\|\.create\|\.update\|\.delete\|\$transaction` |
| Raw SQL | pattern: `grep -l` `\$queryRaw\|\$executeRaw\|Unsafe\|Prisma\.sql` |
| Server-only markers | pattern: `grep -l` `^import "server-only"` (exact; a comment that mentions server-only doesn't count) |
| Client components | pattern: `grep -l` `"use client"` |
| Env and secret usage | pattern: `grep -l` `process\.env\.` and, separately, `NEXT_PUBLIC_` |
| Zod boundaries | pattern: `grep -l` `safeParse\|\.parse\(\|z\.(strictObject\|object\|enum)` |
| Uploads | pattern: `grep -l` `(^\|[^A-Za-z0-9_])File([^A-Za-z0-9_]\|$)\|formData\.get\|arrayBuffer\|bodySizeLimit\|upload` |
| Cloudinary | pattern: `grep -l` `cloudinary` |
| Anthropic | pattern: `grep -l` `@anthropic-ai/sdk\|messages\.create\|ANTHROPIC_` |
| Caching | pattern: `grep -l` `"use cache"\|cacheLife\|cacheTag\|unstable_cache\|revalidateTag\|revalidatePath` |
| Unsafe rendering | pattern: `grep -l` `dangerouslySetInnerHTML\|innerHTML\|eval\(\|new Function` |
| Logging | pattern: `grep -l` `console\.(log\|error\|warn\|info)` |
| Tests | name: `ls-files` `':(glob)**/*.test.ts'` `':(glob)**/*.test.tsx'` `':(glob)vitest.config.*'` |
| CI | name: `ls-files` `':(glob).github/workflows/*.yml'` `.github/dependabot.yml` `':(glob).github/codeql*'` |
| Config and dependency metadata | name: `ls-files` `':(glob)next.config.*'` `package.json` `package-lock.json` `prisma/schema.prisma` `':(glob)prisma/migrations/**'` |
| Restricted files present (SEC-5) | name: `ls-files` with each deny glob as `':(glob,icase)<glob>'` (names only) |
| Diff refs (diff scope) | `git rev-parse main`, `git merge-base main HEAD` (metadata only, no diff output) |

Read-only metadata is allowed in Discover: preflight, the refs above, and
the bootstrap path-validation and bootstrap-gate verdicts.

### 4.2 Evidence (real audits only)

Every item here needs content, so it runs only in Step 3, after a valid main
gate. It's done with Read, or single-file content Grep, on allowlisted files
only (safe-evidence.md §4). If a step depends on a file that isn't on the
allowlist, it's "not established" or **Blocked**.

| Evidence | How |
|---|---|
| Exported Server Action functions | Read each allowlisted `"use server"` candidate |
| Proxy matcher | Read the allowlisted proxy file and its exported `config.matcher` |
| Import tracing | Read allowlisted files along the import chain (client components, server-only boundary) |
| Authorization and validation analysis | Read allowlisted entry points, guards, schemas and data-access modules |
| Other source inspection | Read allowlisted files for the scope's checklist (scopes.md) |
| Project requirements | Read the cited doc sections (offset and limit), only if the doc is allowlisted |
| Tests | Read allowlisted test files and cite their names, labeled "present in source, not executed" |
| Dependency evidence | Read allowlisted `package.json`; single-file Grep of allowlisted `package-lock.json`; `npm audit --json` only after H4, and only through the safe-evidence.md §7 filter. `npm ls` and `npm explain` aren't used |
| Diff content | safe-evidence.md §6 only |

### 4.3 Search log and counts

Record every search and every reference read in **this invocation** (H12),
for the report's "Searches this run" and "Loaded this run".

For each search, record:
- its purpose (the concern above),
- the exact method (the command, or the tool and its parameters),
- its scope and exclusions,
- the number of results,
- whether it was **complete**, **partial** (and why) or **unknown** (failed
  or refused).

Count rules:
- Every count in a report cites the search number it came from. A count
  with no search behind it in this invocation isn't reported.
- **Deduplicate** before combining. A combined total is the number of
  distinct paths across the searches it combines.
- If any contributing search is partial or unknown, the total is reported
  as partial or unknown, never as a firm number.
- Keep the file states separate:
  - **candidates:** found by Discover;
  - **scanned:** in the gate's scanned set (safe-evidence.md §4);
  - **eligible:** on the allowlist;
  - **examined:** actually read this invocation;
  - **blocked:** with the reason: gated, restricted, failed a path check,
    outside coverage, or the gate failed.

  A dry run reports candidates only. The other states are "not determined
  in dry run".

## 5. Command reference

These are the **only** allowed command forms. Every form is read-only.
"Auto-allowed" means the project settings let it run without a prompt.
Phases:
- **B** = bootstrap (dry run and real),
- **D** = Discover (dry run and real),
- **E** = Evidence (real audits only).

| Command form | Phase | Purpose | Network | Permission |
|---|---|---|---|---|
| The section 2 preflight commands | B | Preflight metadata | ❌ | `git status` auto-allowed; the others will prompt |
| The safe-evidence.md §1 bootstrap target listing (`git ls-files` of the named bootstrap files) | B | Bootstrap targets | ❌ | Will prompt |
| safe-evidence.md §5.1–§5.3 on **bootstrap targets only** (`git ls-files -s`, the `powershell.exe -EncodedCommand` check) | B | Bootstrap path validation | ❌ | Will prompt |
| The safe-evidence.md §2 gate script with the §1 bootstrap values (validated explicit files), then the §2 consumer check | B | Bootstrap gate | ❌ | Will prompt; Git Bash only |
| Read the active skill files; Read `.claude/settings.json` only after bootstrap path validation and the bootstrap gate pass | B | References and exclusions | ❌ | Tool permissions |
| The §4.1 `git ls-files` name listing | D | Inventory names | ❌ | Will prompt |
| Glob, scope-limited and filtered (§4.1) | D | Inventory names | ❌ | Tool permissions |
| `git rev-parse main`, `git merge-base main HEAD` | D | Diff refs | ❌ | Will prompt |
| The safe-evidence.md §4 candidate listing, then §5.1–§5.3 on scope candidates (`git ls-files -s`, the `powershell.exe` check) | E | Path validation before any working-tree scan | ❌ | Will prompt |
| The §4.1 pattern searches (`git grep -l` over validated files); Grep in `files_with_matches` or `count` mode over validated files | E | Pattern-based candidates | ❌ | Will prompt / tool permissions |
| The safe-evidence.md §2 gate script with the scope's values (validated explicit files), then the §2 consumer check | E | Main gate | ❌ | Will prompt; Git Bash only |
| The safe-evidence.md §4 scanned-set command (`git grep -l -e ''`, same validated files) | E | Files the gate covered | ❌ | Will prompt; Git Bash only |
| The safe-evidence.md §6 `git diff` forms | E | Diff names and content | ❌ | `git diff` auto-allowed |
| Read on one allowlisted file; Grep in content mode with `path` set to one allowlisted file | E | Content evidence | ❌ | Tool permissions; `Read(...)` deny rules apply |
| `npm audit --json`, piped through the safe-evidence.md §7 filter (never raw) | E | Advisories | ✅ registry | **H4 conversational approval every run.** May write npm cache or logs outside the repo |
| `gh issue view <n>`, `gh pr view <n>` | D or E | Metadata only, if context requires | ✅ GitHub | Will prompt |

A dry run runs only **B** and **D** forms. It may list **E** forms only as
"would run in a real audit".

**Never:**
- `git show` with a `<rev>:<path>` argument or a patch, `git log -p`,
  `--patch`, `-G` or `-S`, `git cat-file -p`, `git blame`, or `git grep`
  without `-c` or `-l`.
- Any `git diff` other than the safe-evidence.md §6 forms, `--text`, `-a`,
  `--binary`, or `gh pr diff`.
- Reading file content through Bash (`cat`, `head`, `tail`, `sed`, `awk`,
  `grep` on files, `type`, `Get-Content`, and similar), or reading anything
  under `node_modules/`.
- `npm audit fix`, `npm install`/`ci`/`update`, `npx <tool>`, `prisma *`,
  `npm test`/`run *` or `next *`.
- Any Git mutation (SKILL.md H2).

`git show *`, `git log *` and `git diff *` are auto-allowed by the project
settings. So the bans on their unsafe forms are **instructions only**, not
permission rules (safe-evidence.md §0).
