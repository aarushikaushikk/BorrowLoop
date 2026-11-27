# /add-feature changelog

Each version entry records what changed, why, and the evidence behind it. The active skill is always `SKILL.md` in this folder. There is only one `/add-feature` command.

## v1 (2026-11-26, Issue #13)

**Status:** active. The commit SHA will be recorded here once the human has committed and merged v1.

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
