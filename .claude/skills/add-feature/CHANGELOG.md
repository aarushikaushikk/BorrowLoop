# /add-feature changelog

Each version entry records what changed, why, and the evidence behind it. The active skill is always `SKILL.md` in this folder. There is only one `/add-feature` command.

## v2 (2026-11-28, Issue #13)

**Status:** active. The second real demonstration is **pending**. v2 hasn't been run on an issue yet, and no v2 execution evidence exists. The human will supply the annotated logs and screenshots separately.

**v1 archive:** `history/v1/` holds verbatim copies of v1's `SKILL.md` (as `SKILL.v1.md`, so it doesn't register as a command) and its three templates, from commit `bbf3491`. `history/v1/README.md` lists the blob hashes. The v1 entry below planned `history/SKILL.v1.md`; the `v1/` folder was used so the templates sit beside it.

### Evidence: first real run of v1

US-3 (availability), issue #8, PR #44. Final implementation commit `54cef33`. Results as reported by the human:

- Three RED/GREEN/REFACTOR cycles: nine completed TDD checkpoints and eight human commits.
- 201 new unit tests and 31 new integration tests. 713/713 unit tests and 820/820 regression tests across 49 files passed. All four real-PostgreSQL concurrency tests passed.
- Unit-only coverage: 96.21% statements, 95.34% branches, 97.54% functions, 96.32% lines.
- Lint, typegen, TypeScript and the production build passed. The core manual browser checks passed.
- Not completed: separate-account browser privacy verification. The automated privacy tests passed.

### Changes from v1, and the US-3 observation behind each

| v2 change | US-3 observation | Where |
| --- | --- | --- |
| Environment failures (suite didn't load) are told apart from behavioural RED failures. A broken runner is recorded once with its exit code, not retried, and handed to the human as exact Windows CMD commands | Vitest failed at suite-loading time in Claude Code's shell, while the identical commands succeeded in native Windows CMD | SKILL.md §4.2, §12; checkpoint template |
| Reinstalling dependencies (`npm ci`, `npm install`) needs approval, and a suite-load failure isn't treated as evidence of broken dependencies | An incorrect dependency diagnosis led to an unnecessary `npm ci` | SKILL.md §2 rule 3, §4.2 |
| Checkpoint and final-report templates record executor, environment, command, result and exit code, accept human-pasted results, and mark pending results as "awaiting human result" | The v1 templates didn't accommodate human-executed verification | templates/checkpoint.md, templates/final-report.md |
| Intake and plan share one stop when nothing blocks. Cycles are sized to the work. The commit check opens the next step instead of being its own exchange. Named approvals can be given with the plan | Checkpoint and confirmation overhead made the workflow unnecessarily long | SKILL.md §6 step 4, §8, §9, §11 |
| No REFACTOR report or commit when there's nothing meaningful to change. The GREEN report states "none needed" with a reason | Cycle 3 needed no meaningful refactor, so no artificial refactor commit was made | SKILL.md §9; checkpoint template |
| A genuinely wrong test can be corrected before the RED commit, with a short explanation and the human's approval. Weakening tests to reach GREEN stays forbidden, and GREEN still runs the full regression suite | Two legitimate test corrections were needed before RED commits | SKILL.md §2 rule 5, §9 RED table |
| Isolated mode names the accepted environments (WSL, native, Docker, PGlite, CI), requires an identity check before migrations or database tests, and allows reuse of an already verified database. Shared databases still need explicit authorization | Docker was unavailable. An isolated PostgreSQL 18.6 in Ubuntu on WSL 2 supported all integration and concurrency tests | SKILL.md §4.1, §12; plan template |
| Unit, integration, concurrency, coverage (with its scope), static component and real browser evidence are reported separately. Concurrency and browser checks are planned only when relevant. Unexecuted checks are listed with a reason and leave the affected criterion at NEEDS VERIFICATION | The run needed clearer lines between static component tests, real-database tests and browser checks. Separate-account browser privacy verification wasn't completed | SKILL.md §8, §10; plan and final-report templates |
| A review framework named in the definition of done (for example C.L.E.A.R.) is listed as a human step with the human's or course's definition. The skill doesn't define it | The US-1 definition of done lists "PR reviewed with C.L.E.A.R." (`logs/us-01.md`) | SKILL.md §10 step 8; final-report template |

### Unchanged

The invocation interface and frontmatter, the human-only Git policy, `.env*` and secret handling, database safety classification and unit-only mode, ownership and TDD checks, the dry run, and RED/GREEN boundaries with a human commit at each.

### Not addressed in v2

The optional-file probe noted under v1 ("Possible future improvement") wasn't a problem in the US-3 run, so it stays unchanged.

## v1 (2026-11-26, Issue #13)

**Status:** superseded by v2. Committed in `bbf3491` and archived verbatim in `history/v1/`. First real run: US-3, issue #8, PR #44 (see v2).

### What v1 does

`/add-feature <issue-number>` implements one GitHub issue with strict red-green-refactor TDD, in these phases:

1. **Preflight:** branch, repository state, test mode and baseline.
2. **Intake:** acceptance criteria, ownership, TDD designation, dependencies and open decisions.
3. **Read-only exploration.**
4. **An approved plan.**
5. **RED, GREEN and REFACTOR cycles,** each ending in a checkpoint report and a human commit.
6. **Final verification:** acceptance criteria table, definition of done, the security checklist and unresolved issues.

`--dry-run` gives a read-only demonstration that can't move on to implementation.

### Design choices and the reasons for them

| Choice | Reason |
| --- | --- |
| The human makes every commit. Claude stops at each checkpoint with a suggested message | The Git rules in `CLAUDE.md` and the deny rules in `.claude/settings.json`. Issue #13's "commits red" means human-made RED, GREEN and REFACTOR commits. |
| `disable-model-invocation: true` | The workflow edits code, so it should start only when the human types `/add-feature`. |
| No `` !`command` `` injection; `gh` runs as a normal, visible tool call | Injected commands run before Claude sees the skill and abort the whole invocation if a permission check fails. A visible call can fall back to manual intake instead. |
| No `allowed-tools` | Keeps the existing permission settings unchanged. Test runs still ask for approval. |
| Database safety before every test command, with an isolated mode and a unit-only mode | `docs/testing.md` §4 and the human's instruction. Isolation needs explicit human confirmation; a loopback listener alone isn't enough. |
| Every command is classified before it runs. A build or any other command that can reach a database runs only in a verified safe environment; otherwise it's reported as "not run (database safety)" | Pre-release correction from the human's review of the staged diff. The draft only stopped after a build had logged a connection attempt, which is too late. `next build` loads `.env*` files Claude can't inspect. |
| Unit-only mode traces indirect imports, setup files and configuration, not just a text search | Pre-release correction from the same review. A search for database-related strings isn't a guarantee of isolation, so the run stops if safe unit-only execution can't be established. |
| The type-check always runs `npx next typegen` before `npx tsc --noEmit` | Pre-release correction from the same review. Generated route types go stale when routes change. CI already runs them in this order (`.github/workflows/ci.yml`). While v1 was being designed, `tsc` failed on a stale `.next/types/routes.d.ts`. |
| Unit-only mode finds database-capable test files fresh each run instead of excluding only `prisma/**` | While designing v1 we found that `src/lib/item-photos.test.ts` also opens a real database connection when `TEST_DATABASE_URL` is set, so a fixed `prisma/**` exclusion would have missed it. `vitest.config.mts` can load that URL from `.env.test`, which Claude can't inspect, so `npm test` is never run in unit-only mode. |
| Repository state is read at run time (scripts, CI workflow, schema, config) | Limitations such as "CI has no test step" can change. They're reported as found, not hard-coded. |
| RED placeholders marked `RED placeholder (cycle N)` | The US-2 convention (commits `21a9834`, `492a70a`): tests should fail on assertions, not on import errors. |
| A test that passes at RED is reported and explained, never forced to fail | `logs/us-02.md` (US-2 cycle 2): a boolean placeholder couldn't fail every case, and that was reported honestly. |
| Targeted tests at each checkpoint. GREEN and REFACTOR add the full suite, type-check and lint. Final verification adds coverage, typegen and build | Strict evidence at every step without rerunning everything at RED. RED adds a full run only when it touched existing source. |
| Ownership: an assignee matching the developer is enough. A stale `owner:tbd` label is reported, not blocking | The human's decision during planning. A missing or conflicting owner stops the run. |
| Rules link to `CLAUDE.md` and `docs/*` rather than copying them | Avoids copies drifting apart from the originals. |

### Exercised before release

Two invocations on the skill's own branch (`feature/13-add-feature-skill`), on 2026-11-27 UTC. Both were read-only, with no files changed and no tests or builds run.

- **Registration:** `/add-feature` registered as a slash command and loaded with `$ARGUMENTS` substituted ("Invoked with: `8 --dry-run`").
- **Issue retrieval:** for `/add-feature 8 --dry-run`, `gh issue view 8 --json …` and `gh api user --jq .login` both succeeded. Intake quoted the acceptance criteria and confirmed ownership: the assignee `pranav-sirnapalli` matched the login, with the label `owner:pranav`. It reported the TDD designation as needing confirmation because there's no `tdd` label.
- **Dry run:**
  - It reported the wrong branch for #8 and the untracked `.claude/skills/` without blocking, as §3 specifies.
  - It reported that CI has no test step.
  - It ended with the required "Dry run complete…" line.
- **Missing argument:** `/add-feature` with no arguments ("Invoked with: ``") asked for an issue number or a pasted issue. It didn't assume #8 from the previous run.

### Still untested in practice

- the manual issue-text fallback when `gh` fails
- real TDD execution: RED, GREEN and REFACTOR checkpoints and the commit check between them
- unit-only mode, including the exclusion command on Windows
- the templates in an actual run

Real runs will show which of these need to change. Their evidence will go in `logs/add-feature/`.

### Possible future improvement (not implemented)

During the dry run, the preflight probe for E2E tooling, `ls … playwright.config.* 2>&1`, exited with code 2 (`ls: cannot access 'playwright.config.*': No such file or directory`). The tool summary therefore showed a failed command. The result was still correct: the dry run reported "E2E: None installed". A later version could probe optional files in a way that doesn't fail, for example with Glob or `[ -e … ] && echo present || echo absent`. This is recorded as v2 evidence, not changed in v1.

### How v2 will be decided

Every v2 change must point to something that actually happened in a recorded run: the log section, the checkpoint, and a quoted excerpt. Nothing is changed just in case. Before v2 is written, v1 will be copied verbatim to `history/SKILL.v1.md`. That file isn't named `SKILL.md`, so it can't register as a second command.
