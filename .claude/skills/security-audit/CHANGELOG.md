# /security-audit changelog

This file is for people. The skill doesn't load it during an audit.
Issue #42 (HW5 Part 1). Each entry separates what was designed, what was
corrected before release, what was actually verified, and what hasn't been
exercised yet.

## v2: unreleased (implemented 2026-11-27 on `feature/42-security-audit-skill`, pending human review and commit)

**Status: implemented and exercised, with documented limitations. Not
production-ready.**
- Static and syntax checks have run.
- Synthetic regression tests T0–T5 ran in V2-E.2 to V2-E.2.2. The T3b
  completeness defect found in V2-E.2.1 was corrected and retested in
  V2-E.2.2. T5 is still partial (see "Regression testing" below).
- T6, T7 (manual), T9–T13 ran in the consolidated V2-E.3 checkpoint. Two
  defects were found and fixed, and one capability was restricted.
- **T8 (diff buckets) wasn't run**, by human decision. **Real `diff`
  audits are blocked in v2** (SKILL.md Step 1 item 5 stops before any tool
  call). The interface and `diff --dry-run` planning are kept. Synthetic
  regression testing is closed.
- T14 can't be verified offline.
- Runtime checks (V2-F) ran on 2026-11-27: two PASS, one PARTIAL, and the
  real auth audit (the second demonstration) completed with documented
  limitations. See "Runtime verification (V2-F)" below.
- One new defect (narrow Git name listings with exclusions silently return
  nothing) and one procedural deviation (a broad Grep cross-check) were
  observed. They're recorded below with the minimal instruction added in
  response. Discovery coverage and safety compliance were **not** perfect.

### Runtime verification (V2-F, 2026-11-27, BorrowLoop working tree)
Four invocations were entered by the human, in order. Times are UTC, taken
from the session transcript.

| # | Invocation | Result | Evidence |
|---|---|---|---|
| 1 | `/security-audit foo` (18:47:46) | **PASS** | Printed "`foo` isn't a valid scope or flag, so I stopped without running anything." and the usage block. No tool calls |
| 2 | `/security-audit` (18:47:59) | **PASS** | Printed `Mode: full · Dry run: no`, then asked through AskUserQuestion before any other tool call. The human chose "Stop". Printed "Audit not started: confirmation not given." No further tool calls |
| 3 | `/security-audit auth --dry-run` (18:48:34) | **PARTIAL** | Bootstrap passed in full (8 targets OK; `GATE OK categories=10 records=0`; consumer check VALID; settings read). Discover name listings for routes, pages and docs returned no names with `rc=0` although the files exist (defect below). The plan marked those counts unknown and reported "Not ready yet" |
| 4 | `/security-audit auth` (18:57:37) | **Completed with documented limitations** | Second real-task demonstration (below) |

### Second real-task demonstration: `/security-audit auth` (v2)
Report printed at 19:06:32 UTC. Static analysis only: no tests, builds,
servers or npm commands ran. Tests are cited as present in source, not
executed.
- **Bootstrap:** 8 of 8 targets passed path validation; bootstrap gate
  `GATE OK categories=10 records=0`; consumer check `GATE OUTPUT VALID
  records=0`; 11 deny rules converted.
- **Candidates and path validation:** 99 candidates from the documented
  safe-evidence §4 listing (broad `src/**` include), cross-checked against
  Glob; 99 of 99 OK (5.2 `rc=0`; 5.3 three batches, `BAD 0`).
- **Main gate:** `GATE OK categories=10 records=5`, consumer check `GATE
  OUTPUT VALID records=5`. Four test files were gated and Blocked (auth
  mode reports them as Blocked, not findings). Values weren't inspected.
- **Counts:** candidates 99 · scanned 98 (one binary skipped) · eligible 94
  · examined 40 · blocked 5.
- **Requirements** were read fresh from allowlisted docs (security.md §3–§5,
  PRD US-1, architecture §1, §4–§6, §12). testing.md wasn't read.
- **Result:** 1 security finding (Potential risk, P3, A01), 3
  documentation-drift entries, 10 statically verified controls. Totals
  reconciled. Details stay in the terminal report.
- **Static verification vs. executed tests:** all 10 controls are
  *Static* (code read this run). Related test names were listed from 6
  allowlisted test files with single-file Grep. **No test was executed.**
  Tests for the token-integrity control were in gated files, so that
  control has no test evidence.

### Observed in V2-F
- **Defect: narrow name listings with exclusions return nothing.** On Git
  2.46.0.windows.1, `git ls-files --cached --others --exclude-standard`
  with narrow includes (explicit files, `docs/*.md`,
  `src/app/**/route.ts`) plus exclusion pathspecs returned **no names and
  `rc=0`** for files that exist. A broad include (`':(glob)src/**'`, or
  adding `.`) listed them. The root cause wasn't investigated. Effect: the
  dry run's Discover counts were unknown, and five Discover listings in the
  real audit were unreliable. The Evidence listing used a broad include and
  matched Glob, but that completeness check is instruction-level, Glob was
  truncated at 100 entries, and paths outside `src/`, `docs/`, `prisma/`
  and `next.config.ts` weren't candidates. **Not fixed** (no redesign).
- **Deviation: broad Grep cross-check.** In the real audit, one Grep in
  `files_with_matches` mode for `"use server"` was pointed at the `src`
  directory to cross-check `git grep -l`. That search space included the
  four gated files and gitignored generated files. Output was file names
  only, and no gated file matched, but the search didn't explicitly exclude
  gated or non-allowlisted files. The allowed wording ("Grep across
  directories") permitted it.
- **Deviation: one 5.2 call piped through awk.** It hid Git's exit code. It
  was re-run in the exact documented form (`rc=0`, 99 entries).
- **Minimal instruction added (no redesign):**
  - SKILL.md Step 2: incomplete or truncated discovery is reported as
    **partial**, never as complete.
  - SKILL.md Step 3, safe-evidence §4 and discovery §4.1: search tools are
    never pointed at a directory, and gated or non-allowlisted files are
    never searched after the main gate, even in `files_with_matches` or
    `count` mode.
  - discovery §4.1 records the listing defect and requires a Glob
    cross-check.

  These are instruction changes only and haven't been re-run.

**Context.**
- v1 baseline: commit `51653de` (Issue #42, PR #43).
- The v2 work followed the SA-7.1 exploration and the SA-7.2 plan, as
  amended by human decisions (below).
- Each entry gives the observed v1 problem, the change, and its expected
  effect. "Expected" means not yet verified at runtime.

### V2-A: v1 archive
- The seven v1 files were written from the `51653de` Git blobs into
  `history/v1/`: `SKILL.v1.md`, `CHANGELOG.v1.md`, `references/`,
  `templates/`. A `history/README.md` was added.
- Verified for all seven: the raw (`git hash-object --no-filters`) and
  normalized hashes match the baseline blobs, and a byte count found 0 CR
  bytes.
- The five relative links in `SKILL.v1.md` resolve, and exactly one active
  `SKILL.md` exists.
- The hashes were re-verified after V2-B, V2-C and V2-D.

### Safety (V2-B)
- **V2-01 Exclusions on every content read.**
  - *Problem:* the v1 full audit read most source files through Bash
    `cat -n`, which skips Read deny rules. One import-tracing content search
    covered directories that included gated files.
  - *Change:* new `references/safe-evidence.md`. Content is read only with
    Read on single allowlisted files, and content-mode Grep only on one
    allowlisted file. Bash file reads are banned. The allowlist is built from
    the gate's scanned set, minus exclusions, gated files and path-check
    failures.
  - *Expected effect:* gated, restricted and session-export files never
    reach a content tool.
- **V2-02 Gate reliability.**
  - *Problem:* a batched per-category loop reported the last category's
    no-match exit as a failure, and could have hidden a real error in an
    earlier iteration.
  - *Change:* one approved Git Bash script that keeps each category's exit
    code (0 match, 1 none, anything else error) and validates the output
    format. It ends in `GATE OK` with exit 0 or `GATE ERROR` with exit 2, and
    never forces success. Stderr is suppressed. An invalid gate stops content
    inspection in that scope. The ten patterns are unchanged.
- **V2-03 Confirmation.**
  - *Problem:* a bare invocation started a full audit immediately.
  - *Change:* real `full` (including no arguments), `secrets` and `diff`
    audits ask through AskUserQuestion before any other tool call. A
    decline, no answer or an unclear answer stops the run. "Run a dry run
    instead" switches to dry-run mode and authorizes nothing real.
  - The npm approval (H4) stays separate, and neither approval carries over
    to another invocation.
- **V2-08 Redaction removed, path checks and coverage limits added.**
  - *Problem:* v1 allowed regex-redacted viewing of gated files, which can
    leak values the pattern doesn't fully match. It also didn't state that
    ignored and binary files aren't scanned.
  - *Change:*
    - gated files are Blocked in every mode, and redacted viewing and
      match line-number pipelines are removed;
    - lexical path rules, an index symlink check, and a PowerShell
      reparse-point check on the file and every parent;
    - `node_modules` content reads are removed;
    - a coverage-limits section: patterns, ignored and binary files, Git
      history, bootstrap trust, persistence, hard links, and changes between
      a check and a read.
  - The path checks are **documented but unverified until V2-E**.
- **Diff safety.**
  - *Problem:* v1 gated only changed lines, but diff output also shows
    context lines and hunk headers.
  - *Change:* `-G` is no longer used. Each version a bucket's diff will show
    is gated whole (`MB`, `HEAD`, index, working tree), and both rename paths
    are checked. Inspection uses `--no-ext-diff --no-textconv -U0`. There's
    no history or `gh pr diff` fallback.
- **Bootstrap set.** Only the skill's active files, which are trusted
  instructions read before any gate because they define it, and
  `.claude/settings.json`, which is read only after a count-only bootstrap
  gate. Preloaded project docs are treated as untrusted and are never
  evidence until they're re-read after the main gate.
- **D-1:** `git show *`, `git log *` and `git diff *` are auto-allowed by
  the project settings. The unsafe forms are banned by instruction only, and
  that's stated in the skill.
- **D-2:** Bash reads are banned (see V2-01).
- **D-3:** the session-export exclusion was narrowed to `logs/**`,
  `**/*.jsonl` and transcript paths. Auth source files such as
  `session.ts` stay eligible.
- **D-4:** `git grep` is limited to `-c` and `-l`.
- **D-5:** the ambiguous gated-file wording was removed.
- **D-6:** one exclusion rule now covers multi-path commands, and
  single-path commands are allowed only for allowlisted or diff-approved
  paths.
- **D-9:** persistence in local transcripts and tool-result files is
  documented as a limitation.
- **Safety boundary:** the skill states that its safeguards are instructions,
  not a sandbox. Only Claude Code permission rules and `git grep -c`/`-l`
  output limits are technically enforced.

### Workflow (V2-C)
- **V2-04 and V2-05 Fresh evidence (H12).**
  - *Problem:* v1 dry runs reused an earlier inventory and relied on
    reference files already in context.
  - *Change:* nothing from earlier in the conversation is reused: inventory,
    branch and HEAD, status, exclusions, gate results, allowlists, evidence,
    reference contents, counts or approvals. References and templates are
    re-read every invocation, and section reads are allowed (D-10). Reports
    list "Loaded this run" and "Searches this run".
- **V2-06 Counts.**
  - *Problem:* a v1 dry run reported 44 test files when there were 42.
  - *Change:* every count cites a search from this invocation, totals are
    deduplicated, incomplete searches make a count partial or unknown, and
    files are counted separately as candidates, scanned, eligible, examined
    and blocked.
- **V2-07 Discover vs. Evidence.**
  - *Problem:* the v1 discovery table mixed filename searches with content
    tasks (exported functions, the proxy matcher, import tracing), which
    contradicted the dry-run rules.
  - *Change:*
    - Discover covers names, counts and metadata through Git `ls-files` and
      `git grep -l`, with exclusions applied.
    - Evidence covers content work, in real audits only, after the main
      gate and the allowlist.
    - Checklist items are labeled, and nothing is inferred from filenames.
- **D-8:** the historical "v1 authoring" inventory hints were removed.
- **Dry runs, a deliberate change from v1:** a dry run may run the
  count-only **bootstrap gate** over the skill files and settings, and
  nothing else gate-related. Project requirements are listed as **deferred**,
  never inspected. The dry-run template keeps "executed this run" apart from
  "would run in a real audit".

### Reporting (V2-D)
- **V2-09 Separate totals and risk dimensions.**
  - *Problem:* the v1 report counted 8 documentation-drift items among
    "23 actionable items". It also ranked unverified credential-pattern
    matches as P1 "Critical (assessed as if real)", which read like
    confirmed exposures.
  - *Change:*
    - The report gives three separate totals (security findings,
      documentation drift, verified controls) and checks them against the
      entries before printing.
    - Five distinct dimensions: status, severity (or conditional or
      published severity), assessed risk (which may be Undetermined),
      confidence, and priority plus verification urgency.
    - Unverified credential matches are labeled as such, with a conditional
      severity, Undetermined risk, Low confidence and Urgent private
      verification. They land in P2 by rule, never P1 just because the
      repository is public.
    - Unknown dependency reachability never implies Low risk.
- **V2-10 Readability and remediation.** Tables are limited to five columns
  or switch to one block per item. There's a compact verified-control table,
  numbered remediation steps with an observable "Done when" check, manual
  verification owners, and drift entries with verification steps.
- **Evidence handling.**
  - Gated files are never quoted or masked.
  - A sensitive-looking excerpt from an allowlisted file is omitted and
    raised as a manual-verification item.
  - Sanitizing output is stated not to replace safe collection.
  - Public summaries exclude credential values, personal data,
    session-export content and actionable detail of unresolved findings.
- **D-7 Versions.** The active skill and templates now say v2. Obsolete v1
  wording was removed ("no Git Bash for redaction", "deferred in v1",
  `[REDACTED]` excerpt masking). v1 references stay in this changelog and in
  `history/`.

### Bootstrap and pre-scan path safety (V2-D.1, corrective)
- **Defect (found in the V2-D review):**
  - `.claude/settings.json` was read after the count-only bootstrap gate,
    with no path validation first. The section 5 checks were tagged
    Evidence-phase only, so a linked, junctioned or redirected settings path
    (or parent directory) wouldn't have been caught before the read.
  - The bootstrap and main gates also took directory pathspecs, and the
    Discover `git grep -l` pattern searches ran in dry runs. So scanners
    could reach paths before their eligibility was established.
- **Correction:**
  - **Bootstrap sequence**, in every run including dry runs:
    1. the root from preflight;
    2. explicit target listing (`git ls-files`), with
       `.claude/settings.json` required exactly once;
    3. lexical, index-symlink and PowerShell reparse/containment checks on
       every target and its parents;
    4. the count-only bootstrap gate on the **validated explicit files**;
    5. only then the settings read.

    Any failure, unavailable or refused check, or incomplete output blocks
    bootstrap. Settings aren't read, and content inspection is Blocked for
    the run.
  - **Main gate order:** candidate name listing, then path validation (in
    batches of at most 40 for 5.3), then pattern searches, then the main
    gate, then the scanned set. Each scan gets only the explicit validated
    files.
  - **Diff:** working-tree versions are path-checked before they're gated.
    Index and revision versions come from Git's object store.
  - **Dry runs:** limited to bootstrap path checks plus name-only Discover.
    Pattern searches (`git grep -l`, Grep across files) moved to real audits,
    after path validation.
  - The dry-run and audit templates now record the path-validation outcome.
- **Acknowledged:** `SKILL.md`, the two procedure references and any
  harness-preloaded instructions are loaded before any check can run. The
  checks don't detect hard links or changes between a check and a read.
  Whether Git for Windows traverses junctions while listing names is
  unverified.
- **Status:** changed in the instructions only, **unverified until V2-E**.

### Regression testing (V2-E.2 and V2-E.2.1, synthetic repository)
**Environment.** An isolated repository outside BorrowLoop:
- `main`; baseline `597743c`, then `0131f87` after the human committed three
  fixtures; no remotes; `core.autocrlf=false`, `core.symlinks=false`.
- Git 2.46.0.windows.1, Windows PowerShell 5.1.
- Fabricated fixtures only. Credential-shaped values were built from filler
  characters.
- Commands were extracted verbatim from `safe-evidence.md` and
  `discovery.md`, with placeholder lines filled in. Every substitution was
  diffed against the documented block.
- The human made every Git mutation. BorrowLoop files were unchanged during
  test execution.

| Test | Result | Kind | Summary |
|---|---|---|---|
| T0 frontmatter | PASS | executable | The existing `js-yaml` (via node) parsed exactly 4 keys; `disable-model-invocation` is the Boolean `true`; `$ARGUMENTS` appears once |
| T1 all ten categories | PASS | executable | Each category gave `MATCH` on exactly its own file, `GATE OK`, exit 0; no values or stderr in the output |
| T2 final-category NONE and a clean set | PASS | executable | A final `NONE` doesn't fail the gate; a clean set gives 10 `NONE`, `GATE OK`, exit 0 |
| T3 real errors | PASS | executable plus fault-injected | A real rc 128 (pathspec outside the repo) gives all `ERROR`, `GATE ERROR`, exit 2. A one-line invalid-regex fault in the first or a middle category isn't masked by later successes. Fault injection doesn't prove every real failure is handled |
| T3b malformed and incomplete output | **FAIL** in V2-E.2.1 (the completeness requirement), retested in V2-E.2.2 (see below) | fault-injected plus harness | A `git` shim in front of the unmodified script: empty, garbage, unexpected and rc 2 outputs all gave `ERROR` and `GATE ERROR`. **Defect:** the header-based rule accepted the valid baseline S0, but also accepted **all seven** corrupted cases S1–S7: one record removed, a `MATCH` with no records, one of two records missing, an `ERROR` line with `GATE OK`, a duplicate record, a record under `NONE`, and a record moved to another category |
| T4 scanned-set coverage | PASS (coverage established) | executable | Non-empty text is listed, tracked or untracked. Empty, binary and gitignored files (even when named explicitly) aren't listed. Binary blobs are skipped by the gate in the working tree, the index and revisions (`NONE`), so `NONE` isn't coverage. Names with spaces are unquoted; non-ASCII names are quoted |
| T5 exclusions and allowlist | **PARTIAL** | executable plus manual | The documented candidate, Discover and bootstrap listings excluded every restricted fixture (including case variants), session exports, history and nested references; `session.ts` was kept; `settings.json` was listed once. Deny-rule conversion and allowlist construction are model-applied (manual), and §5.2/§5.3 path checks are pending T6, so eligibility is provisional |

**Proposed correction (V2-E.2.1), corrected accounting.** A harness
prototype in the proposed format accepted the valid baseline P0 and detected
the seven cases P1–P7. Those were one record removed, a `MATCH` with no
records, one of two records missing, an `ERROR` line with `GATE OK`, a
duplicate record, a record under `NONE`, and **truncation before the
verdict**. The moved-record case wasn't separately demonstrated by that
prototype. It was a substitute, not proof of the production procedure. An
earlier summary that said "8 of 8" and "all 8" for these counts was wrong.

**Correction implemented and retested (V2-E.2.2, approved by the human).**
- **Producer (the gate script):**
  - per category: `MATCH files=N` with exactly N records, or `NONE files=0`,
    or `ERROR` with no records;
  - the verdict is `GATE OK categories=10 records=T`.
  - The script validates every captured line itself: a positive count; the
    exact revision prefix, which Git really emits as `HEAD:path:count` or
    `<sha>:path:count` (observed), required and stripped; the path must be a
    submitted path; no duplicate within a category.

  The counts are computed from Git's captured output.
- **Consumer (a new documented check):** the model pastes the output exactly
  as received. The check reconciles the headers (names, order, statuses),
  the per-category counts, the total, submitted paths, duplicates, `ERROR`
  lines, the single verdict and any trailing output.
- **Results:**
  - actual script: T1, T2a, T2b, a multi-category file (C15), the index and
    revision modes, and the real T3a failure all behaved as expected;
  - one-line regex faults (FI1 and FI2) aren't masked;
  - 11 producer fault injections (empty, garbage, rc 1 with output, rc 2, a
    single-category fault, duplicate, a path outside the set, a zero count,
    a quoted path, a revision record with or without its prefix) failed
    closed, or were correctly accepted with the prefix stripped;
  - the actual consumer check gave the expected verdict on all 15 required
    cases (2 valid, and 13 corruption types in 17 variants) and on 4 earlier
    truncation cases.
- **Not verified:** that the model pastes the received output faithfully
  (model-driven; V2-F). A **real** revision-mode `MATCH` (no tracked
  matching fixture exists; prefix handling was shown by fault injection plus
  observed Git output). Truncation during delivery can be detected, but lost
  records can't be recovered.

**Documentation corrections applied in V2-E.2.1:**
- the observed coverage table;
- "`NONE` and `GATE OK` aren't coverage";
- unquoted names with spaces must still fail the lexical rule;
- deny-rule conversion and allowlist construction are instruction-level;
- the skill's own `CHANGELOG.md` and `history/**` are excluded from
  application evidence (and from the Discover fixed exclusions);
- the count-only log exception was restated;
- the known completeness limitation was recorded in `safe-evidence.md` §2
  and §8, and in the report template. V2-E.2.2 replaced it with the
  implemented correction and its remaining limits.

### Consolidated verification (V2-E.3, synthetic repository)
Same isolated repository and rules as V2-E.2. Commands were extracted
verbatim from the active skill files, with only placeholders filled in.

| Test | Result | Kind | Summary |
|---|---|---|---|
| T6a index symlink check | PARTIAL | executable | `git ls-files -s` works and reports 100644 for regular tracked files. A real mode-120000 entry needs a human Git step (not run) |
| T6b junctions and containment | **PASS after fix** | executable | **Defect found:** the documented PowerShell check used `Split-Path -LiteralPath … -Parent`, which fails in PowerShell 5.1, so every file came back `ERROR`. That failed closed, but made the skill unusable. **Fixed** with `[IO.Path]::GetDirectoryName`, plus progress output suppressed. Re-test: normal files `OK`, a file under a directory junction `REPARSE_POINT`, a missing file `NOT_A_FILE`, `../` gives `OUTSIDE` |
| T6b observation | — | executable | Git for Windows **lists untracked files through a directory junction** (`src/jlink/inside.ts`). That confirms the validate-before-scan order is necessary |
| T6b file symlink | NOT RUN | — | Creating file symlinks needs admin rights or Developer Mode (`mklink` was refused) |
| T6c junctioned `.claude` during bootstrap | PASS | executable | All 4 bootstrap targets came back `REPARSE_POINT`, so bootstrap is Blocked. The temporary junction was removed and the folder restored |
| T6d output completeness | PASS | executable plus harness | A missing `CHECKED` line, status line or rc line, or a stray line, makes the result incomplete. The 40-path batch encodes to 8,252 characters (the limit is 32,767). Completeness rules were tightened in §5.3 |
| T5 path-check completion | PASS | executable | All 8 provisionally eligible files from V2-E.2.1 passed §5.2 and §5.3 |
| T7 deny-rule forms | MANUAL | review | Under §3, `Read(**/.env)` and similar are supported. `Read(//abs)`, `Read(~/x)`, `Read(./x)`, `Read(/x)`, `Read(src/{a,b})`, `Read(**/[ab].txt)` and a bare `Read` are unsupported and block the run. The conversion is model-applied, so V2-F needs to confirm the behavior |
| T9 missing lines | PASS (gate, path check) | executable plus harness | The gate is covered in V2-E.2.2, and the path check in T6d. The scanned-set list has no count, but a lost name only removes eligibility, so it fails safe |
| T10 Discover patterns | PASS | executable | All 16 documented `git grep -E` patterns compile, match a fabricated positive sample, and don't match a negative one |
| T11 npm output | **PASS after restriction** | executable (fixtures only) | **Gap closed:** raw npm output used to reach the model. Now `npm audit --json` runs only through a documented PowerShell `ConvertFrom-Json` filter that prints allowlisted, character-checked fields, and `withheld` for anything else. Clean, advisory, hostile, error, truncated, incomplete and empty fixtures all behaved as expected with **0 leaks**. **`npm ls` and `npm explain` are removed in v2.** No real npm command was run |
| T12 priority mapping | **PASS after fix** | harness | **Gap found:** 3 of 30 combinations (Undetermined risk with an Info severity) had no priority. **Fixed:** they're now P4. npm severity names are mapped onto the rubric levels |
| T13 integrity | PASS | executable | See the final checks |
| T14 Read deny rules and Grep/Glob, link following | NOT VERIFIED | — | No offline way to verify. The skill already treats this as unverified and bans Bash reads |
| T8 diff buckets | **NOT RUN** | — | Needs synthetic commits, a branch and staged changes made by the human. The `diff` scope is marked "not yet verified" in `safe-evidence.md` §6 |

**Evidence of v1 → v2 improvement** (from the v1 run and these tests):
- **Redacted viewing:** v1 allowed redacted viewing of gated files. v2
  blocks them entirely.
- **Bash reads:** v1 read source through Bash `cat`. v2 reads only with Read
  on allowlisted files.
- **Gate exit status:** v1's batched gate reported a misleading aggregate
  exit. v2 keeps each category's exit code and checks completeness at the
  source and in the received copy (T1–T3b).
- **Stale inventory:** v1 dry runs reused stale inventory (44 vs. 42
  tests). v2 requires fresh, logged searches and counts (H12).
- **Inflated totals:** v1 counted drift and unverified credential matches
  in its 23 "actionable items". v2 separates the totals and labels
  conditional severity.
- **Path safety:** v1 had no path safety. v2 rejects junctions and
  out-of-repository paths before any scan (T6), including during bootstrap.
- **npm output:** v1 printed raw npm output. v2 filters it, and drops
  `npm ls` and `npm explain` (T11).

### Human decisions recorded
- **Q1:** add `references/safe-evidence.md`.
- **Q2:** a narrow bootstrap set. Preloaded docs aren't safe, project docs
  are gated before being read in real audits, and they're deferred in dry
  runs.
- **Q3:** an unsupported or unclear deny-rule conversion blocks content
  inspection for the whole run.
- **Q4:** unverified credential matches get manual verification first, with
  conditional severity, assessed risk and confidence kept separate.
- **Q5:** synthetic tests run in an isolated temporary repository, in V2-E
  only. The human performs every Git mutation there.
- **Q6:** combined preflight commands are allowed only with per-command exit
  codes.
- **Q7:** `node_modules` content reads are removed.
- **V2-C decisions:** the count-only bootstrap gate is approved for dry runs;
  "run a dry run instead" is approved as a confirmation option and
  authorizes no real audit.
- **Shared permission hardening** of `.claude/settings.json` (for example,
  deny rules for Bash reads or unsafe `git show` forms) stays a separate
  team decision, outside Issue #42.

### Process deviation during implementation (V2-B)
- During V2-B static verification, one command redirected awk output into a
  temporary file outside BorrowLoop (`/tmp/v2b_blocks.sh`, 3,568 bytes). It
  held only the non-sensitive bash snippets from `safe-evidence.md`, and
  creating it broke the "no file changes" boundary.
- The file was deleted straight away, and its absence was confirmed.
- The syntax check was then repeated through pipes, without creating a file.
- V2-C and V2-D used pipe-only static checks, and no recurrence was observed.

### Verification status
- **Static checks completed (V2-B to V2-D):**
  - links and section references resolve;
  - no redacted-viewing or line-number pipeline remains;
  - content-mode searches are limited to single allowlisted files;
  - gate failures stop content inspection;
  - Step 1.5 confirmation comes before preflight, and H4 is intact;
  - the H12 coverage, the Discover and Evidence separation and the dry-run
    limits are present;
  - historical hints are removed;
  - `SKILL.md` stays under 500 lines;
  - the archive hashes match;
  - nothing is staged.
- **Syntax checks completed:** `bash -n` (parse only, nothing executed)
  returned rc=0 for every bash block, re-run after V2-E.3: eight in
  `safe-evidence.md` (including the consumer check and the npm filter) and
  three in `discovery.md`. The PowerShell blocks were also executed in
  V2-E.3, which covers more than a parse check. The PowerShell block hasn't
  been parse-checked.
- **Count-only self-check:** the ten patterns over the skill directory
  returned rc=1 (no matches). That's pattern-based, not proof of absence.
- **Not executed:**
  - T8 diff-bucket tests (they need a human Git setup);
  - the "run a dry run instead" confirmation branch (invocation 2 tested
    only "Stop");
  - a re-run after the V2-F instruction additions.
- **Executed in V2-F:** argument rejection, the full-audit confirmation
  decline, an auth dry run (partial) and the real auth audit (second
  demonstration). Fresh reloading, deny-rule conversion, allowlist
  construction, the consumer-check paste and report reconciliation were
  exercised once, on this repository only.
- **Resolved in V2-E.2.2 and V2-E.3:**
  - gate record completeness;
  - bootstrap path validation, including a junctioned `.claude`;
  - junction traversal (confirmed, and handled by the order);
  - the PowerShell check (fixed and executed);
  - scanned-set coverage;
  - documented gate behavior;
  - incomplete-output handling;
  - npm output (filtered, with `npm ls` and `npm explain` removed);
  - Discover patterns;
  - the priority-mapping gap.
- **Still open:**
  - **T8, the diff buckets**, so real `diff` audits are blocked in v2;
  - a real revision-mode `MATCH` and a real mode-120000 entry (they need
    the human Git setup);
  - file symlinks (they need privileges);
  - T14, Read deny-rule coverage of Grep and Glob, and link following;
  - the real `npm audit` pipeline (only fixtures were tested);
  - the Git name-listing defect (V2-F), handled only by a partial-coverage
    rule and a Glob cross-check;
  - model-driven steps stay instruction-level: one successful run doesn't
    prove they'll always be followed (V2-F showed two deviations).

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
