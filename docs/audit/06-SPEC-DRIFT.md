# 06 — Spec ↔ Code ↔ Plan Drift

Three questions: is each requirement implemented, is each ticked plan box actually met, and do the docs
contradict each other? Grades are against the working tree on 4 Sep 2026.

**Legend** — ☑ implemented and verified · ◐ partial · ☐ not built · ⚠ implemented but **defective**
(built, reachable, and wrong — the most dangerous category, because the plan shows it done)

---

## 1. Requirement matrix re-graded (docs/01 §9)

### M1 Core HR

| ID | Requirement | Plan says | **Audit grade** | Evidence |
|---|---|---|---|---|
| CORE-01 | Single employee master | ☑ 0.5 | **◐** | Table + read API exist; **no write path at all** — `employee.write` gates nothing [E4] |
| CORE-02 | E-code series, duplicates impossible | ☑ 0.5 | **☑** | Atomic DB function; 20-concurrent test proven |
| CORE-03 | Reporting + functional manager | ☑ 0.5 | **◐** | Columns and closure table exist; no maintenance UI/API |
| CORE-04 | Cost centre on every employee | ☑ 0.5 | **☑** | `core.cost_centers`, `core.plants`, `core.mis_codes` |
| CORE-05 | Employment-category enum | ☑ 0.5 | **☑** | `core.employment_category` PG enum, 5 labels |
| CORE-06 | Status lifecycle, exited never in active lists | ☑ 0.5 | **☑** | `core.employee_status` enum + DOL CHECK |
| CORE-07 | Statutory IDs, validated, on payslip | ☑ 0.5 | **◐** | Columns + masking ☑; **format validation is import-only**, no entry path |
| CORE-08 | Field-level validation per SOW-5.2 | ☑ 0.5 | **◐** | Validators exist in `import.schemas.ts`; unreachable outside the import [E4] |
| CORE-09 | Letter generation + workflow | ☑ 1.6 | **◐** | Templates, issue, signature chain ☑; content returned via `toString('utf8')` corrupts binaries [E5] |
| CORE-10 | RBAC everywhere, manager tree scoping | ☑ 0.4 | **⚠** | Permission gate ☑; **data scope discarded by 20 of 24 modules** [D1][D2] |
| CORE-11 | Full audit log, old→new | ☑ 0.4 | **☑** | Hash-chained, DB-computed, append-only, verification fn |
| CORE-12 | Bulk import with validation report | ☑ 0.5 | **◐** | Built and tested; **callable only from tests** — no CLI or API [I1] |
| CORE-13 | Policy repository + acknowledgment | ☑ 1.6 | **◐** | Publish/ack/nag/report ☑; nag notification never delivered [A2]; PDF corrupted [E5] |
| CORE-14 | In-app contextual help | — | **☐** | Not built |

### M2 Attendance

| ID | Requirement | Plan says | **Audit grade** | Evidence |
|---|---|---|---|---|
| ATT-01 | Kent ingestion ≤ 5 min, raw immutable | ☑ 1.1 | **⚠** | Pipeline ☑, append-only ☑; **connector is a mock with no prod guard** [A1]; unique key defeated by NULL door_code [C3] |
| ATT-02 | Watermarks, gap detection, offline alerting | ☑ 1.1 | **◐** | Per-device watermarks + monotonic trigger ☑; alerts enqueue and are never delivered [A2] |
| ATT-03 | Idempotent recompute | ☑ 1.2 | **⚠** | Recompute queue + trigger ☑; **shift assignment is not effective-dated**, so recompute rewrites history [C2] |
| ATT-04 | Shifts, rosters by manager, deadline nag | ☑ 1.2/1.11 | **◐** | Roster + guards ☑; nag fires 14:30 IST not 09:00 [E8] and is never delivered [A2] |
| ATT-05 | Day statuses incl. two-session | ☑ 1.2 | **☑** | PG enum, session_statuses CHECK, 36 punch-edge tests |
| ATT-06 | AR + Permission, Excel export | ☑ 1.4 | **☑** | Router, service, R3 export |
| ATT-07 | Future-dated OD | ☑ 1.4 | **☑** | |
| ATT-08 | OT 48h lapse | ☑ 1.4 | **⚠** | `lapseExpiredOvertime` ☑ and tested — but it runs in the worker, and **the worker is disabled in production** [H2]; the manager digest is never sent [A2] |
| ATT-09 | Week-off eligibility | ☑ 1.2 | **◐** | `closeWeek` ☑; job scheduled 07:30 IST not 02:00 [E8]; worker disabled [H2] |
| ATT-10 | Absenteeism engine, show-cause | ☑ 1.6 | **◐** | Cases + stages + letters ☑; scan job disabled [H2]; letters never sent [A2] |
| ATT-11 | Auto-alerts up the hierarchy | ☑ 1.6 | **⚠** | Recipient matrix ☑ (data-driven, correct); **nothing is ever delivered** [A2] |
| ATT-12 | Manager approval precedes lock | ☑ 1.7 | **☑** | `att.manager_month_approvals`, append-only, invalidation trigger |
| ATT-13 | Holiday calendars by location | ☑ 1.2 | **☑** | |
| ATT-14 | Mobile/geo check-in | — | **☐** | Columns exist; PWA is Phase 8 |
| ATT-15 | Month lock | ☑ 1.7 | **☑** | Two triggers, correctly written (see 02 §5) |
| ATT-16 | Cross-plant swipes valid | ☑ 1.1 | **☑** | Mock generates the case; R2 reconciliation flag |
| ATT-17 | Managers never override attendance | ☑ 1.2 | **☑** | `attendance.manual_override` not granted to manager; verified in seed + test |
| ATT-18 | First-in / last-out | ☑ 1.2 | **☑** | `direction` unconstrained text [C11] but logic handles unknown |

### M3 Leave

| ID | Requirement | Plan | **Grade** | Evidence |
|---|---|---|---|---|
| LV-01 | Leave types per live greytHR | ☑ 1.5 | **☑** | |
| LV-02 | Auto monthly credit on the 1st | ☑ 1.5 | **⚠** | `runMonthlyAccrual` ☑ + unique index makes reruns safe; **worker disabled → never runs** [H2]. This is PP-1, the original pain point |
| LV-03 | Applications, balance check, sandwich | ☑ 1.5 | **◐** | Built; **coverage warning branch fails** [E3]; `coverage-check.service.ts:210` does not compile [E2] |
| LV-04 | Comp-off earn/expire | ☑ 1.5 | **◐** | Built; expiry job disabled [H2] |
| LV-05 | Immutable ledger | ☑ 1.5 | **☑** | Append-only trigger, balances are `SUM(delta)` |
| LV-06 | Encashment incl. employee-initiated | ☑ 1.5 | **◐** | Request path ☑; settlement needs payroll |
| LV-07 | Leave in muster | ☑ 1.7 | **☑** | |
| LV-08 | Leave cancel as a workflow | ☑ 1.5 | **☑** | |
| LV-09 | Restricted Holiday | ☑ 1.5 | **☑** | `lv.restricted_holidays`, `rh_selections`, auto-approve at cutoff |
| — | Leave admin scope | — | **⚠** | `GET /leave/balances/{id}` and `POST /leave/adjustments` ignore org-unit scope [D2] |

### M4 Payroll & Statutory — **PAY-01 … PAY-18: all ☐**

No `pay.*` payroll tables, no engine, no console backend. Matches plans/phase-2 (every stage ☐).
Foundations that *are* laid and are good: the money module, the rounding-policy file, 5 of 10 golden
fixtures, `pay.gl_accounts`, and the claims/budget ledger.

### M5 Lifecycle — LC-01 … LC-07: ☐ except LC-03

| ID | Requirement | **Grade** | Evidence |
|---|---|---|---|
| LC-03 | Daily boarding/exit email | **⚠** | `sendBoardingExitEmail` + `boardingExitExcel` built and the frontend reads the live endpoint — but the job is disabled [H2] and the email has no transport [A2]. PP-6/PP-26 unresolved |
| LC-01/02/04/05/06/07 | Onboarding, probation, transfer, separation, exit | **☐** | Phase 3 |

### M6 Workflows

| ID | Requirement | Plan | **Grade** | Evidence |
|---|---|---|---|---|
| WF-01 | Generic engine, approve/reject/send_back | ☑ 1.3 | **⚠** | Engine, 19 seeded chains, delegation, resubmit all work — but **anyone can raise a request for anyone** [B2] and **a fully vacant chain self-approves** [E1] |
| WF-02 | Notification service, queued with retry | ☑ 0.4 | **⚠** | Queue, recipient matrix, retry→dead-letter all built and tested; **never drained, no transport** [A2] |
| WF-03 | Escalation matrix | ☑ 1.3 | **◐** | `runEscalations` ☑ and tested; worker disabled [H2] |
| WF-04 | Timeline of state changes | ☑ 1.3 | **◐** | Timeline API ☑ with a correct involvement check — but a vacant-chain approval produces **zero steps**, so the timeline is empty [E1] |

### M7 Reports — 13 of 31 referenced

Implemented and reachable: **R1–R6** (muster, swipes, regularizations, exceptions, OT, absence cases),
**R24** (boarding/exit), **R27** (headcount), **R28/R29/R30** (policy-ack family), plus R7 and R20
referenced in code for Phase 2.
**Not built:** R8–R19, R21, R22, R23, R25, R26, R31 — the payroll register family, statutory registers,
ATS cross-system reports (R21/R22) and the reimbursement register (R31). Most are Phase 2/3/4 dependent.

| ID | Requirement | **Grade** |
|---|---|---|
| RPT-01 | Muster + RM + Emp ID + cost centre | **⚠** — built, exported, performance-tested; **`reports.router.ts:712` does not compile** [E2] |
| RPT-02 | Offer report | **☐** Phase 4 |
| RPT-03 | CEO dashboard | **◐** — precomputed snapshot design ☑ (correctly avoids live aggregation); nightly job disabled [H2] |
| RPT-04 | HR / BU dashboards | **☑** — scoped correctly, one of only four modules that applies `permissionAccess` |
| RPT-05 | Recruitment/promotion reports | **☐** |
| RPT-06 | Every table exportable to Excel with filters | **◐** — 7 exports share the list query, as specified |

### M8–M13

| Module | Grade | Note |
|---|---|---|
| M8 Assets (AST-01..06) | **◐** | Registry, assignments, maintenance, trigram search ☑; scope not applied [D2] |
| M9 Helpdesk (HD-01) | **◐** | Tickets, categories, SLA escalation, append-only messages ☑; escalation job disabled [H2] |
| M10 Engagement (EN-01..04) | **◐** | Announcements + polls ☑; **surveys (EN-03) not built** — `eng.surveys` absent |
| M11 Loans (LN-01..04) | **☐** | Phase 2 |
| M12 Claims (CLM-01..07) | **◐** | Budget ledger, reservations, category caps, settlement maths all built and well tested; payout needs payroll |
| M13 T&E (TE-01..12) | **☐** | Phase 3.5; UI shell exists |

### Non-functional

| ID | Requirement | **Grade** | Evidence |
|---|---|---|---|
| NFR-01 | Muster < 10 s, dashboard < 2 s | **◐** | Backend perf test exists; frontend ships one 790 kB chunk [F2] |
| NFR-02 | 3k employees, 10k–20k swipes/day | **◐** | Partitioning + BRIN + scale-spike doc ☑; no load test in CI |
| NFR-03 | RBAC, bcrypt, JWT, masking, TLS, **rate limiting**, parameterized queries | **⚠** | Most ☑; **no rate limiting at all** [D4], no security headers [D6], scope not applied [D2] |
| NFR-04 | Append-only audit, payroll immutable after lock | **☑** | For everything that exists |
| NFR-05 | Nightly off-box backup + WAL PITR, rehearsed restore | **☐** | Nothing in the repo [H6] |
| NFR-06 | PM2 auto-restart, no payroll-week deploys | **◐** | PM2 config exists but **omits the worker** [H2] |
| NFR-07 | Responsive desktop-first, tablets/phones | **◐** | sm/md/lg/xl covered; no `2xl` for large monitors |
| NFR-08 | greytHR/Adrenalin migration with validation | **◐** | Built, unreachable [I1] |
| NFR-09 | INR lakh/crore, IST, DD MMM YYYY | **☑** | Default-on in `KpiNumber`, `Chart`, `SegmentedProgress`; `core/dates.ts` |

---

## 2. Proposed plan-checkbox corrections

| File · Stage | Current | Proposed | Why |
|---|---|---|---|
| phase-0 · **0.4** Auth/RBAC/audit/settings/notifications | ☑ done | **◐** | Task P0-T24 claims the notification skeleton is *"live"* with retry→dead-letter proven. It is live **in tests only** — `processQueue` has no production caller and no transport exists [A2]. The exit criteria did not require a scheduled drain; they should. |
| phase-0 · **0.5** Employee master + import | ☑ done | **◐** | Its own exit criteria — *"1,066 EMS rows loaded + enriched … SeaweedFS up with nightly mirror configured"* — are unmet, and the import is unreachable outside tests [I1][A3]. The header caveat partially discloses this. |
| phase-1 · **1.1** Ingestion | ☑ done | **◐** | Honest about the mock in its status line, but the mock has **no production guard** [A1] and the unique key is defeated by NULL door codes [C3]. |
| phase-1 · **1.2** Shifts/rosters/day-status | ☑ done | **◐** | `att.employee_shifts` is not effective-dated, so ATT-03's idempotent-recompute guarantee does not hold [C2]. |
| phase-1 · **1.3** Workflow engine | ☑ done | **☐ reopen** | Two defects strike at the stage's own headline claims: `create` has no subject authorization [B2], and a fully vacant chain auto-approves with **zero step rows**, so the *"a step row physically cannot exist without its notification receipt (the PP-14 guarantee, structural not procedural)"* claim is vacuously true and materially false [E1]. |
| phase-1 · **1.4** AR/OD/OT 48h | ☑ done | **◐** | Logic is correct and tested; the lapse job cannot run because the worker is not in the PM2 topology [H2]. |
| phase-1 · **1.5** Leave | ☑ done | **◐** | One failing test (SHF-08 coverage) [E3] and one non-compiling file (`coverage-check.service.ts:210`) [E2]. |
| phase-1 · **1.7** Reports/dashboards/month lock | ◐ | **◐ (keep)** | Correct as marked; add that `reports.router.ts:712` does not compile [E2]. |
| phase-5 · **5.2** Identity hardening | ◐ 5.2a done | **◐ (keep)** | Accurate. Add that `recordAccess` (SEC-10/11) has no callers, so the access log is never written [C5]. |
| **All phases** | — | **add a blocking note** | Definition of Done item 2 (*"CI gates all green (blocking)"*) is currently false: backend `verify` exits non-zero and the CI job cannot run integration tests at all [E2][G1]. No stage should be ticked until this is repaired. |
| plans/README | *"162 tests" / "156 tests, 82% coverage"* | **483 / 290; coverage unmeasured** | Stale counts, and backend coverage is not instrumented at all [G3]. |

**Gates:** G0 is correctly shown as **not passed** (6 of 7 boxes unticked, each blocker named with its
external dependency) — this is accurate and should stay. G1 should be explicitly marked **blocked** on the
Wave 0 items, not merely "open for UAT".

---

## 3. Doc ↔ doc contradictions (surfaced, not resolved)

| # | Contradiction | Where | Who should decide |
|---|---|---|---|
| 1 | **`base` tier scope.** CLAUDE.md §2b: *"base — public — login/health ONLY."* The code has 8 base procedures, including two unauthenticated writes (anonymous POSH and whistleblower intake) that plans/phase-5 Stage 5.5 deliberately specifies. The doc and the design are both defensible; they disagree. | CLAUDE.md §2b vs plans/phase-5 §5.5 | Sponsor/architect — amend the rule to name the anonymous-intake exception |
| 2 | **Role count.** docs/08 §1 defines **10** roles and §3 gives each a navigation shell. `seed-data.ts` seeds **12**, adding `compliance_officer` and `dpo` with no doc entry and no nav. | docs/08 §§1,3 vs `seed-data.ts:17-29` | Amend docs/08 as a Phase-5 amendment |
| 3 | **Permission count.** plans/phase-0 P0-T21 records *"10 roles / 38 permissions / 155 grants"*; the seed now emits **12 / 56 / 219**. | plans/phase-0 vs seed output | Update the plan record |
| 4 | **ceo_cell compensation visibility.** docs/08 §2 grid: `✓(agg only)`; §3: *"aggregate compensation only (averages, not individual salaries — individual visibility requires hr_head/payroll role)"*. The seed grants full `employee.compensation.read`, with the restriction as a code comment no code reads. | docs/08 §§2,3 vs `seed-data.ts:275` | **Sponsor decision D20** |
| 5 | **Vacant-chain behaviour.** docs/04 §5: *"missing approver (vacant manager) → auto-skip-to-next with audit note, never a dead end."* Silent on what happens when *every* step is vacant. plans/phase-1 P1-T10 resolves the silence as *"chain exhausted → auto-approved"*. The doc wins per CLAUDE.md §0, and the doc does not authorise this. | docs/04 §5 vs plans/phase-1 §1.3 | **Sponsor decision D21** |
| 6 | **PostgreSQL version.** docs/02 §1 and docs/14 §2 specify PostgreSQL 16. Development and integration tests run on **14.21**. | docs vs environment | **Sponsor/IT decision D22** |
| 7 | **Node version.** docs/14 §2: *"pin Node 24 LTS"*. CI uses **22**; `package.json` engines say `>=22`; the developer runs **26**. | docs/14 vs `ci.yml` vs local | Pin one everywhere |
| 8 | **MinIO vs SeaweedFS.** docs/11 §4b.3 recommends reusing the running MinIO; docs/14 §4 supersedes it with SeaweedFS. docs/14 says so explicitly, so this is a *resolved* contradiction — recorded only because docs/11 still reads as current. | docs/11 §4b.3 vs docs/14 §4 | Annotate docs/11 |
| 9 | **docs/10 §13 fixture G8** originally printed ₹1,67,007.69 where the correct value is ₹1,67,638.85. Found by `tests/money.test.ts:113-122` and, per that comment, already corrected in the doc. | docs/10 §13 | Resolved — cited as a positive |

---

## 4. docs/16 micro-feature inventory — re-grading guidance

docs/16 carries ~507 rows marked built/specced/partial/gap. Rather than restate all of them, the
systematic corrections that apply across the inventory are:

1. **Anything whose delivery depends on a notification must drop from "built" to "partial"** — the queue
   has no drain and no transport [A2]. This affects every alert, digest, nag and daily-email row.
2. **Anything that runs in `src/jobs/worker.ts` must drop to "partial"** — the worker is not in the PM2
   topology [H2]. This affects Kent sync, recompute drain, week close, OT lapse, leave accrual, comp-off
   expiry, absence scan, boarding/exit, SLA escalation, helpdesk escalation, KPI snapshot, roster nag,
   policy nag — **13 capabilities**.
3. **Anything reading employee data across a scope boundary must be marked defective** until [D2] is
   fixed — the org-unit restriction is computed and discarded.
4. **Anything depending on attendance from the Kent feed is provisional** until a real connector exists
   [A1]; today the source data is synthetic.
5. **Rows marked built on the strength of a green test should be re-checked against [G1]** — the backend
   CI job has never been able to execute the integration suite, so "green" has only ever meant "green on
   one developer's machine".
