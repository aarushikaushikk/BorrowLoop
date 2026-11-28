# Final report template

Use this at G-final. Every number and result must come from a command that actually ran in this session, by Claude or by the human. Copy outputs exactly as printed. Never record a predicted result as evidence.

```
Final report: #<n> <issue title>
Branch: <branch>    HEAD: <short sha>    Commits for this issue: <git log --oneline main..HEAD>
Test mode: isolated (<database the human confirmed; identity check: matched on <date>>) | unit-only (files excluded: <list>)
```

## 1. Verification results

| Check | Executor | Environment | Command | Result, as printed | Exit code |
| --- | --- | --- | --- | --- | --- |
| Unit tests | | | | Tests: executed · passed · failed · skipped | |
| Integration tests (real isolated database) | | | | <result> \| not run: <reason> \| not relevant | |
| Concurrency tests (only if the issue involves concurrent writes) | | | | <result> \| not relevant | |
| Full regression suite | | | | | |
| Coverage (scope: unit-only \| unit + integration) | | | | statements / branches / functions / lines | |
| Lint | | | | | |
| Typegen (run before the type-check, if the project uses it) | | | | | |
| Type-check | | | | | |
| Build | | | | <result> \| not run (database safety; runs in <where>) | |

- Executor: Claude or human. Environment: for example Claude Code shell, Windows CMD, Ubuntu on WSL 2. Write "not reported" for anything the human didn't paste.
- Environment failures: <command, exit code, what moved to human execution> | none
- Not run (database safety): <files and commands, with the reason> | none
- Baseline failures (already there at preflight): <names> | none

## 2. Other evidence

| Kind | What was checked | By whom, how | Result |
| --- | --- | --- | --- |
| Static component tests (no browser) | | | |
| Browser checks (real browser, running app) | | <human; which accounts> | <result> \| not done: <reason> |

Static component tests don't count as browser checks. List every planned check that wasn't done, why, and what partly covers it.

## 3. Acceptance criteria verification

| AC | Tests | Result | Evidence | Status |
| --- | --- | --- | --- | --- |
| AC1 | | | | PASS / NEEDS VERIFICATION / BLOCKED |

- **PASS:** covered by tests or checks that ran and passed in this session.
- **NEEDS VERIFICATION:** something couldn't be checked here, for example database tests not run, a browser check, or real OAuth. Say exactly what, and what partly covers it.
- **BLOCKED:** a missing decision, approval or dependency.

## 4. Definition of done

| Item (from the issue) | Status | Note |
| --- | --- | --- |
| | | |

For the CI item, state what `.github/workflows/*` actually runs today. Don't claim CI runs tests unless the workflow has a test step. A review-framework item (for example C.L.E.A.R.) is a human step; use the definition the human or course provides.

## 5. Security checklist

Go through `docs/security.md` §14. Mark each line ✓, ✗ or N/A, and give a reason for each N/A.

## 6. Unresolved issues

- Open decisions:
- Manual steps for the human:
- Documentation drift found (flagged, not edited):
- Suggested follow-up issues:

## 7. Suggested PR description material

Summary, acceptance criteria table, test evidence (with executor and environment), decisions made, security checklist, and an AI disclosure. **The human creates the pull request.**
