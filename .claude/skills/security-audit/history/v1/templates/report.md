# Report templates

Print to the terminal only. Fill every section, writing "None" rather than
leaving one out. Use the `templates/finding.md` fields for each item. Use
statuses, severities, priorities and coverage outcomes exactly as defined in
`references/severity-rubric.md`.

---

## A. Audit report

```markdown
# BorrowLoop security audit: <full | scope>
Skill: /security-audit v1 · Date: <YYYY-MM-DD> · Mode: <full | scope> · Dry run: no
Branch: <name> · HEAD: <sha> · Working tree: <clean | dirty: N staged, N unstaged, N untracked>
Diff refs (diff scope only): base main <sha> · merge base <sha> · buckets examined: <committed/staged/unstaged/untracked: examined | empty | blocked>
Requirements: docs/security.md (§…) · PRD (…) · architecture (§…) · OWASP Top 10 2021 categories
Shell: <Git Bash | PowerShell> · npm audit: <run with approval | skipped (declined) | blocked (<error code>) | not applicable>

## Summary
- Actionable items: <n>  (P1 <n> · P2 <n> · P3 <n> · P4 <n>)
- By status: Confirmed vulnerability <n> · Potential risk <n> · Dependency advisory <n> · Needs manual verification <n> · Policy deviation <n> · Documentation drift <n>
- Verified controls (static): <n>
- Top priorities: <up to 3 one-liners>
- Overall: "<n> actionable items in the examined scope." (Never claim the application is secure.)

## Coverage
| Area / check | Outcome (Examined (static) / Not applicable / Not examined / Blocked / Skipped) | Method or reason |
|---|---|---|

## Prioritized findings (P1 → P4, across statuses)
<finding blocks from templates/finding.md, ordered per the rubric section 5>

## Dependency advisory summary (dependencies or full scope)
| ID | Package@installed | Published severity | BorrowLoop risk | Direct/transitive | Prod/dev | Exposure context | Fix (semver-major?) | Reachability |
|---|---|---|---|---|---|---|---|---|

## Entry-point matrix (auth, diff or full scope)
| Entry point (file:line) | Type | Authn | Validation | Authz | Query scoped | Safe errors | Notes |
|---|---|---|---|---|---|---|---|

## §14 checklist results (diff scope)
| §14 item | Pass / Fail / Not applicable / Manual | Evidence |
|---|---|---|

## Verified security controls
<verified-control entries from templates/finding.md>

## Documentation drift
| ID | Document § | Says | Code shows (file:line) | Suggested doc owner |
|---|---|---|---|---|

## Blocked, skipped and not examined
| Check | Outcome | Reason (restricted / gate / permission refused / tool error / approval declined / deferred / outside scope) |
|---|---|---|

## False-positive review
Candidates dropped or downgraded: <n>. <one line each: item → reason>

## Recommended next steps (priority order; nothing has been applied)
1. ...

## Limitations
- Static analysis only. No tests, builds, servers or runtime checks were run. Tests are cited as "present in source, not executed".
- Secret scanning is pattern-based: credentials that don't match a pattern may exist in files that weren't gated. GENERIC_ASSIGNMENT matches double-quoted literals only. Git history wasn't scanned (deferred in v1).
- Dependency reachability is evidence-based, otherwise Unknown. Advisory data comes from the registry at run time.
- npm may have written cache or log files outside the repository.
- <scope-specific limitations>

## Sanitized submission summary
<one line per actionable item, following the severity-rubric section 7 rules; no secrets and no actionable detail of unresolved vulnerabilities>

This audit made no repository changes, ran no tests, builds or servers, and applied no fixes. Sanitize any evidence before submitting it.
```

---

## B. Dry-run plan

```markdown
# BorrowLoop security audit plan: <full | scope> (dry run)
Skill: /security-audit v1 · Date: <YYYY-MM-DD> · Branch: <name> · HEAD: <sha> · Working tree: <state>
No audit was performed. No findings are reported.

## Requirements that would be applied
<docs and sections; ⚠ or (Proposed) items affecting the scope>

## Discovered inventory (names only)
| Concern | Files / entry points |
|---|---|

## Checklist that would run
<check IDs from references/scopes.md, with any expected Not applicable outcomes>

## Commands that would run
| Command | Purpose | Permission behavior (allowlisted / will prompt / needs conversational approval / needs Git Bash) |
|---|---|---|

## Expected manual verification
<items and owners>

## Expected prompts
<approximate count, plus the npm audit approval if dependencies or full>

## Skipped in dry run
npm audit, npm ls/explain, the sensitive-content gate, content reads of source files, diff contents, classification.
```
