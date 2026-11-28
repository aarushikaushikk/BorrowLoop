# /security-audit version history

This folder keeps earlier versions of the `/security-audit` skill as evidence
for the HW5 iteration (Issue #42, PR #43). It isn't part of the active skill.

## v1 (`history/v1/`)

- **Baseline commit:** `51653de` (`feat(skill): add /security-audit v1
  read-only audit skill (#42)`), on `feature/42-security-audit-skill`.
- **Contents:** the seven original v1 files, copied from the Git blobs at
  `51653de` without changes:
  - `SKILL.v1.md` (originally `SKILL.md`)
  - `CHANGELOG.v1.md` (originally `CHANGELOG.md`)
  - `references/discovery.md`, `references/scopes.md`,
    `references/severity-rubric.md`
  - `templates/finding.md`, `templates/report.md`
- **Purpose:** keep the original v1 implementation so the v1 → v2 changes and
  the reasons for them can be reviewed against it.

## Rules

- These files are historical references, **not active skill instructions**.
  The active skill is `../SKILL.md` and the files it links to.
- The archived skill file is named `SKILL.v1.md`, not `SKILL.md`, so Claude
  Code doesn't register it as a second skill.
- **Don't invoke or follow the archived v1 version for any further real
  audit.** v1 has known safety limitations, which are recorded in
  `v1/CHANGELOG.v1.md` and addressed in v2.
- Audits don't load, search or treat `history/**` as audit instructions.
