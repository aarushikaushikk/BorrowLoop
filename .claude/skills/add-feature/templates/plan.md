# Plan template

Fill in every section. Write "none" rather than deleting a section. Present the plan to the human, then wait for approval at G2.

```
Plan: #<n> <issue title>
Branch: <branch>        Focus: <focus or "whole issue">
Test mode: isolated (database confirmed by the human: <what it is>) | unit-only (files excluded: <list>)
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

Order: pure logic → validation → data access → actions → pages.

### Cycle N: <behaviour>

- RED tests: <test names>
- Placeholder needed: <module and signature> | none
- GREEN scope: <the minimum behaviour>
- Refactor candidates: <expected> | none
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
- **Commands not run (database safety):** <list, with where each one runs instead> | none
- **Manual checks the human must do** (browser, OAuth, and so on): <list> | none
