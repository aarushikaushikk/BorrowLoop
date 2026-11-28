# /security-audit: annotated evidence (Issue #42, HW5 Part 1)

**Author:** Pranav Sirnapalli
**Skill:** `.claude/skills/security-audit/` (v1 baseline commit `51653de`; v2 on `feature/42-security-audit-skill`)

| File | Contents |
| --- | --- |
| [`security-audit-evidence.md`](security-audit-evidence.md) | v1 full-audit demonstration, v1 problems, v2 changes and why, synthetic regression results, the four v2 runtime invocations, the v2 auth-audit demonstration, and remaining limitations |
| [`../../.claude/skills/security-audit/CHANGELOG.md`](../../.claude/skills/security-audit/CHANGELOG.md) | Full engineering record: every change, test and decision |
| [`../../.claude/skills/security-audit/history/v1/`](../../.claude/skills/security-audit/history/v1/) | Unmodified v1 archive |

## How to read the evidence

- **Verbatim (transcript)** blocks are copied from the Claude Code session
  transcript, unchanged except where marked `[…]` (omitted text). Times are
  UTC transcript timestamps.
- **Summary** paragraphs are my condensed description of what the session
  showed. They aren't quotations.
- **Annotation (my approach)** paragraphs are notes I added afterwards.

## What was left out, and why

This repository is public. To follow the skill's own sanitization rules
(`references/severity-rubric.md` §9):

- No credential values. The skill never inspected them.
- No file names, categories or counts for unresolved credential-pattern
  matches. They're described only as "unverified credential-pattern
  matches, private verification pending".
- Unresolved security findings appear only as one-line sanitized summaries
  (status, priority, OWASP category, generic area). File paths, line numbers
  and reproduction detail stay in the terminal reports.
- No personal filesystem paths and no raw session exports. Excerpts are
  short and selected.
