# /security-audit: v1 → v2 annotated evidence

**Author:** Pranav Sirnapalli · **Issue:** #42 · **Branch:** `feature/42-security-audit-skill`
**Reading note:** see [`README.md`](README.md). Labels: **Verbatim (transcript)**, **Summary**, **Annotation (my approach)**. All times are UTC from the session transcript.

---

## 1. v1 full audit: first real-task demonstration

**Summary.** I invoked `/security-audit` with no arguments at 2026-11-27 04:14:12 UTC, on v1 before the v1 commit (HEAD `4838b03`). v1 started the full audit straight away. It ran preflight, built exclusions from the live deny rules, ran the count-only secret-pattern gate, collected static evidence, asked before `npm audit`, and printed the report at 04:20:35 UTC. The report header shows the local date, 2026-11-26.

**Verbatim (transcript), npm approval request at 04:16:17, answered at 04:16:31:**

```text
Can I run `npm audit --json` once for the dependency check? It sends package names and versions from package-lock.json to your configured npm registry. npm may write cache or log files outside the repo, and nothing in the repository changes. If you decline, the dependency check is marked Skipped and covers only the local package.json review.
→ answer: "Yes, run it once"
```

**Verbatim (transcript), report header and summary, with `[…]` marking omitted lines:**

```text
# BorrowLoop security audit: full
Skill: /security-audit v1 · Date: 2026-11-26 · Mode: full · Dry run: no
[…]
## Summary
- Actionable items: 23 (P1 5 · P2 3 · P3 7 · P4 8)
- By status: Confirmed vulnerability 0 · Potential risk 4 · Dependency advisory 1 · Needs manual verification 6 · Policy deviation 4 · Documentation drift 8
- Verified controls (static): 16
[…]
- Overall: 23 actionable items in the examined scope. No item met the Confirmed criteria.
```

The "Top priorities" lines are omitted. They name unresolved findings and unverified credential-pattern matches. Sanitized, they cover:
- unverified credential-pattern matches (private verification pending);
- a community-membership policy pending a team decision (A01);
- cost and privacy hardening gaps in the upload pipeline.

**Annotation (my approach).** The audit worked end to end, but the run showed problems. I wrote them down before committing v1 as an experimental baseline (§2), instead of calling it production-ready.

## 2. Problems observed in v1

**Summary**, taken from the v1 runtime review recorded in the CHANGELOG:

| Problem | What happened in the session |
| --- | --- |
| No confirmation | A bare `/security-audit` started a full audit immediately |
| Bash reads | Most source was read with Bash `cat -n`, which skips Read deny rules |
| Search over gated paths | One import-tracing content search covered directories that contained gated files. Nothing sensitive was returned, but H6 wasn't enforced by path |
| Misleading gate exit | A batched per-category loop exited 1 because its last category had no matches. That status could have hidden a real error |
| Redacted viewing | v1 allowed regex-redacted viewing of gated files, which can leak partial values |
| Stale inventory | Dry runs reused an earlier inventory and reported 44 test files instead of 42 |
| Reference reloading | Some invocations relied on docs or references already in context |
| Inflated totals | 8 documentation-drift items were counted inside "23 actionable items". Unverified credential matches were ranked P1 as if real |
| Raw tool output | Raw `npm` output reached the model |

Invalid arguments (`foo`, `auth diff`, `--fix`, `auth auth`) were rejected correctly, 4 of 4, with no tool calls (04:55–04:57 UTC).

## 3. v2 changes and why

**Summary** (details and rationale in the CHANGELOG, checkpoints V2-A to V2-D.1):

| Change | Why |
| --- | --- |
| v1 archived unmodified in `history/v1/`, with hashes verified against the `51653de` blobs | Keeps the baseline reviewable |
| New `references/safe-evidence.md`: content only through Read on single allowlisted files; Bash reads banned; redacted viewing removed | Bash reads and redaction bypassed the deny rules and could leak values |
| Gate rewritten: per-category exit codes, `files=N` / `records=T` counts, explicit `GATE OK` / `GATE ERROR`, plus a consumer check on the received output | Fix the misleading exit status, and detect missing or extra records |
| Bootstrap sequence: path checks (lexical, index symlink, PowerShell reparse point) before a count-only gate on the skill files and settings, then the settings read | Settings were read with no path check |
| Validate-before-scan order for every candidate | Git for Windows lists files through junctions (observed in testing) |
| Confirmation before real `full` and `secrets` audits | v1 started immediately |
| H12 fresh evidence: no reused inventory, counts, approvals or references | Stale inventory and reloading problems |
| Discover (names only) vs. Evidence (content, real audits only) | The v1 dry-run rules contradicted the discovery table |
| Separate totals; status, severity, assessed risk, confidence, priority; unverified matches get conditional severity and P2 | Inflated, misleading v1 totals |
| `npm audit` only through a PowerShell field filter; `npm ls` and `npm explain` removed | Raw npm output reached the model |
| Real `diff` audits blocked (`diff --dry-run` kept) | The diff procedure (T8) wasn't tested |

## 4. Synthetic regression testing

**Summary.** These ran in an isolated throwaway repository outside BorrowLoop, on fabricated fixtures only (credential-shaped values built from filler characters). The human made every Git mutation there. Commands were copied verbatim from the skill with only the placeholders filled in.

| Test | Result |
| --- | --- |
| T0 frontmatter | PASS |
| T1 all ten categories | PASS |
| T2 final-category NONE and a clean set | PASS |
| T3 real errors and fault injection | PASS |
| T3b malformed or incomplete gate output | **FAIL** at first: 7 corrupted cases were accepted. Fixed (counted output plus consumer check), then retested: PASS |
| T4 scanned-set coverage | PASS. Empty, binary and gitignored files aren't scanned, so `NONE` isn't coverage |
| T5 exclusions and allowlist | PARTIAL (model-applied steps) |
| T6 path checks | PASS after fix. PowerShell 5.1 broke `Split-Path -LiteralPath -Parent`, which failed closed. Junctions were detected. File symlinks not tested (no privileges) |
| T7 deny-rule forms | Manual review |
| T9 missing lines | PASS |
| T10 Discover patterns | PASS |
| T11 npm output | PASS after restriction (filter; 0 leaks on fixtures; no real npm run) |
| T12 priority mapping | PASS after fix (3 of 30 combinations had no priority) |
| T13 integrity | PASS |
| T8 diff buckets | **NOT RUN** (human decision), so real diff audits are blocked |
| T14 deny rules vs. Grep/Glob | NOT VERIFIABLE offline |

**Annotation (my approach).** I kept the failures in the record. T3b, T6 and T12 found real defects, and each was fixed before runtime.

## 5. v2 runtime invocations (2026-11-27)

### 5.1 `/security-audit foo` at 18:47:46: PASS

**Verbatim (transcript), 18:47:50:**

```text
`foo` isn't a valid scope or flag, so I stopped without running anything.

Usage: /security-audit [full|auth|dependencies|diff|uploads|secrets|ai] [--dry-run]
[…]
```

No tool was called.

### 5.2 `/security-audit` at 18:47:59: PASS (confirmation declined)

**Verbatim (transcript):**

```text
Mode: full · Dry run: no
[AskUserQuestion] Run a real full security audit of BorrowLoop? It runs a count-only secret-pattern gate, reads only allowlisted repository files, and asks separately before any npm audit. It covers every scope except diff, which is blocked in v2.
→ answer: "Stop"
Audit not started: confirmation not given.
```

No preflight and no file reads, before or after the question.

### 5.3 `/security-audit auth --dry-run` at 18:48:34: PARTIAL

**Summary.**
- Bootstrap passed: 8 targets OK, `GATE OK categories=10 records=0`, consumer check valid, settings read.
- The Discover name listings for routes, pages and docs returned **no names with exit code 0**, although the files exist. Diagnostics showed that narrow includes combined with exclusion pathspecs triggered it.

**Verbatim (transcript), plan at 18:52:04:**

```text
**Not ready yet.** The real audit's candidate listing (safe-evidence.md §4 step 1) uses the same name-listing command with exclusions. On this repository it would quietly drop pages, route handlers and the cited docs, so the demonstration would be incomplete without any error.
```

**Annotation (my approach).** The skill reported the gap instead of working around it. That's why this run is PARTIAL rather than PASS.

### 5.4 `/security-audit auth` at 18:57:37: completed with documented limitations

See §6.

## 6. v2 authentication audit: second real-task demonstration

**Summary of the run** (report printed at 19:06:32):
- Fresh preflight and bootstrap, as in 5.3.
- The documented Evidence candidate listing used a broad `src/**` include and listed 99 candidates, matching a Glob cross-check.
- All 99 passed path validation (three PowerShell batches, `BAD 0`).
- The main gate gated four test files. They stayed Blocked and unread.
- The allowlist had 94 files. 40 were examined with the Read tool, one file per call. Requirements were re-read from the allowlisted docs.

**Verbatim (transcript), gate verdicts and summary, with `[…]` marking omitted lines:**

```text
GATE OK categories=10 records=0          (bootstrap)
GATE OUTPUT VALID records=0
[…]
GATE OK categories=10 records=5          (main gate; per-file records omitted here)
GATE OUTPUT VALID records=5
[…]
- **Security findings: 1** (P1 0 · P2 0 · P3 1 · P4 0)
- **Documentation drift: 3**
- **Verified controls (static): 10**
- **Reconciliation:** P1–P4 sum 1 = status sum 1 = finding entries 1. There are 3 drift entries and 10 control entries.
```

**Sanitized finding summary:** Potential risk · P3 · A01 · community-joining policy for a membership Server Action is pending a team decision.

**Static verification vs. executed tests.**
- All 10 verified controls are **static**: code read during this run (Google-only sign-in, token integrity, session validation, redirect safety, proxy matcher, defense in depth, strict parameters, 404/403 handling, fresh membership, query scoping).
- Test names were listed from 6 allowlisted test files as supporting evidence. **No test was executed.**
- Tests for the token-integrity control are in gated files, so that control has no test evidence.

**Documentation drift (3)** was reported separately:
- stale "not implemented" status banners;
- two code-cited decisions not recorded in the architecture decision table;
- an open 403-mechanism decision that is already implemented.

**Annotation (my approach): deviations I'm reporting honestly.**
1. Five narrow Discover listings were unreliable (the defect from 5.3). The Evidence listing was complete only as far as the Glob cross-check shows, and that Glob was truncated at 100 entries.
2. To cross-check one pattern search, I ran a Grep in names-only mode over the whole `src` directory. That search space included the gated files and generated files. It printed only file names, and no gated file matched, but it didn't explicitly exclude gated or non-allowlisted files.
3. One path-check call piped Git's output through `awk`, which hid the exit code. It was re-run in the exact documented form.

**Minimal fix afterwards (no redesign; instructions only; not re-run):**
- incomplete or truncated discovery must be reported as partial;
- search tools must never be pointed at a directory or search gated or non-allowlisted files after the main gate;
- the listing defect is documented, with a Glob cross-check required.

## 7. Remaining limitations

- **Instructions, not a sandbox.** Only Claude Code permission rules and `git grep -c`/`-l` output limits are technically enforced. V2-F showed two procedural deviations, so model compliance isn't guaranteed.
- **Discovery coverage is incomplete.** The Git exclude-pathspec listing defect isn't fixed, only detected and reported as partial.
- **Not tested:**
  - real diff audits (T8), which are blocked;
  - the real `npm audit` pipeline (fixtures only);
  - file symlinks and real mode-120000 entries;
  - Read deny-rule coverage of Grep and Glob (T14);
  - the "run a dry run instead" confirmation branch;
  - a re-run after the final instruction additions.
- **Pattern scanning limits.** Only ten patterns are detected, and a negative scan isn't proof of absence. Binary, empty, gitignored files and Git history aren't scanned. Hard links and changes between a check and a read aren't detected.
- **Static only.** No tests, builds or servers were run by the skill. Tests are cited as present in source, not executed.
- **Open items.** The credential-pattern matches from both runs still need private verification by a person.
