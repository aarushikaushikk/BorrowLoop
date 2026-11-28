# Final report template

Use this at G-final. Every number and result must come from a command run in this session. Copy outputs exactly as printed.

```
Final report: #<n> <issue title>
Branch: <branch>    HEAD: <short sha>    Commits for this issue: <git log --oneline main..HEAD>
Test mode: isolated (<database the human confirmed>) | unit-only (files excluded: <list>)
```

## 1. Verification results

| Check | Command | Result, as printed |
| --- | --- | --- |
| Full suite | | Tests: executed · passed · failed · skipped |
| Not run (database safety) | | <files and commands, with the reason> \| none |
| Coverage | | statements / branches / functions / lines |
| Lint | | |
| Typegen (run before the type-check, if the project uses it) | | |
| Type-check | | |
| Build | | <result> \| not run (database safety; runs in <where>) |

Baseline failures (already there at preflight): <names> | none

## 2. Acceptance criteria verification

| AC | Tests | Result | Evidence | Status |
| --- | --- | --- | --- | --- |
| AC1 | | | | PASS / NEEDS VERIFICATION / BLOCKED |

- **PASS:** covered by tests that ran and passed in this session.
- **NEEDS VERIFICATION:** something couldn't be checked here, for example database tests not run, a browser check, or real OAuth. Say exactly what.
- **BLOCKED:** a missing decision, approval or dependency.

## 3. Definition of done

| Item (from the issue) | Status | Note |
| --- | --- | --- |
| | | |

For the CI item, state what `.github/workflows/*` actually runs today. Don't claim CI runs tests unless the workflow has a test step.

## 4. Security checklist

Go through `docs/security.md` §14. Mark each line ✓, ✗ or N/A, and give a reason for each N/A.

## 5. Unresolved issues

- Open decisions:
- Manual steps for the human:
- Documentation drift found (flagged, not edited):
- Suggested follow-up issues:

## 6. Suggested PR description material

Summary, acceptance criteria table, test evidence, decisions made, security checklist, and an AI disclosure. **The human creates the pull request.**
