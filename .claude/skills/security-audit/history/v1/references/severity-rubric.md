# Severity, confidence, status and priority

Four separate dimensions describe each item:
- **status** says what kind of item it is,
- **severity** says how bad it would be,
- **confidence** says how sure the evidence is,
- **priority** says what to do first.

Never let one stand in for another.

## 1. Status (exactly one per item)

| Status | Use when | Severity? | Actionable? |
|---|---|---|---|
| **Confirmed vulnerability** | All of the Confirmed criteria (section 2) hold | Yes | Yes |
| **Potential risk** | A credible weakness where reachability, runtime behavior or an unsettled policy prevents confirmation | Yes | Yes |
| **Dependency advisory** | An npm audit advisory, with the dependency fields filled in | Yes: published severity **and** BorrowLoop risk, kept separate | Yes |
| **Needs manual verification** | Settling it requires runtime, an external service, owner permissions, or inspecting a value the skill must not read (every secret-pattern hit) | Yes (assessed) | Yes |
| **Policy deviation** | The code departs from a project rule (CLAUDE.md, docs/security.md, testing.md) without a demonstrated exploitable weakness | Yes, assessed on the **actual** security implication, with no ceiling | Yes |
| **Documentation drift** | The docs and code disagree, including conflicting requirements | No | Yes (docs) |
| **Verified control** | A control was examined and works. Level: **Static** (code read in this run) or **Runtime** (only when the human supplies runtime evidence, which v1 never produces itself) | No | No |

### Coverage outcomes (for checks, not findings)

| Outcome | Meaning |
|---|---|
| **Examined (static)** | The check ran, using the evidence collected in this run |
| **Not applicable** | The feature or code doesn't exist yet (for example, unbuilt stories) |
| **Not examined** | Outside the selected scope, or deferred by design (for example, Git history scanning in v1) |
| **Blocked** | The skill tried but couldn't proceed safely or technically: a restricted file, the sensitive-content gate, a permission refusal, a tool error, an npm retrieval failure, no Git Bash for redaction |
| **Skipped** | Deliberately not run: the human declined approval, or dry-run mode |

Tests found in source are **evidence of intended coverage only**. Always
write "present in source, not executed". Never write "passing", "verified by
tests" or "covered" without that qualifier.

## 2. Confirmed criteria (all required)

1. **Technical evidence.** The relevant code was read in this run and is
   cited at `file:line` (sanitized).
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

## 3. Severity: impact × likelihood × exposure

Assess all three, then choose the level that fits. State the reasoning in one
line.

- **Impact:** what an attacker gains. Cross-user or cross-community data is
  the most serious, given that access control is BorrowLoop's top risk.
- **Likelihood:** how hard it is to trigger. Consider authentication
  required, preconditions, and how well known the technique is.
- **Exposure:** who can reach it. Consider anonymous internet vs.
  authenticated member vs. admin, production runtime vs. build or dev only,
  and data visible in a public repository.

| Level | Typical shape in BorrowLoop |
|---|---|
| **Critical** | Live credential exposed in the public repo or a client bundle; unauthenticated read or write of other users' or communities' data |
| **High** | An authenticated member can access another community's or user's data, or perform admin actions; injection with data impact |
| **Medium** | A weakness limited by preconditions, or one compensating control still holds: open redirect, information leak in errors, missing defense in depth with a plausible path |
| **Low** | Hardening gap with little impact or low likelihood (for example, actions pinned by tag instead of SHA) |
| **Info** | Observation with no direct security impact |

Public repository visibility is a **contextual exposure factor** to weigh.
It doesn't automatically raise severity.

**Dependency advisories:** record the **published severity** exactly as
reported, and assess the **BorrowLoop risk** separately, using exposure
context and reachability. Unknown reachability limits confidence. It
doesn't lower the risk to Low by default.

## 4. Confidence

| Level | Meaning |
|---|---|
| **High** | Code read and the full path traced. Little room for alternative explanations |
| **Medium** | Code read, but part of the path or a runtime behavior is inferred |
| **Low** | A pattern match or indirect evidence only (every secret-pattern hit) |

## 5. Priority (one ordering across statuses)

Priority applies to actionable items (every status except Verified control).
It ignores status, so a potential critical issue isn't buried below a
confirmed low one.

| Priority | Rule |
|---|---|
| **P1** | Critical (any confidence), or High with High or Medium confidence |
| **P2** | High with Low confidence, or Medium with High or Medium confidence |
| **P3** | Medium with Low confidence, or Low |
| **P4** | Info, and Documentation drift |

Order within a priority: Confirmed → Potential → Needs manual verification →
Dependency advisory → Policy deviation, then by confidence. Documentation
drift is listed in its own section with priority P4.

## 6. False-positive control

Downgrade or drop an item if any of these apply:
- the cited lines don't show the claimed behavior,
- a compensating control prevents the outcome,
- the code can't be reached (dead code: downgrade to Info or Policy
  deviation),
- the only basis is a ⚠ or (Proposed) requirement (use Potential risk at
  most),
- the only evidence is a comment, name or doc claim.

Report the number of candidates dropped or downgraded, with one-line reasons.

## 7. Sanitization rules

- **Terminal report:** show full technical detail, except that **secret
  values are never shown**. Secret-pattern hits show category and path only.
  Code excerpts must not include credential-shaped strings; replace them
  with `[REDACTED]`.
- **Sanitized submission summary** (one line per actionable item, for public
  evidence):
  - *Unresolved* Confirmed, Potential, Manual or Advisory items: give the
    status, priority, OWASP category and a generic area (for example "a
    community-scoped Server Action"). **No** file paths, line numbers,
    parameter names, payloads, bypass steps or reproduction detail.
  - Secret-pattern hits: "Possible credential pattern in a tracked file:
    manual verification pending." No path, category or count.
  - Dependency advisories: package name, published severity and "fix
    available: yes/no" are public information and allowed. Omit
    reachability analysis that would guide exploitation.
  - Verified controls and documentation drift may include file paths.
  - Never include personal data (names, emails) beyond the project's own
    public author attribution.
