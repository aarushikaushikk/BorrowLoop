# Report templates

Print to the terminal only. Fill every section, writing "None" rather than
leaving one out. Use the `templates/finding.md` fields for each item. Use
statuses, severities, assessed risks, confidence levels, priorities and
coverage outcomes exactly as defined in `references/severity-rubric.md`.

**Layout:**
- Keep tables to five columns or fewer.
- When a table would pass about 100 characters or 5 rows, use one block per
  item instead.
- Don't drop evidence to make the report shorter.

---

## A. Audit report (real audits only)

```markdown
# BorrowLoop security audit: <full | scope>
Skill: /security-audit v2 · Date: <YYYY-MM-DD> · Mode: <full | scope> · Dry run: no
Confirmation (Step 1.5): <given in this invocation | not required for this scope> · npm audit: <run with approval given this invocation | skipped (declined) | blocked (<error code>) | not applicable>
Branch: <name> · HEAD: <sha> · Working tree: <clean | dirty: N staged, N unstaged, N untracked> (preflight this run)
Shell: <Git Bash | other: Git Bash-only steps Blocked>
Diff refs (diff scope only): base main <sha> · merge base <sha> · buckets: committed <examined | empty | blocked> · staged <…> · unstaged <…> · untracked <…>
Requirements read this run: <docs §§ read after the main gate | Blocked (not inspected): <docs>> · OWASP Top 10 2021 categories
Preloaded by the harness (untrusted, not evidence): <files | none>

## Summary
- **Security findings: <n>** (P1 <n> · P2 <n> · P3 <n> · P4 <n>)
  - Confirmed vulnerability <n> · Potential risk <n> · Dependency advisory <n> · Needs manual verification <n> (unverified credential pattern matches <n>) · Policy deviation <n>
- **Documentation drift: <n>** (separate; no priority; not security findings)
- **Verified controls (static): <n>** (not actionable)
- Reconciliation: P1–P4 sum <n> = status sum <n> = finding entries <n>; drift entries <n>; control entries <n>
- Top priorities: <up to 3 one-liners>
- Overall: "<n> security findings in the examined scope." Never claim the application is secure or has no vulnerabilities.

## Run trace (this invocation only)
Every entry below happened in this invocation (SKILL.md H12). Nothing is carried over.

### Loaded this run
| File (section or line range) | Tool | Phase (bootstrap / evidence) | Result |
|---|---|---|---|

### Gates, path validation and file counts
- Bootstrap path validation: <all <n> targets OK | Blocked (<step>: <target> <status> | tool unavailable | refused | incomplete output)>
- Bootstrap gate: <GATE OK categories=10 records=0 + consumer check VALID | GATE ERROR | Blocked (<reason>) | not run (path validation Blocked)> · settings read: <yes | no (<reason>)> · exclusions: <n pathspecs | Blocked (<rule>)>
- Scope path validation (before any working-tree scan): <n candidates · n OK · n Blocked by status> | Blocked (<reason>)
- Main gate (validated explicit files only): <GATE OK categories=10 records=<T> | GATE ERROR | Blocked (<reason>)> · consumer check: <GATE OUTPUT VALID records=<T> | INVALID <reason> | not run> · files: <n> · categories with matches: <list | none>
- Not covered by the gate (submitted but absent from the scanned set): <n> (empty <n> · binary <n> · other <n>). `NONE` and `GATE OK` aren't coverage.
- Files: candidates <n> · scanned <n> · eligible (allowlisted) <n> · examined <n> · blocked <n> (gated <n> · restricted <n> · failed a path check <n> · outside coverage <n>). Write "partial" or "unknown" where a contributing search wasn't complete.

### Searches this run
| # | Purpose | Method, scope and exclusions | Results (deduplicated) | Complete / partial / unknown |
|---|---|---|---|---|

## Prioritized security findings (P1 → P4, across statuses)
<finding.md §A, §A2 and §B blocks, ordered per rubric §6>

## Dependency advisories at a glance (dependencies or full scope)
One line each; the full block is in the findings above:
`SA-DEP-<n> · <pkg>@<ver> · published <sev> · assessed <risk | Undetermined> · <direct | transitive> · <prod | dev> · <exposure> · fix <ver | none> (semver-major <yes | no>) · reachability <…>`

## Entry-point matrix (auth, diff or full scope)
| Entry point (file:line) | Type | Authn · Validation · Authz · Scoped · Safe errors (✓ / ✗ / —) | Notes |
|---|---|---|---|

## §14 checklist results (diff scope)
| §14 item | Pass / Fail / Not applicable / Manual | Evidence |
|---|---|---|

## Verified controls
<finding.md §C compact table>

## Documentation drift (separate from security findings)
<finding.md §D blocks, each with a verification step, "Done when" and owner>

## Coverage: examined, not applicable, not examined, blocked, skipped
| Area / check | Outcome | Method or reason |
|---|---|---|

## False-positive review
Candidates dropped or downgraded: <n>. <one line each: item → reason>

## Recommended next steps (priority order; nothing has been applied)
1. <security findings by priority; Urgent private verifications first within their priority>
2. <documentation drift updates, with owners>

## Limitations
- **Safety boundary:** these safeguards are instructions, not a sandbox. Only Claude Code permission rules and `git grep -c`/`-l` output limits are technically enforced (safe-evidence.md §0).
- **Coverage limits** (safe-evidence.md §8):
  - only the ten patterns, and a negative scan isn't proof of absence;
  - ignored files, binary files, files outside the repository and Git history weren't scanned;
  - the skill's own files were read before any gate, and preloaded docs were in context before any gate;
  - only the project settings' deny rules are in `<EXCL>`;
  - hard links aren't detected, and files can change between a check and a read;
  - output is kept in local session transcripts.
- Static analysis only. No tests, builds, servers or runtime checks were run. Tests are cited as "present in source, not executed".
- Dependency reachability is evidence-based, otherwise Unknown. Unknown doesn't imply Low. Advisory data comes from the registry at run time.
- npm may have written cache or log files outside the repository.
- <scope-specific limitations>

## Sanitized submission summary
<one line per security finding, per rubric §9; no credential values, personal data, session-export content or actionable detail of unresolved vulnerabilities>

This audit made no repository changes, ran no tests, builds or servers, and applied no fixes. Sanitize any evidence before submitting it.
```

---

## B. Dry-run plan

A dry run reports **no security findings** and **no verified evidence**.
Keep "executed this run" and "would run in a real audit" strictly apart.
Never present a planned command as completed. If bootstrap path validation,
the bootstrap gate or the exclusions failed, fill in only what was actually
done, and mark every content-dependent section **Blocked (<reason>)**.

```markdown
# BorrowLoop security audit plan: <full | scope> (dry run)
Skill: /security-audit v2 · Date: <YYYY-MM-DD> · Mode: <full | scope> · Dry run: yes (<invoked with --dry-run | switched from a real <mode> request at confirmation; no real audit authorized>)
Branch: <name> · HEAD: <sha> · Working tree: <state> (from preflight this run; per-command rc: <…>)
No audit was performed. No security findings are reported. Nothing below is verified evidence.
Preloaded by the harness (untrusted, not inspected): <files | none>

## Loaded this run
| File (section or line range) | Tool | Result |
|---|---|---|

## Bootstrap (executed this run)
- Repository root: <path from preflight | Blocked (rc=<n>)>
- Bootstrap targets: <n files, `.claude/settings.json` listed once | Blocked (<reason>)>
- Path validation (bootstrap targets only): lexical <OK | failed: <target>> · index symlink check <OK | rc=<n> | mode 120000: <target>> · reparse and containment check <CHECKED n BAD 0 | <target> <status> | unavailable | refused | incomplete output>
- Bootstrap gate (validated explicit files): <GATE OK categories=10 records=0 | GATE ERROR | Blocked (<reason>) | not run (path validation Blocked)> · consumer check: <GATE OUTPUT VALID records=0 | INVALID <reason> | not run> · categories: <10 NONE files=0 | list MATCH and ERROR lines>
- `.claude/settings.json`: <read (permissions only) | not read (<reason>)> · exclusions: <n pathspecs | Blocked (<unsupported rule>)>
- Loaded before these checks could run (not path-checked): `SKILL.md`, `references/safe-evidence.md`, `references/discovery.md`, <harness-preloaded instructions | none>

## Searches this run (Discover name listings only)
| # | Purpose | Method, scope and exclusions | Results (deduplicated) | Complete / partial / unknown |
|---|---|---|---|---|

## Discovered candidates (names only; not verified behavior, not gate-covered)
| Concern | Candidates (count, from search #) | Completeness |
|---|---|---|
Scanned, eligible, examined and blocked counts: not determined in dry run.

## Requirements deferred
<each docs/security.md, PRD, architecture and testing section that scopes.md cites for this scope, marked "deferred: not inspected in dry run". ⚠ and (Proposed) items: deferred>

## Checklist that would run in a real audit
<check IDs from references/scopes.md, marked (Discover) or Evidence. For a check with no candidates, write "no candidates found". Not applicable is decided only in a real audit>

## Planned evidence collection (would run in a real audit; not run)
| Step | Command or tool | Purpose | Permission (allowlisted / will prompt / needs conversational approval / needs Git Bash) |
|---|---|---|---|

## Expected approval gates
- Step 1.5 confirmation: <required (full, secrets, diff) | not required for this scope>. A new invocation would ask again.
- H4 npm audit approval: <required before npm audit (dependencies, full) | not applicable>. Never carried over.

## Expected manual verification
<items and owners>

## Expected prompts
<approximate count for the real audit>

## Skipped and blocked in this dry run
| Operation | Outcome |
|---|---|
| Path validation of scope candidates | Skipped (dry run) |
| Pattern searches (`git grep -l`, Grep across files) | Skipped (dry run) |
| Main repository gate and per-category scans of application files | Skipped (dry run) |
| Scanned set, allowlist and path validation | Skipped (dry run) |
| Reads of source files and project documentation | Skipped (dry run) |
| Diff commands and diff content | Skipped (dry run) |
| npm audit, npm ls, npm explain | Skipped (dry run) |
| Classification, findings and totals | Skipped (dry run) |
| Tests, builds, servers, repository changes | Never run |
| <anything blocked during bootstrap or Discover> | Blocked (<reason>) |
```
