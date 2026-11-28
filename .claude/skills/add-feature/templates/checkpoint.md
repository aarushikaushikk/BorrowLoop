# Checkpoint report template

This builds on the format in `docs/testing.md` §6. Use it at the end of every RED and GREEN step, and at REFACTOR only when a refactor changed files. Then stop.

Rules for filling it in:

- Copy commands and results exactly as printed, whether Claude or the human ran them.
- Write "none", "not reported" or "not run at this checkpoint" rather than leaving a line out.
- Never estimate counts. A command that's waiting on the human is "awaiting human result", never a pass.

```
Checkpoint: RED | GREEN | REFACTOR (cycle N of M)
Issue: #<n> <title>
Branch: <branch>    HEAD before this step: <short sha>
Test mode: isolated (<database the human confirmed; identity check: matched on <date>>) | unit-only

Evidence (one row per command):
  | Executor | Environment | Command | Result, as printed | Exit code |
  | Claude | Claude Code shell | <exact command> | <Vitest "Test Files" / "Tests" lines, or tool output> | <code> |
  | human | Windows CMD | <exact command> | <pasted lines> | <code, or "not reported"> |
  | — | — | <command> | awaiting human result | — |
Tests: <executed> executed · <passed> passed · <failed> failed · <skipped> skipped
Environment failures: <command, exit code, error excerpt; moved to human execution> | none
Not run (database safety): <files and commands, with the reason> | none

Expected failures (RED only): <test names, each failing on an assertion> | none
Test corrections before the RED commit: <test, what was wrong, approved by the human> | none
New tests that passed at RED: <test names, with why: behaviour already exists (where) | a placeholder can't fail it> | none
Baseline failures (already there at preflight): <test names> | none
Regressions caused by this change: <test names, with cause> | none

Typegen (npx next typegen, run before tsc): <result> | not used by this project | not run at this checkpoint
Type-check (npx tsc --noEmit): <result> | not run at this checkpoint
Lint: <result> | not run at this checkpoint

Refactor (GREEN only): <the planned improvement> | none needed: <one-line reason>

Output excerpt (actual):
  <relevant lines>

Files changed:
  - <path> (new | modified)

Suggested commit message:
  <type(scope): summary (red|green) (#n)>

Waiting for: <the human's commit | the human's pasted output and exit code>. Claude performs no Git mutations.
```

## Commands for the human to run

When the test runner can't execute in Claude's shell (SKILL.md §4.2), include one block for this checkpoint:

```
cd /d <repository root>
<command 1>
echo Exit code: %ERRORLEVEL%
<command 2>
echo Exit code: %ERRORLEVEL%
```

Ask the human to paste the full output. Fill the evidence rows from it only after it arrives.

## Commit message formats

These follow the established history (for example `21a9834`, `0247c96` and `b49128e`):

- RED: `test(<scope>): <behaviour> (red) (#<n>)`
- GREEN: `feat(<scope>): <behaviour> (green) (#<n>)`
- REFACTOR: `refactor(<scope>): <change> (#<n>)`
- Characterization test that passed at RED because the behaviour already exists: `test(<scope>): characterize <behaviour> (#<n>)`

## When there's no refactor

There's no separate REFACTOR report or commit. The GREEN report's `Refactor:` line says "none needed" with the reason, and the next cycle starts after the GREEN commit.
