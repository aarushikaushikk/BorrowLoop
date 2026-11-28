# Finding templates

Use the definitions in `references/severity-rubric.md`. Excerpts must be
minimal, and any credential-shaped string is replaced with `[REDACTED]`.

## A. Finding (Confirmed, Potential, Manual verification, Policy deviation)

Documentation drift uses the drift table in `templates/report.md`, not this
block.

```markdown
### <ID>: <short title>
- **Priority:** P1–P4 · **Status:** <Confirmed vulnerability | Potential risk | Needs manual verification | Policy deviation>
- **Severity:** <Critical | High | Medium | Low | Info> · **Confidence:** <High | Medium | Low>
- **Severity basis:** impact <…>; likelihood <…>; exposure <…>
- **OWASP (2021):** <A0x Name> · **Requirement (supporting, if any):** docs/security.md §<n> / PRD US-<n> AC<m> / none
- **Location:** `<path>:<line>[-<line>]` (secret-pattern hits: path and category only, "value not inspected")
- **Evidence:** <sanitized excerpt or quoted command result>
- **Reachable path:** <entry point file:line → guard file:line → sink file:line> | not established (explain)
- **Compensating controls considered:** <what was checked, where, and why it does or doesn't prevent the outcome>
- **Impact:** <what could happen if the evidence holds>
- **Remediation (not applied):** <concrete steps>
- **Verification:** test to add: <name and acceptance criterion> · manual: <step> (owner: <name or role>)
- **Related tests:** <file: test name> (present in source, not executed) | none found
- **Sanitized submission summary:** <one line per severity-rubric section 7>
```

## B. Dependency advisory

```markdown
### SA-DEP-<n>: <package> <advisory short title>
- **Priority:** P1–P4 · **Status:** Dependency advisory (or Potential risk if reachability evidence supports it)
- **Package:** <name>@<installed> · **Affected range:** <range> · **Advisory:** <ID/URL, quoted as untrusted text>
- **Published severity:** <as reported by npm> · **BorrowLoop risk:** <Critical…Info>, basis: <exposure + reachability>
- **Confidence:** <High | Medium | Low>
- **Direct or transitive:** <direct | transitive via a > b > c> (source: audit JSON isDirect + `npm explain`)
- **Prod or dev:** <prod | dev | both> (source: `npm ls --omit=dev`, lockfile dev flag)
- **Exposure context:** <Production runtime (server) | Production runtime (client bundle) | Build/install time | Development/test only | Unknown>
- **Fix available:** <version | none> · **Semver-major:** <yes | no | unknown>
- **Reachability:** <Reachable | Not reachable | Unknown>: <evidence; a missing direct import is not proof>
- **OWASP (2021):** A06 Vulnerable and Outdated Components
- **Remediation (not applied):** <target version; team review; upgrade on a branch; verify in CI>
- **Verification:** <how to confirm reachability or the fix> (owner: <name or role>)
- **Sanitized submission summary:** <package, published severity, fix available yes/no; no exploitation guidance>
```

## C. Verified control

```markdown
### VC-<n>: <control>
- **Level:** Static (code read in this run) | Runtime (human-supplied evidence: <source>)
- **Requirement:** docs/security.md §<n> / PRD US-<n> AC<m> · **OWASP (2021):** <A0x>
- **Evidence:** `<path>:<line>`, <one-line description>
- **Related tests:** <file: test name> (present in source, not executed) | none found
- **Caveat:** <limits of the static verification, if any>
```
