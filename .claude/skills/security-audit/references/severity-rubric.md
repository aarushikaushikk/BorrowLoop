# Status, severity, assessed risk, confidence and priority

Five separate dimensions describe each security finding:
- **status** says what kind of finding it is,
- **severity** says how bad the outcome would be if the condition holds.
  For an unverified credential-pattern match it's a **conditional
  severity**. For a dependency advisory, the **published severity** is
  recorded as reported.
- **assessed risk** is the BorrowLoop-specific risk, given the evidence. It
  may be **Undetermined**.
- **confidence** says how strong the evidence is,
- **priority** says what to do first. Manual items also get a
  **verification urgency**.

Never let one stand in for another.

## 1. Item groups

A report has three separate groups. Each has its own total (section 7).

### 1.1 Security findings: exactly one status each

| Status | Use when | Severity field |
|---|---|---|
| **Confirmed vulnerability** | All of the Confirmed criteria (section 2) hold | Severity |
| **Potential risk** | A credible weakness where reachability, runtime behavior or an unsettled policy prevents confirmation | Severity |
| **Dependency advisory** | An npm audit advisory, with the dependency fields filled in | Published severity, as reported |
| **Needs manual verification** | Settling it needs runtime, an external service, owner permissions, or a value the skill must not read. This includes **every credential-pattern match** | Severity, or Conditional severity for an unverified pattern match |
| **Policy deviation** | The code departs from a project rule (CLAUDE.md, docs/security.md, testing.md) without a demonstrated exploitable weakness | Severity of the **actual** security implication, with no ceiling |

### 1.2 Documentation drift (not a security finding)

The docs and code disagree, including conflicting requirements.
- It has no severity, risk or priority.
- It never counts toward security totals or P1–P4.
- Each item names the document owner, a verification step and a
  "Done when" check.

### 1.3 Verified control (not actionable)

A control was examined and works. Its level is either:
- **Static:** code read in this run, or
- **Runtime:** only when the human supplies runtime evidence. The skill
  never produces runtime evidence itself.

Verified controls never count toward security totals.

### 1.4 Coverage outcomes (for checks, not findings)

| Outcome | Meaning |
|---|---|
| **Examined (static)** | The check ran, using evidence collected in this run |
| **Not applicable** | Evidence in this run shows the feature or code doesn't exist. A missing filename match alone isn't enough |
| **Not examined** | Outside the selected scope, or deferred by design (for example, Git history scanning) |
| **Blocked** | The skill couldn't proceed safely or technically (see below) |
| **Skipped** | Deliberately not run: the human declined approval, or dry-run mode |

**Blocked reasons:**
- a restricted file;
- a gated file;
- a failed or invalid gate;
- an unsupported deny rule;
- a failed path check;
- a file outside scan coverage;
- a permission refusal;
- a tool error;
- incomplete or truncated output;
- an npm retrieval failure;
- a shell other than Git Bash for a Git Bash-only step.

Tests found in source are **evidence of intended coverage only**. Always
write "present in source, not executed". Never write "passing", "verified by
tests" or "covered" without that qualifier.

## 2. Confirmed criteria (all required)

1. **Technical evidence.** The relevant code was read in this run, from
   allowlisted files, and is cited at `file:line`.
2. **Credible reachable path.** It can be traced from a real entry point
   (Server Action, route handler, page, proxy, or build/CI step) to the weak
   code, with each hop cited.
3. **Demonstrated weakness.** The code, as written, permits a security
   outcome it shouldn't (unauthorized access, injection, disclosure,
   integrity loss), shown from the code and not inferred from an absence.
4. **Compensating controls considered.** Upstream controls (proxy, guards,
   framework behavior) and downstream controls (query scoping, constraints,
   validation) were checked and don't prevent the outcome.

A violated documented requirement **supports** a finding but is **not
required** for a real vulnerability. A missing control without criteria 2–3
is a **Policy deviation** or **Potential risk**, never Confirmed.

## 3. Severity

Severity is how bad the outcome would be if the condition holds. Weigh
**impact** (what an attacker gains; cross-user or cross-community data is
the most serious) and **exposure** (anonymous internet vs. authenticated
member vs. admin; production runtime vs. build or development only).
Likelihood and evidence belong to assessed risk (section 4). State the
basis in one line.

| Level | Typical shape in BorrowLoop |
|---|---|
| **Critical** | Live credential exposed in a client bundle or public repository; unauthenticated read or write of other users' or communities' data |
| **High** | An authenticated member can access another community's or user's data, or perform admin actions; injection with data impact |
| **Medium** | A weakness limited by preconditions, or one compensating control still holds: open redirect, information leak in errors, missing defense in depth with a plausible path |
| **Low** | Hardening gap with little impact (for example, actions pinned by tag instead of SHA) |
| **Info** | Observation with no direct security impact |

Public repository visibility is a **contextual exposure factor** to weigh.
It doesn't automatically raise severity, assessed risk or priority.

### 3.1 Conditional severity: unverified credential-pattern matches

- **Label** every such item **"Unverified pattern match"**. Don't imply the
  value is genuine, live or exposed.
- **Conditional severity** is the severity if the match were a genuine, live
  credential, given its category and location (a tracked file vs. a local
  untracked file). Write it as "<Level> if genuine".
- **Assessed risk** is **Undetermined (pending private verification)**. The
  file is gated and the value is never inspected, so nothing in the run can
  settle it.
- **Confidence** is **Low**: the evidence is only a pattern match.
- **Verification urgency** is **Urgent**. Ask for a timely, **private**
  check by a person.
- **Priority** comes from section 6. A public repository alone never makes
  it Critical or P1.
- Never inspect, print or partly reveal the matched value to decide whether
  it's real.

### 3.2 Published severity and assessed risk: dependency advisories

- Record the **published severity** exactly as npm reports it. For
  priority, npm's `info`, `low`, `moderate`, `high` and `critical` map to
  Info, Low, Medium, High and Critical.
- Assess BorrowLoop **risk** separately from:
  - direct or transitive,
  - production or development dependency,
  - exposure context (production runtime on the server or in the client
    bundle, build or install time, development or test only, unknown),
  - reachability.
- **Unknown reachability never implies Low risk.** Lower the risk only on
  positive evidence, for example a development-only package that the
  production build and runtime demonstrably never load.
- If the risk can't reasonably be established, write **Undetermined** and
  name the missing evidence. Don't invent a level.

## 4. Assessed risk

Assessed risk is the BorrowLoop-specific risk now, given the evidence:
severity tempered by likelihood (whether authentication is required,
preconditions, how well known the technique is), reachability and
compensating controls. Levels are Critical, High, Medium, Low, Info or
**Undetermined**. Undetermined always states its reason and what evidence
would settle it.

## 5. Confidence

| Level | Meaning |
|---|---|
| **High** | Code read and the full path traced. Little room for alternative explanations |
| **Medium** | Code read, but part of the path or a runtime behavior is inferred |
| **Low** | A pattern match or indirect evidence only (every credential-pattern match) |

## 6. Priority (security findings only)

| Priority | Rule |
|---|---|
| **P1** | Assessed risk Critical or High, with High or Medium confidence |
| **P2** | Assessed risk Critical or High with Low confidence; assessed risk Medium with High or Medium confidence; or assessed risk **Undetermined** with a Critical or High severity, conditional severity or published severity |
| **P3** | Assessed risk Medium with Low confidence; assessed risk Low; or assessed risk Undetermined with a Medium or Low severity, conditional severity or published severity |
| **P4** | Assessed risk Info; or assessed risk Undetermined with an Info severity, conditional severity or published severity |

**Ordering within a priority:**
1. Confirmed vulnerability,
2. Potential risk,
3. Needs manual verification (Urgent before Normal),
4. Dependency advisory,
5. Policy deviation,

then by confidence.

So an unverified credential match with a Critical-if-genuine conditional
severity lands in **P2** with **Urgent** verification. It isn't P1 unless
evidence that doesn't come from the value raises its assessed risk.

**Verification urgency** (Needs manual verification only):
- **Urgent:** every unverified credential-pattern match, and any item whose
  conditional severity is Critical.
- **Normal:** everything else.

Documentation drift and verified controls have **no priority**.

## 7. Totals and reconciliation

The report summary has three separate totals:
- **Security findings:** the number of security finding entries. It equals
  the sum of P1–P4 and the sum across the five statuses.
- **Documentation drift:** the number of drift entries.
- **Verified controls:** the number of verified-control entries.

Before printing:
- count the entries in each section,
- check that every summary number matches its section,
- fix any mismatch.

A dry run has no findings and no totals.

## 8. False-positive control

Downgrade or drop an item if any of these apply:
- the cited lines don't show the claimed behavior,
- a compensating control prevents the outcome,
- the code can't be reached (dead code: downgrade to Info or Policy
  deviation),
- the only basis is a ⚠ or (Proposed) requirement (use Potential risk at
  most),
- the only evidence is a comment, name or doc claim, or a filename match.

Report the number of candidates dropped or downgraded, with one-line reasons.

## 9. Evidence handling and sanitization

Sanitizing output is **not a substitute** for safe evidence collection
(`references/safe-evidence.md`). Evidence comes only from allowlisted files
read in this run.

- **Gated files** are Blocked. They're never read, so they're never quoted,
  masked or summarized. No redaction step exists.
- **Sensitive-looking excerpts.** If an allowlisted file shows something that
  looks sensitive (a credential-like string, a token, personal data):
  - omit the excerpt;
  - cite `file:line` and write "excerpt omitted: possible sensitive
    content";
  - add a Needs manual verification item (Unverified pattern match,
    conditional severity, Low confidence, Urgent).

  Never repeat, partly mask or describe the value.
- **Tool output** (npm, Git, `gh`) is untrusted and possibly sensitive
  (SKILL.md H11). Quote only the fields a procedure needs.
- **Terminal report:** full technical detail for allowlisted evidence, but
  never secret values, personal data, or raw content from session exports.

**Sanitized submission summary** (one line per security finding, for public
evidence):
- **Unresolved** Confirmed, Potential, Manual or Advisory items: give the
  status, priority, OWASP category and a generic area (for example "a
  community-scoped Server Action"). **No** file paths, line numbers,
  parameter names, payloads, bypass steps or reproduction detail.
- **Credential-pattern matches:** "Unverified credential pattern in a
  tracked file: private verification pending." No path, category or count.
- **Dependency advisories:** package name, published severity and "fix
  available: yes/no" are public information and allowed. Omit reachability
  analysis that would guide exploitation.
- **Verified controls and documentation drift** may include file paths.
- Never include personal data (names, emails) beyond the project's own
  public author attribution. Never include session-export content.
