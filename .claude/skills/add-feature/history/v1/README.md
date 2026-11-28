# /add-feature v1 (archived)

Verbatim copies of the v1 skill as committed in `bbf3491` ("feat(skill): add /add-feature v1 red-green-refactor workflow (#13)"):

| Archived file | Source path at `bbf3491` | Blob |
| --- | --- | --- |
| `SKILL.v1.md` | `.claude/skills/add-feature/SKILL.md` | `788b052` |
| `templates/checkpoint.md` | `.claude/skills/add-feature/templates/checkpoint.md` | `6c6960e` |
| `templates/final-report.md` | `.claude/skills/add-feature/templates/final-report.md` | `f23635e` |
| `templates/plan.md` | `.claude/skills/add-feature/templates/plan.md` | `8cb97f1` |

To check them again: `git hash-object --path=.claude/skills/add-feature/<source path> <archived file>` should print the same blob as `git rev-parse bbf3491:.claude/skills/add-feature/<source path>`.

The skill file is named `SKILL.v1.md` so that it doesn't register as a second `/add-feature` command. It is for reference only. The active skill is `../../SKILL.md`. The v1 entry in `../../CHANGELOG.md` records why v1 was designed this way.
