# Production-Readiness Audit — Progress Log

**Auditor:** principal-engineer pass, **read-only** (the only repo writes were `docs/audit/*`).
**Date:** 4 September 2026. **Working tree:** `main`, 109 modified + 129 untracked + 1 deleted path.
**Audit status: COMPLETE.** All nine dimensions covered; all eight deliverables written.
**Remediation status: WAVE 0 COMPLETE (5 Sep 2026)** — see the Gate W0 record below.

## Deliverables

| File | Contents |
|---|---|
| [`00-EXECUTIVE-VERDICT.md`](00-EXECUTIVE-VERDICT.md) | **NO-GO**, top-10 risks, A–I scorecard (overall 5.0/10), effort to top grade, sponsor decisions D8–D22 |
| [`01-FINDINGS.md`](01-FINDINGS.md) | 83 findings — **P0 13 · P1 35 · P2 28 · P3 7** — each with evidence, impact, doc ref, fix and the test that would have caught it |
| [`02-WHATS-WORKING.md`](02-WHATS-WORKING.md) | 11 areas that are genuinely solid, with evidence, so they survive remediation |
| [`03-DATA-ISSUES.md`](03-DATA-ISSUES.md) | Schema drift both directions, constraints, partitions, seed/import, masking, timezone — with runnable detection SQL |
| [`04-UI-UX-ISSUES.md`](04-UI-UX-ISSUES.md) | Design firewall, a11y, kill-list, localisation, responsive, performance, states, nav |
| [`05-SECURITY-REVIEW.md`](05-SECURITY-REVIEW.md) | OWASP-style, **3 critical + 3 high**, each with an executed exploit and verbatim response |
| [`06-SPEC-DRIFT.md`](06-SPEC-DRIFT.md) | Requirement matrix re-graded, 11 plan-checkbox corrections, 9 doc contradictions |
| [`07-REMEDIATION-PLAN.md`](07-REMEDIATION-PLAN.md) | Wave 0/1/2 in the `plans/` stage template, sized and owner-typed |

## Coverage

| Step | State | Note |
|---|---|---|
| 0 — CLAUDE.md / AGENTS.md / .cursor rules | ☑ | |
| 0 — docs/00–16 | ☑ | 00, 01, 03, 04, 08, 14 read in full; 05, 06, 09, 10, 11, 12, 13, 15, 16 read by structure + targeted extraction (report codes, golden fixtures, table lists) |
| 0 — plans/* | ☑ | README, all 7 phase files' stage headers and statuses, Gates G0/G1, Stage 0.4/0.5/1.3/1.9 exit criteria in full |
| 1 — run the gates | ☑ | Both projects, all gates, real output captured |
| 1 — migrate on a fresh DB | ☑ | `hrms_audit_test` created from scratch; up / re-run / down / re-up all verified |
| 1 — seeds | ☑ | rbac (12 roles, 56 permissions, 219 grants) · settings (51) · workflows (19) |
| 1 — live server + role walk | ◐ | Backend started on :5199 against the audit DB; API exercised as `employee` and `it_admin`. **Browser route-walk and screenshots NOT done** — stated explicitly in `04-UI-UX-ISSUES.md` |
| 2A architecture | ☑ | |
| 2B API contract | ☑ | All 219 procedures extracted and classified |
| 2C database | ☑ | |
| 2D security | ☑ | 6 exploits executed |
| 2E business logic | ☑ | |
| 2F frontend | ☑ | Static + build; browser pass excepted as above |
| 2G tests | ☑ | |
| 2H ops | ☑ | |
| 2I spec drift | ☑ | |

## Gate results (executed 4 Sep 2026)

| Gate | Backend | Frontend |
|---|---|---|
| typecheck | **FAIL** — 4 errors | PASS |
| lint | **FAIL** — 1 error | PASS |
| knip | PASS | PASS |
| depcruise | PASS — 192 modules, 753 deps, 0 violations | n/a |
| test | **FAIL** — 1 of 483 | PASS — 290/290 |
| build | **FAIL** — same 4 errors | PASS — 790.55 kB single chunk |
| migrate (fresh) | PASS | — |
| migrate (idempotent) | PASS | — |
| migrate:down | PASS | — |
| npm audit (prod) | **4 advisories, 1 high** | 0 |

## Environment as audited

Node **v26.0.0** (docs specify 24; CI uses 22) · PostgreSQL **14.21** (docs specify 16) ·
npm 11.12.1 · macOS. Findings [C12] and [H7].

## Probe artifacts

- Throwaway database `hrms_audit_test` on localhost:5432 — **left in place** for re-verification.
  It contains only synthetic fixtures. Drop with `DROP DATABASE hrms_audit_test;`.
- Gate logs and the procedure inventory are in the session scratchpad, not the repo.
- The temporary fixture script (`backend/.audit-fixtures.ts`) was **deleted**; no repo file outside
  `docs/audit/` was created or modified.

## Next step

**Do not begin remediation until `07-REMEDIATION-PLAN.md` is approved.** When it is, Stage **W0.1
(commit the working tree)** must land first — every other task edits files that are currently
uncommitted and unreviewed.

---

# Remediation log

## Gate W0 — 5 September 2026

| Criterion | State | Evidence |
|---|---|---|
| both `verify` exit 0 | ✅ | backend **EXIT 0, 533/533** across 69 files (was 483, 1 failing); frontend **EXIT 0**, 290/290 |
| every `05-SECURITY-REVIEW` exploit re-run and refused | ✅ | §1 §2 §3 §4 §5 §6 all re-run live against `hrms_audit_test`; before→after in each stage record |
| the worker runs all 13 jobs | ✅ (locally) | `{"queues":14,"scheduled":14,"msg":"hrms-worker running"}` — it previously **died on boot** |
| a notification is provably delivered end-to-end | ◐ | pipeline + transport proven (incl. a socket-level SMTP receiver); **a real email on staging needs D17** |

### Exploit ledger — audit (4 Sep) → now (5 Sep)

| # | Exploit | Was | Now |
|---|---|---|---|
| §1 | ESS reads another company's profile | `200` + DOB, personal email, mobile, home address | **`404`** |
| §1 | ESS lists the whole directory | `total=2`, both companies | **`total=1`**, own record |
| §1 | ESS reads company-wide facets | both entities | **own entity only** |
| §2 | ESS raises a resignation against another employee | `{"requestId":1}` → **approved, 0 steps** | **`403`** "You can only raise a request about yourself" |
| §2 | own request with an all-vacant chain | auto-approved silently | **`pending`**, routed to fallback, alerted |
| §3 | it_admin grants itself compensation.read | `{"changed":true}` | **`403`** "you do not hold it" |
| §3 | it_admin assigns itself super_admin | `{"ok":true}` | **`403`** "your own roles" |
| §3 | it_admin assigns super_admin to another | *(not attempted)* | **`403`** "carries 44 permission(s) you do not hold" |
| §3 | read a peer's statutory IDs | PAN/Aadhaar/bank in clear | **masked, all null** |
| §3 | strip admin.roles from every super_admin | *(not attempted — unrecoverable)* | **refused by the database** |
| §4 | 30 logins in one second | all processed | **429 from the 11th** |
| §5 | security headers | `X-Powered-By` only | **full CSP/nosniff/referrer/frame set**, no X-Powered-By |
| §6 | 250 kB document upload | `413` + HTML stack trace with `/Users/...` | **`200`** |
| §6 | malformed request body | HTML error page | **JSON envelope**, no filesystem paths |

### Stages

| Stage | State | Note |
|---|---|---|
| W0.1 commit the tree | ◐ | 238 paths in 19 requirement-tagged commits; **W0-T02 push BLOCKED** on permission, so CI has still never run |
| W0.2 green the build | ☑ | |
| W0.3 data scope | ☑ | 18-case access-matrix test is the regression net |
| W0.4 workflow floor | ☑ | safety floor shipped; **D21 open** for the raise-on-behalf policy |
| W0.5 bound admin.roles | ☑ | ceiling + DB last-admin guard |
| W0.6 turn the system on | ◐ | code complete; **D17 open** for a real email on staging |
| W0.7 guard the mock feed | ☑ | |
| W0.8 HTTP hardening | ☑ | |

### Findings added or corrected during Wave 0

- **[E13] NEW (P1)** — a test built fixture dates in UTC against IST logic; the suite passed by day and
  failed between 00:00 and 05:30 IST. Production code was correct.
- **[E3] CORRECTED** — the audit inferred a coverage-logic bug from a test name. Instrumentation showed
  the logic was right and the *assertion* was wrong (`2026-12-14` vs the spec-mandated `14 Dec 2026`).
- **[E9] UPGRADED from UNVERIFIED** — the worker did not merely miss two queue registrations; it
  **crashed on boot** and took all thirteen jobs with it.

### Blocked, and what is needed

| # | Blocker | Blocks | Needed |
|---|---|---|---|
| — | `git push` denied by the environment's permission classifier | W0-T02; **CI has never executed** | the user to run `git push -u origin remediation/wave-0`, or grant the permission |
| D17 | SMTP host + credentials + a staging box | W0.6 exit criterion | `SMTP_HOST/PORT/USER/PASS/FROM`; cannot be synthesised — a fake relay proves nothing, a real one mails real people |
| D21 | who may raise a request on another's behalf | LC-06 HR-initiated absconder path | sponsor policy; today nobody can, which is the documented ESS model |
