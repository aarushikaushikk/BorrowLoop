# Finding templates (v2)

Use the definitions in `references/severity-rubric.md`. Excerpts come only
from allowlisted files read in this run, and should be minimal. If an excerpt
looks sensitive:
- omit it,
- write "excerpt omitted: possible sensitive content",
- add a Needs manual verification item (rubric §9).

Never mask or partly reveal a value.

## A. Security finding (Confirmed, Potential, Manual verification, Policy deviation)

```markdown
### <ID>: <short title>
- **Status:** <Confirmed vulnerability | Potential risk | Needs manual verification | Policy deviation> · **Priority:** <P1–P4>
- **Severity:** <Critical | High | Medium | Low | Info> · **Basis:** impact <…>; exposure <…>
- **Assessed risk:** <Critical | High | Medium | Low | Info | Undetermined (<reason; evidence that would settle it>)>
- **Confidence:** <High | Medium | Low>
- **Verification urgency:** <Urgent | Normal> (Needs manual verification only)
- **OWASP (2021):** <A0x Name> · **Requirement (supporting, if any):** docs/security.md §<n> / PRD US-<n> AC<m> / none
- **Location:** `<path>:<line>[-<line>]`
- **Evidence:** <minimal excerpt from an allowlisted file, quoted command result, or "excerpt omitted: possible sensitive content">
- **Reachable path:** <entry point file:line → guard file:line → sink file:line> | not established (<why, e.g. a hop through a non-allowlisted file>)
- **Compensating controls considered:** <what was checked, where, and why it does or doesn't prevent the outcome>
- **Impact:** <what could happen if the evidence holds>
- **Remediation (not applied):**
  1. <step>
  2. <step>
- **Done when:** <an observable condition, e.g. "test X fails before the fix and passes after; route Y returns 404 for a non-member">
- **Test to add:** <name and the acceptance criterion it derives from>
- **Manual verification:** <step and expected observation> (owner: <name or role>)
- **Related tests:** <file: test name> (present in source, not executed) | none found
- **Sanitized submission summary:** <one line per rubric §9>
```

## A2. Unverified credential-pattern match (Needs manual verification)

```markdown
### <ID>: Unverified pattern match: <category> in <tracked | untracked> file
- **Status:** Needs manual verification · **Priority:** <P2 or P3 per rubric §6> · **Verification urgency:** Urgent
- **Conditional severity:** <Level> if genuine · **Assessed risk:** Undetermined (pending private verification) · **Confidence:** Low
- **Location:** `<path>` · category <CATEGORY> · <n> matches · value not inspected · file Blocked
- **What this is:** a regex match only. It doesn't show that a credential is genuine, live or exposed.
- **Manual verification (private):**
  1. Check the value locally, without pasting it anywhere.
  2. If it's genuine, rotate or revoke it first, then remove it from the file and plan a history purge.
  3. If it isn't, change the fixture so it no longer looks like a credential.

  (owner: <role>)
- **Done when:** <the owner confirms it's a placeholder, or the credential is rotated and the file no longer matches the pattern>
- **Sanitized submission summary:** Unverified credential pattern in a tracked file: private verification pending.
```

## B. Dependency advisory

```markdown
### SA-DEP-<n>: <package> <advisory short title>
- **Status:** Dependency advisory (or Potential risk if reachability evidence supports it) · **Priority:** <P1–P4>
- **Package:** <name>@<installed or Unknown> · **Affected range:** <range | withheld> · **Advisory:** <GHSA URL from the filter | withheld> (titles aren't shown)
- **Published severity:** <as reported by npm>
- **Assessed risk:** <Critical…Info | Undetermined (<missing evidence>)> · basis: <exposure + reachability>
- **Confidence:** <High | Medium | Low>
- **Direct or transitive:** <direct | transitive via a > b | path not established> (source: filtered `direct=` and `VIA` lines)
- **Prod or dev:** <prod | dev | Unknown> (source: allowlisted lockfile dev flag)
- **Exposure context:** <Production runtime (server) | Production runtime (client bundle) | Build/install time | Development/test only | Unknown>
- **Fix available:** <version | none> · **Semver-major:** <yes | no | unknown>
- **Reachability:** <Reachable | Not reachable | Unknown>: <evidence; a missing direct import is not proof; Unknown doesn't imply Low>
- **OWASP (2021):** A06 Vulnerable and Outdated Components
- **Remediation (not applied):**
  1. <target version or override>
  2. Team review.
  3. Upgrade on a branch.
  4. Verify in CI.
- **Done when:** <npm audit no longer reports the advisory on the branch, and CI passes>
- **Manual verification:** <how to confirm reachability or the fix> (owner: <name or role>)
- **Sanitized submission summary:** <package, published severity, fix available yes/no; no exploitation guidance>
```

## C. Verified controls (compact)

One row per control. Use a block only when a caveat needs more than a few
words.

```markdown
| ID | Control (requirement · OWASP) | Evidence (file:line, static) | Tests (present in source, not executed) |
|---|---|---|---|
| VC-<n> | <control> (security.md §<n> · A0x) | `<path>:<line>` | <file: test name, or "none found"> |
```

Mark a control **Runtime** only when the human supplied runtime evidence, and
name that source.

## D. Documentation drift (not a security finding)

```markdown
### SA-DRIFT-<n>: <document § vs code>
- **Says:** <doc claim> · **Code shows:** `<path>:<line>`, <observation>
- **Verification:** <step that confirms which is correct> · **Done when:** <doc updated or decision recorded> (owner: <doc owner>)
```
