# Plan template

Fill in every section. Write "none" rather than deleting a section. If G1 didn't stop, put the intake summary first. Present the plan to the human, then wait for approval at G2.

```
Plan: #<n> <issue title>
Branch: <branch>        Focus: <focus or "whole issue">
Test mode: isolated (database confirmed by the human: <WSL | native | Docker | other; host:port, database, version>; identity check: <matched | pending>; reused from: <earlier run> | new) | unit-only (files excluded: <list>)
Test execution: Claude's shell | human, Windows CMD (reason: <environment failure seen or known>)
Build: verified safe environment (confirmed by the human: <what was confirmed>) | not run (database safety; runs in <where, e.g. CI> | nowhere)
```

## Acceptance criteria → tests

| AC | Behaviour | Test file | Level (unit / database integration / E2E, only if the tooling exists) | Cycle |
| --- | --- | --- | --- | --- |
| AC1 | | | | |

## Authorization matrix

One row per new or changed Server Action, route handler or protected read.

| Operation | Unauthenticated | Other user, same community | Other community | Non-admin (admin-only routes) | Client-supplied IDs ignored |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Validation boundaries (Zod)

| Input | Valid | Boundary | Invalid |
| --- | --- | --- | --- |
| | | | |

## Cycles

Order: pure logic → validation → data access → actions → pages. Use the fewest cycles in which each RED is still a meaningful failing specification; group related acceptance criteria and layers.

### Cycle N: <behaviour>

- RED tests: <test names>
- Placeholder needed: <module and signature> | none
- GREEN scope: <the minimum behaviour>
- Refactor candidates: <expected> | none expected (no refactor commit unless one turns up)
- Files: <paths>
- Needs a database: yes (only in isolated mode) | no

## Files

| Path | New / modified | Why |
| --- | --- | --- |
| | | |

## Approvals needed

Dependency, schema change (Aarushi), migration, config change, test-database use. Write "none" if there are none. **Planning stops at the first item that needs approval.**

## Decisions used

| Decision | Answer | Source (the human, with date, or the doc section) |
| --- | --- | --- |
| | | |

## Out of scope

## Risks

## Verification

- **Each checkpoint:** targeted tests in the current test mode, then the type-check (`npx next typegen`, then `npx tsc --noEmit`). GREEN and REFACTOR also run the full suite and lint.
- **Final:** full suite, coverage, lint, typegen, then `tsc`, then build, using the commands found in `package.json` during preflight. The build runs only in a verified safe environment. Otherwise it's reported as not run (database safety).
- **Scaled to this issue:**
  - Integration tests (real isolated database): <which behaviours> | not relevant: <why>
  - Concurrency tests: <which concurrent writes> | not relevant: <why>
  - Static component tests (no browser): <which components> | none
  - Browser checks: <which flows, which accounts> | not relevant: <why>
- **Commands not run (database safety):** <list, with where each one runs instead> | none
- **Commands the human runs** (SKILL.md §4.2): <list> | none
- **Manual checks the human must do** (browser, OAuth, and so on): <list> | none
