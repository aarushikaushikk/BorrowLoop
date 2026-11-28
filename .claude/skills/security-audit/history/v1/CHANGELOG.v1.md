# /security-audit changelog

This file is for people. The skill doesn't load it during an audit.
Issue #42 (HW5 Part 1). Each entry separates what was designed, what was
corrected before release, what was actually verified, and what hasn't been
exercised yet.

## v1: unreleased (implemented 2026-11-26 on `feature/42-security-audit-skill`, pending human review and commit)

### Initial design decisions (Phase SA-2, human-approved)
- Seven files with progressive disclosure: `SKILL.md` (workflow and hard
  rules), `references/discovery.md`, `references/scopes.md`,
  `references/severity-rubric.md`, `templates/report.md`,
  `templates/finding.md`, and this changelog.
- Frontmatter has `name`, `description`, `argument-hint` and
  `disable-model-invocation: true`, so only the human can invoke the skill.
  There's no `allowed-tools`, so existing permission settings govern every
  command. There's no `` !`command` `` injection and no `context: fork`, so
  the report stays in the terminal.
- Arguments come from `$ARGUMENTS` only. Indexed placeholders were avoided
  because, per the Claude Code docs, an unfilled `$N` stays as literal text.
- Modes:
  - `full` (default, and as an explicit alias), `auth`, `dependencies`,
    `diff`, `uploads`, `secrets`, `ai`;
  - `--dry-run`, which also combines with any scope;
  - at most one scope; unknown, repeated or over-long arguments are
    rejected before any tool call.
- A full audit covers auth, dependencies, uploads, secrets and ai, plus the
  full-only sections validation, database, caching and ci. `diff` is
  relative to the branch and runs only when requested.
- 8-step workflow: parse and preflight → requirements and discovery →
  read-only evidence → control analysis → classification and priority →
  false-positive verification → report → remediation and human
  verification.
- Reports are terminal-only. Evidence for submission is sanitized by the
  human.
- `npm audit --json` needs explicit conversational approval every run. No
  `npm audit fix`, installs or lockfile changes.
- v1 reads tests as evidence but never executes tests, builds or servers.
- `.env*`, including `.env.example`, and all settings deny-rule paths are
  never accessed.
- GitHub owner-level settings are manual verification, owned by Aarushi.
- Documentation drift is reported separately. Shared docs and config are
  never modified. The skill is independent of PR #41 (`/add-feature`).

### Pre-release corrections (from the human review of the SA-2 plan, applied before any execution)
- **Secret protection.**
  - A sensitive-content gate (`git grep -c`, count-only) runs before any
    content read.
  - Gated files can be viewed only through a redacting `sed` pipe in Git
    Bash, and PRIVATE_KEY hits and session exports are never viewed.
  - Diff file names are checked against the live deny rules first, and
    changed content is gated with `git diff -G … --name-only`.
  - Suspected values are never inspected. Every hit is Needs manual
    verification.
  - Raw session exports (`logs/**`) are count-scan only.
- **Classification.**
  - Confirmed requires technical evidence, a reachable path, a demonstrated
    weakness and compensating controls considered. A documented requirement
    supports a finding but isn't mandatory.
  - Static and runtime verified controls are kept apart. Tests are always
    "present in source, not executed".
  - Policy deviations have no severity ceiling. Severity comes from impact,
    likelihood and exposure. Public visibility is a contextual factor, not
    an automatic increase.
  - Published advisory severity is kept separate from BorrowLoop risk.
  - One priority ordering (P1–P4) across statuses.
  - Not applicable, Not examined, Blocked and Skipped are distinct
    outcomes.
- **Dependencies.**
  - Exposure context (runtime server or client, build/install time,
    dev/test, unknown) is assessed separately from prod vs. dev.
  - A missing direct import never proves unreachability; Unknown is the
    default.
  - A nonzero `npm audit` exit with valid JSON counts as a successful
    retrieval. Registry, permission and incomplete-output failures are
    reported as Blocked.
- **Read-only boundaries.** The report acknowledges npm cache and log files
  written outside the repository, and every tool's output is treated as
  untrusted.
- **Decisions.**
  - `full` alias supported.
  - Diff base is local `main`, with the base SHA, merge base and HEAD
    recorded and committed, staged, unstaged and untracked changes reported
    separately.
  - Git history secret scanning deferred.
  - No canary files in the repository.
  - Windows / Git Bash requirements documented, with safe fallbacks
    (skip and report Blocked rather than run unredacted).
- **OWASP.** Mappings use the 2021 category set used by `docs/security.md`
  §2, and the edition is stated explicitly.

### Verification actually completed (static only, 2026-11-26)
- **Files.** All 7 authorized files exist. They're the only changes in the
  working tree: untracked, with nothing staged and no tracked file modified.
  `SKILL.md` is 253 lines, under the documented 500-line guidance.
- **Frontmatter.** It parses with the repo's existing `js-yaml` (no install).
  Keys are exactly `name`, `description`, `argument-hint` and
  `disable-model-invocation: true`. The description is 331 characters, under
  the 1,536-character listing cap. `name` matches the directory.
- **Links and citations.**
  - All 5 supporting-file links in `SKILL.md`, and every
    `references/…`/`templates/…` mention, resolve.
  - Every cited section exists: `docs/security.md` §2–§14, architecture §5,
    §6, §7, §9, §9.1, §9.4, §10 and §12, testing §2, §3, §9 and §10, and PRD
    US-1 and US-2.
  - The §14 checklist group counts (5/3/2/5/4/5) match the source.
- **Safety.**
  - No `allowed-tools`, `context`, `agent`, `hooks` or `shell` keys.
  - No `` !` `` or ```` ```! ```` injection.
  - `$ARGUMENTS` appears once, with no indexed placeholders.
  - Every mention of `npm audit fix`, `npm install`, `git show <rev>:` and
    `git log -G` sits in a prohibition.
- **Consistency.** Status and outcome terms were checked across `SKILL.md`,
  the rubric and both templates. The report summary line was corrected to
  use exact status names.
- **Synthetic in-memory tests** (Git Bash, no repository files created):
  - The COMBINED pattern matched 7 of 8 synthetic credential-shaped lines.
    The `process.env.ANTHROPIC_API_KEY` reference line wasn't matched.
  - `grep -c` printed only a count.
  - The redacting `sed` output contained none of the synthetic values.
- **Git behavior.**
  - `git grep -E` compiled the pattern (exit 1, no match, run on the
    untracked skill directory only).
  - `git diff -G` compiled it on the empty branch diff (exit 0).
  - The `.env` exclusion pathspecs removed the one tracked `.env*` file
    from `git ls-files` output (names only; no content read).

### Runtime verification (Phase SA-4, 2026-11-26 to 2026-11-27, before the v1 commit)

**Status: v1 is an experimental development baseline, not production-ready.**
The safety-related limitations listed below must be addressed in v2 before
`/security-audit` is used for further real audits.

#### Registration: PASS
- `/security-audit` resolved and loaded from `.claude/skills/security-audit/`
  on every invocation.
- The skill never appeared in the model-visible skill listings during the
  session, which is consistent with `disable-model-invocation: true` keeping
  it out of Claude's context.

#### First real-task demonstration: full audit (`/security-audit`): completed
- This was the first of the two required real-task demonstrations, and it ran
  on v1 before the v1 commit. (An earlier plan named the dependency-only scope
  as Demonstration 1. That's superseded: the completed demonstration was the
  full audit.)
- Workflow followed: argument parsing, preflight, live deny-rule exclusions,
  the count-only sensitive-content gate before any content read, static
  evidence collection, classification, false-positive review and the report
  template.
- Result: **23 actionable items** (P1 5 · P2 3 · P3 7 · P4 8), including 8
  documentation-drift items, plus **16 statically verified controls**.
- **Zero confirmed vulnerabilities.** That means no item met all four
  Confirmed criteria in the examined scope. It doesn't mean the repository is
  free of vulnerabilities. Other items were classified as potential risks,
  manual-verification items, a dependency advisory and policy deviations.
- Secret-pattern hits were reported by category and count only, as Needs
  manual verification, with values never inspected. Session exports were
  count-scanned only. Restricted files were reported as Blocked. A negative
  pattern scan isn't treated as proof that a file contains no credentials.
- `npm audit --json` ran exactly once, after explicit conversational approval
  given in the session (H4). The approval request named the registry
  disclosure, possible npm cache or log writes outside the repository, and
  that no repository file would change.
- No repository files were modified, no Git mutations were made, and no
  application tests, builds or servers were run during audit execution.

#### Dry runs
- **Full (`--dry-run`, two calls): PARTIAL.** No npm commands, no gate, no
  source content reads and no findings, and the plan template was followed.
  But both calls reused the earlier inventory instead of re-running the
  discovery searches, which produced a wrong test-file count (44 instead of
  42). The second call didn't reload the reference files.
- **Auth (`auth --dry-run`): PASS.** Fresh preflight, inventory rebuilt with
  filename and `files_with_matches` searches only, the auth requirements and
  template re-read, and the test count corrected.
- **Dependencies (`dependencies --dry-run`): PARTIAL.** The core safety checks
  passed: no npm commands, only Glob and count or `files_with_matches` Grep,
  and a statement that the earlier npm audit approval doesn't carry over. But
  `docs/security.md` and the dry-run template came from session context
  rather than being reloaded in that call.

#### Invalid arguments: PASS (4 of 4)
Each invocation printed the reason and the usage block, with no tool calls:
`foo` (unknown token), `auth diff` (more than one scope), `--fix` (unknown
flag), `auth auth` (repeated token).

#### Observed deviations from v1 instructions
- **Stale inventory reuse:** dry runs reused an earlier inventory instead of
  re-running Step 2.3, and reported an incorrect test count.
- **Incomplete reference reloading:** some invocations relied on reference
  files or docs already in context instead of loading them in that call.
- **Misleading aggregate exit status:** the per-category secret-pattern scan
  was batched into one shell loop. The loop returned exit 1 because its last
  category had no matches, which is expected behavior, so the tool reported a
  failure. Output was complete and no gate error occurred, but an aggregate
  status could hide a real error (exit 128) in an earlier iteration. v1
  doesn't define how to read a batched exit status.
- **Content-mode search over gated paths:** one import-tracing content search
  in the full audit covered directories that included gated files. No
  sensitive values were returned, but H6 wasn't enforced by path.
- **Combined preflight calls:** dry runs combined the preflight commands into
  one call, although `discovery.md` §2 says to use separate calls.
- **Verified-control formatting:** the full report listed verified controls as
  condensed bullets instead of `templates/finding.md` §C blocks.
- **Drift verification:** documentation-drift items didn't each get
  individual Step 8 verification steps.

### Future v2 (planned from v1 execution evidence, not implemented)
- Ask for explicit confirmation before starting a full audit.
- Enforce gated-path exclusions for every content-mode search.
- Fail closed on genuine gate errors, and preserve each per-category exit
  status instead of relying on an aggregate loop status.
- Load the inventory and reference files fresh on every invocation, including
  dry runs.
- Report accurate inventory counts.
- Resolve the conflict between "list exported functions" discovery and the
  dry-run ban on content reads.
- Apply exclusion rules consistently to per-path commands.
- Document that gitignored files are outside scan coverage.
- Report documentation drift separately from security finding totals.
- Improve terminal report readability.

Each v2 entry will record the observed problem, the session evidence, the
change and the expected effect.

### Demonstration plan
- Demonstration 1 (completed on v1): the full audit described above.
- Demonstration 2 (pending): will use v2 on a distinct, human-approved real
  project security task.
- The v1 → v2 iteration hasn't been done yet.
