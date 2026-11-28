# Checkpoint report template

This builds on the format in `docs/testing.md` §6. Use it at the end of every RED, GREEN and REFACTOR step, then stop.

Rules for filling it in:

- Copy commands and results exactly as printed.
- Write "none" or "not run at this checkpoint" rather than leaving a line out.
- Never estimate counts.

```
Checkpoint: RED | GREEN | REFACTOR (cycle N of M)
Issue: #<n> <title>
Branch: <branch>    HEAD before this step: <short sha>
Test mode: isolated (<database the human confirmed>) | unit-only

Command(s):
  <exact command lines>
Result, as printed:
  <Vitest "Test Files" and "Tests" summary lines>
Tests: <executed> executed · <passed> passed · <failed> failed · <skipped> skipped
Not run (database safety): <files and commands, with the reason> | none

Expected failures (RED only): <test names, each failing on an assertion> | none
New tests that passed at RED: <test names, with why: behaviour already exists (where) | a placeholder can't fail it> | none
Baseline failures (already there at preflight): <test names> | none
Regressions caused by this change: <test names, with cause> | none

Typegen (npx next typegen, run before tsc): <result> | not used by this project | not run at this checkpoint
Type-check (npx tsc --noEmit): <result> | not run at this checkpoint
Lint: <result> | not run at this checkpoint

Output excerpt (actual):
  <relevant lines>

Files changed:
  - <path> (new | modified)

Suggested commit message:
  <type(scope): summary (red|green) (#n)>

Waiting for: the human's commit. Claude performs no Git mutations.
```

## Commit message formats

These follow the established history (for example `21a9834`, `0247c96` and `b49128e`):

- RED: `test(<scope>): <behaviour> (red) (#<n>)`
- GREEN: `feat(<scope>): <behaviour> (green) (#<n>)`
- REFACTOR: `refactor(<scope>): <change> (#<n>)`
- Characterization test that passed at RED because the behaviour already exists: `test(<scope>): characterize <behaviour> (#<n>)`

## When there's no refactor

```
Checkpoint: REFACTOR (cycle N of M)
No refactor needed: <one-line reason>. No files changed, so there's nothing to commit.
Tests: <the result from the GREEN checkpoint is still current>
```
