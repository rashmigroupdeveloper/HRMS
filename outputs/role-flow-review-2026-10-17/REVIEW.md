# Separate attendance, HR Head, payroll and LOI flow review

**17 Oct 2026 · Phase1 Stage1.8 review · not ready for full SOW acceptance.**

The first/second-half attendance implementation has useful tested slices. Several surrounding role handoffs remain unsafe or incomplete. This review separates **49 action cases**, records **19 native HTTP/PostgreSQL observations** and groups current/retained gaps into **17 findings**. It changed no application code, policy, migration or real employee. The review is complete; the failures are not repaired by writing this report.

## Results by role/flow

| Flow | What has evidence | What still prevents completion |
|---|---|---|
| Employee attendance | Half-day P:A/A:P representation, configured half-window API, AR/OD selected-half overlays and automated request/recompute cases | Real Kent adapter; disjoint split timing and leave/off-half reconciliation; actual plant acceptance |
| Manager | Workflow decisions, scope/overlap/held-routing tests; readonly mutation safety from prior repairs | Shift scheme employee-scope bypass, complete month attestation/close, payload/chain-version and delegation acceptance |
| HR Ops | Own-unit override API can write; employee direct override is403; selected muster/AR export tests | Foreign-unit day/scheme access, whitespace reasons, locked-day false success, stale OT/penalty facts, absence/export/dashboard scope and correction UI |
| HR Head | Payroll readonly API review is200; compute is403; held-routing backend API exists | Required HR co-sign can be replaced by a second payroll user; recovery screen and lifecycle/LOI approval handoffs incomplete |
| Payroll | Transaction/lock, missing salary/day guards, reconciliation and maker-self-approval protection exist | Console uses synthetic employees and local success; mandatory HR authority, full statutory/debt/OT/arrears source consumption, real versioned artifacts/parallel acceptance |
| LOI/onboarding | Candidate/prejoin/conversion scaffolds, e-code allocator and task/probation tables exist | No proven ATS intake job/LOI chain; inferred offer status is wrong; conversion atomicity/identity/salary/scope/readiness and stakeholder access unsafe |
| Other HR | Some backend/UI slices and tests exist | Existing confirmation/transfer/separation/F&F, audience/survey/policy/helpdesk/assets/KPI and operational evidence remain open |

## Native observations that matter

1. **RF01/RF07/RF08:** scoped HR writes another unit's attendance, reads that day and changes that employee's scheme: all200. Central permission membership does not replace per-row population checks.
2. **RF04:** five spaces satisfy mandatory override reason. **RF05:** locked correction returns200 while the row stays P. Source also records a success audit despite the no-op. **RF06:** changing P to A retains120 OT minutes and penalty_flag=true.
3. **RF12/RF13:** HR Head can read the actual payroll list and cannot compute without manage authority: positive controls.
4. **RF14/RF15:** maker self-approval is blocked but surfaced as generic500; another payroll-only user approves200, with no HR Head. Fixture inserted an under_review run with a valid attendance-lock reference and explicit synthetic maker audit to isolate authorization; it was not a full payroll calculation or disbursement.
5. **RF16:** future January2027 manual employee population with no processed days gets canLock=true, and manager approval is disabled by policy. The probe inspected the checklist only; it did not lock the month.
6. **RF17:** IT cannot list onboarding tasks (403) because routes demand HR conversion permission. **RF18:** no_show becomes Rejected LOI without a rejection event. **RF19:** no offer/loi/offer_loi definition found in the local catalog; Phase4 LOI remains scheduled work, not a newly introduced regression.
7. **RF09:** own timing API returns the configured default GEN full window; that default has no half boundary. This is a configuration gap, not grounds to invent a midpoint. Existing G5 half tests cover configured halves.
8. **RF10/RF11:** payroll list is POST200, GET404. A POST read is legitimate under the current contract; product callers must use the declared method/path instead of guessing REST routes.

All fixtures, audits, role grants, sessions and synthetic domain writes in the probe transaction were rolled back. Final check found zero fixture users. No bank, government portal, Kent, ATS, SMTP or other external integration was contacted. No current browser walkthrough is claimed; pack27 retains the16Oct synthetic half-UI walkthrough.

## Detailed findings and repair acceptance

### F01 — Scheduled attendance ingestion still uses a mock Kent connector (P1)

Source-confirmed; real Kent was not contacted.

Required repair evidence: Obtain authorized Kent protocol, select a real adapter with explicit environment configuration, preserve raw identity/provenance and watermark/gap handling; prove recorded and real delayed/reconnect cases. Synthetic swipes cannot be presented as actual employee punches.

Owner: Phase 0 Stage 0.6 / Phase 1 Stage 1.1. Requirements: ATT-01, ATT-02, ATT-03.

- [backend/src/modules/attendance/kent-sync.job.ts:19](../../backend/src/modules/attendance/kent-sync.job.ts:19)

### F02 — Scoped HR can override and read another unit employee attendance (P1)

RF01=200 writes outside scope; RF07=200 reads the foreign synthetic day.

Required repair evidence: Apply central employee scope to read and write; same-unit works, foreign employee is denied, cross-entity reporting-tree permissions still work when legitimately granted.

Owner: Phase 1 Stage 1.2. Requirements: CORE-10, ATT-17. Prior findings: H01, R15.

- [backend/src/modules/attendance/attendance-config.router.ts:433](../../backend/src/modules/attendance/attendance-config.router.ts:433)
- [backend/src/modules/attendance/attendance-config.router.ts:389](../../backend/src/modules/attendance/attendance-config.router.ts:389)

### F03 — Locked correction reports success and a whitespace reason is accepted (P1)

RF04=200 with five spaces; RF05=200 but locked status remains P. Source writes success audit regardless of affected rows.

Required repair evidence: Trim and validate reason, employee/day/month lock in stable order, require actual affected row, atomically commit correct before/after audit. Locked correction must return a domain error and no success audit.

Owner: Phase 1 Stage 1.2. Requirements: ATT-15, ATT-17, CORE-11. Prior findings: H03, H04.

- [backend/src/modules/attendance/day-status.service.ts:626](../../backend/src/modules/attendance/day-status.service.ts:626)
- [backend/src/modules/attendance/attendance-config.router.ts:441](../../backend/src/modules/attendance/attendance-config.router.ts:441)

### F04 — Marking Absent retains old overtime and penalty facts (P1)

RF06: status A retains 120 OT minutes and penalty_flag=true.

Required repair evidence: Define/reconcile derived facts and approved obligations; never blindly erase immutable swipes/OT approval. Make day, muster, exception display and payroll eligibility agree; audit each correction.

Owner: Phase 1 Stage 1.2. Requirements: ATT-03, ATT-05, ATT-08, ATT-17. Prior findings: H05.

- [backend/src/modules/attendance/day-status.service.ts:626](../../backend/src/modules/attendance/day-status.service.ts:626)

### F05 — Shift-scheme mutation has no employee population check (P1)

RF08 scoped HR successfully updates the foreign synthetic employee scheme.

Required repair evidence: Apply existing employee-scope check, active shift validation, audited atomic change and recomputation scheduling; block unsafe changes to closed facts. Prove a manager cannot change an unrelated employee.

Owner: Phase 1 Stage 1.2. Requirements: ATT-04, CORE-10.

- [backend/src/modules/attendance/attendance-config.router.ts:200](../../backend/src/modules/attendance/attendance-config.router.ts:200)

### F06 — Month checklist can show future/incomplete manual attendance as ready (P1)

RF16 future January 2027 checklist canLock=true for synthetic manual employee population with no January day rows; manager-approval policy is disabled. No lock was executed.

Required repair evidence: Validate closed time window, complete expected employee/date population, unresolved recomputations/leave/request facts and attestation revision. Payroll already rejects missing day rows later; catch the gap before irreversible attendance lock. Establish signed manager-precondition policy.

Owner: Phase 1 Stage 1.7. Requirements: ATT-12, ATT-15. Prior findings: R03.

- [backend/src/modules/attendance/month-lock.service.ts:39](../../backend/src/modules/attendance/month-lock.service.ts:39)

### F07 — Payroll console simulates computation, approval, finalization and export (P1)

Source-confirmed: INITIAL_REVIEW_ITEMS, fixed June 2026 and local setCurrentRunStatus handlers; no backend action in those handlers.

Required repair evidence: Replace sample records and local success with selected real company/month/run API; actual register/reconciliation, server transitions, capability-gated actions and real downloadable artifacts. Empty/error cannot become invented payroll.

Owner: Phase 2 Stage 2.4. Requirements: PAY-03, PAY-05, PAY-06, PAY-18. Prior findings: R13, G09.

- [frontend/src/pages/payroll/PayrollPage.tsx:82](../../frontend/src/pages/payroll/PayrollPage.tsx:82)
- [frontend/src/pages/payroll/PayrollPage.tsx:306](../../frontend/src/pages/payroll/PayrollPage.tsx:306)

### F08 — Two different payroll users satisfy approval without mandatory HR Head sign-off (P1)

RF14 self-approval is refused (generic HTTP500); RF15 a different payroll-only user approves HTTP200. No HR Head participated. Synthetic under_review fixture included a valid attendance-lock FK and explicit maker audit; this checks authorization, not a full computed run.

Required repair evidence: Represent distinct maker/checker duties through centrally configured capabilities and recorded evidence; no handler role-name hardcoding. Require independent authorized HR co-sign and payroll action against unchanged result revision; return useful safe domain errors. Existing maker-identity checks must remain.

Owner: Phase 2 Stage 2.2. Requirements: PAY-03, PAY-18, CORE-10. Prior findings: R11.

- [backend/src/modules/payroll-core/runs/run.router.ts:122](../../backend/src/modules/payroll-core/runs/run.router.ts:122)
- [backend/src/modules/payroll-core/runs/run.service.ts:158](../../backend/src/modules/payroll-core/runs/run.service.ts:158)

### F09 — Payroll orchestration still lacks complete statutory/OT/debt/arrears source consumption (P1)

Source reconfirmed: computeLockedRun supplies salary, attendance, variable inputs, arrears and hold; it does not wire full statutory/previous-employer/YTD/debt facts; approved OT deliberately blocks instead of being paid with a guessed rate.

Required repair evidence: Use signed effective policy facts and immutable source/consumption authority, lawful entity eligibility, complete salary segments, verified YTD and obligations. Prove repeated recompute/next run cannot double-pay or double-deduct; preserve fail-closed OT until correct integration. Money edits require full docs04/10, golden/property cases and human review.

Owner: Phase 2 Stages 2.1–2.6, one at a time. Requirements: PAY-03, PAY-07, PAY-08, PAY-09, PAY-10, PAY-11, PAY-12, PAY-13, PAY-16, LN-03. Prior findings: R05, R07, R08, G08.

- [backend/src/modules/payroll-core/runs/run-compute.service.ts:190](../../backend/src/modules/payroll-core/runs/run-compute.service.ts:190)
- [backend/src/modules/payroll-core/runs/run-compute.service.ts:107](../../backend/src/modules/payroll-core/runs/run-compute.service.ts:107)

### F10 — Candidate conversion is not one transaction and can create unusable employee identity/pay (P1)

Source reconfirmed; earlier H14 native autocommit orphan evidence remains applicable. Conversion uses plain db calls, placeholder password hash, optional salary and empty component snapshot; no readiness/source-target scope/DOJ gate beyond converted status.

Required repair evidence: Atomic candidate lock/conversion, accepted version evidence, approved DOJ readiness, source/target masters/scope, allocator, real identity invitation/employee grant, valid salary snapshot, tasks, probation, audit/outbox. Failure/concurrent retry creates no orphan or duplicate. Do not invent missing CTC, DOB, manager or bank.

Owner: Phase 3 Stage 3.1. Requirements: LC-01, LC-02, PAY-02, PAY-07, CORE-02, CORE-06, CORE-10. Prior findings: H08, H09, H14, R18.

- [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:216](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts:216)
- [backend/src/modules/lifecycle/onboarding/onboarding.service.ts:309](../../backend/src/modules/lifecycle/onboarding/onboarding.service.ts:309)

### F11 — Onboarding stakeholders lack task access and biometric verification lacks provider proof (P1)

RF17 IT task-list HTTP403; task routes require lifecycle.onboard.convert. Existing verify service stamps completion without Kent adapter evidence; prior H10 native proof retained.

Required repair evidence: Scoped stakeholder tasks without HR conversion authority; only permitted owner can complete. Biometric registration needs actual authorized provider result + matching employee, not a success stamp. Configure task SLA/owner data and prove notifications/escalation execution.

Owner: Phase 3 Stage 3.1. Requirements: LC-02, CORE-10, ATT-01. Prior findings: H10, H11, R36.

- [backend/src/modules/lifecycle/onboarding/onboarding.router.ts:238](../../backend/src/modules/lifecycle/onboarding/onboarding.router.ts:238)
- [backend/src/modules/lifecycle/onboarding/task-fanout.service.ts:171](../../backend/src/modules/lifecycle/onboarding/task-fanout.service.ts:171)

### F12 — Lifecycle decisions are not fully connected to required approval/payment history (P1)

Source reconfirmed: probation emits issued letter with null workflow/document, transfers stamp notified_at directly, separation/F&F directly mutate state. Prior financial fixture/payment and salary-boundary findings remain open.

Required repair evidence: Versioned domain↔workflow link; every actual required approver and delivery receipt; no future-effective early mutation; confirmation salary interval/breakup; clearances, settlement approval and acknowledged payment before paid/letters/alumni cascade. Native end-to-end HR Head/Finance journeys required.

Owner: Phase 3 Stages 3.1–3.3, one at a time. Requirements: LC-04, LC-05, LC-06, LC-07, PAY-02, PAY-15, WF-04, CORE-09. Prior findings: R16, R17, R19, R20, R22.

- [backend/src/modules/lifecycle/probation/probation.service.ts:143](../../backend/src/modules/lifecycle/probation/probation.service.ts:143)
- [backend/src/modules/lifecycle/transfers/transfer.service.ts:429](../../backend/src/modules/lifecycle/transfers/transfer.service.ts:429)
- [backend/src/modules/lifecycle/separation/separation.service.ts:517](../../backend/src/modules/lifecycle/separation/separation.service.ts:517)

### F13 — LOI approval/acceptance integration is incomplete and reporting infers incorrect offer outcomes (P1)

RF18 no_show maps to Rejected LOI without rejection fact. RF19 no offer/loi/offer_loi catalog rows. Source: no ATS intake worker registration; recruitment UI claims nightly feed/report integration.

Required repair evidence: Capture authorized ATS source contract. Separately model draft/approval/issued/accepted/rejected/joined/no-show events using approved source fields; preserve offer version and CTC/probation approval. Do not treat no-show as rejection. Prove Initiator→Plant Head/GM→HR Head→CEO→issue, acceptance, idempotent handoff and R21 from actual events. Phase4 work is scheduled scope, not a newly introduced regression.

Owner: Phase 3 Stage 3.1 bridge; Phase 4 ATS absorption. Requirements: LC-01, PAY-02, PAY-07, WF-01, RPT-02.

- [backend/src/modules/reports/reports.service.ts:961](../../backend/src/modules/reports/reports.service.ts:961)
- [frontend/src/pages/recruitment/RecruitmentPage.tsx:21](../../frontend/src/pages/recruitment/RecruitmentPage.tsx:21)
- [backend/src/jobs/worker.ts:85](../../backend/src/jobs/worker.ts:85)

### F14 — HR export, absence and dashboard scope gaps remain (P1)

Source reconfirmation of prior H07/H12/H13; R21 accepts scope but does not apply it. No new cross-company export was executed in this increment.

Required repair evidence: Same authorized population in list, count, tile and Excel; explicit candidate/company scope before employee conversion; preserve column masks, filter parity and audited exports. Repeat prior native cross-company probes as repair regressions.

Owner: Phase 1 Stages 1.6/1.7 and owning report stages. Requirements: CORE-10, ATT-10, ATT-11, RPT-02, RPT-03, RPT-06, AST-06. Prior findings: H07, H12, H13.

- [backend/src/modules/reports/reports.service.ts:917](../../backend/src/modules/reports/reports.service.ts:917)
- [backend/src/modules/attendance/absence.router.ts:20](../../backend/src/modules/attendance/absence.router.ts:20)

### F15 — HR routing repair exists as API but has no dedicated recovery screen (P2)

Source: hold-list/retry backend routes exist; no routing-holds/retry-routing caller in frontend. Prior native vacancy hold/retry evidence remains positive.

Required repair evidence: Show scoped waiting-for-HR queue, cause, hierarchy/chain repair and audited reasoned retry. Retry must never itself approve. Prove actual email delivery separately from queue insertion.

Owner: Phase 1 Stage 1.3. Requirements: WF-01, WF-02, WF-04. Prior findings: G03.

- [backend/src/modules/workflows/workflow-holds.router.ts:8](../../backend/src/modules/workflows/workflow-holds.router.ts:8)

### F16 — Lifecycle HTTP/UI contract failures are masked by sample fallback data (P1)

Source: onboarding catches list failure and fills sample candidates; separation does the same for empty/error data. Several caller paths do not match registered nested procedures. Payroll POST list works; equivalent GET gives404 (RF10/11), which is not itself a defect when POST is the declared contract.

Required repair evidence: Generated actual HTTP contract, typed DTO/date output and runtime permissions, real lookup IDs; no sample business records on errors. Exercise each role screen→API→DB→reload and exports.

Owner: Phase 3 owning stages. Requirements: LC-01, LC-04, LC-05, LC-06, CORE-14. Prior findings: R12, R14, G05.

- [frontend/src/pages/lifecycle/OnboardingBoardPage.tsx:161](../../frontend/src/pages/lifecycle/OnboardingBoardPage.tsx:161)
- [frontend/src/pages/lifecycle/SeparationBoardPage.tsx:182](../../frontend/src/pages/lifecycle/SeparationBoardPage.tsx:182)

### F17 — Release acceptance and other SOW families remain open (P1)

Existing workplace, assets, KPI, deployment, SMTP/storage, real master, Kent/UAT and coverage findings are retained. They are not independently exhaustively rerun by the19 diagnostic observations.

Required repair evidence: Close existing audience/survey/policy/helpdesk/custody issues, signed decisions, real source reconciliation, role training, restore/scale evidence and full gates; claims/budgets remain sponsor-deferred. Do not relabel carried findings as newly tested or repaired.

Owner: Respective owning stages / release gates. Requirements: CORE-14, RPT-03, AST-01, HD-01, EN-01.

- [plans/sow-completion/22-OTHER-MODULE-BUG-AUDIT.md:3](../../plans/sow-completion/22-OTHER-MODULE-BUG-AUDIT.md:3)
- [plans/sow-completion/19-BACKEND-REPAIR-SCOPE-AND-PROGRESS.md:1](../../plans/sow-completion/19-BACKEND-REPAIR-SCOPE-AND-PROGRESS.md:1)

## Verification and database limits

Fresh complete suites: **529 backend tests /68 files, no skips;262 frontend tests /28 files**, all passing. Backend static checks and separate build pass. Frontend full verify/build pass. **Backend full verify remains exit1**: global lines/statements76.85%, branches72.48%, functions81.54%; unchanged required floor80%. Existing frontend ~925KB bundle warning remains. Passing existing tests does not negate the reproduced failures above.

Fresh read-only catalog: **132 business parent relations /1,381 columns**, unchanged from pack26. Relative to14Oct, the only added columns remain session refresh-token hash and regularisation day portion. No columns/tables/migrations were added for this review. This is catalog parity, not certification that every historical field is necessary or every constraint/transaction is correct; pack18's nine schema-purpose findings remain. The local runtime reports **PostgreSQL14.24**, while the locked target is16; target-environment validation/upgrade planning is still required, and no database upgrade was attempted.

All499 application/migration/test source hashes captured at the beginning match after verification. Earlier uncommitted work was preserved. No payroll/statutory implementation changed here; earlier mandatory human-review requirements remain.

## Remaining SOW

Read [all176 original row texts and remaining obligations](SOW-REMAINING.md), [exact structured context](sow-scope-current.json) and [workbook parity](sow-source-parity.json). The original SOW is evidence of scope; its old vendor completion cells are not current HRMS acceptance.

Carried review labels remain109 blocked by reviewed defects,32 needing current end-to-end verification,6 pending scope decisions and29 manual/service evidence duties. These are historical audit categories, not a freshly measured completion percentage. This review promotes **zero full SOW rows**. Claims and budgets remain sponsor-deferred, including dependent settlement acceptance; they are not removed from scope. Pending operations include real master/migration validation, notification delivery, compliance/manual-service evidence, real connector contracts, role training/UAT, backup/restore/scale and original phase gates.

## Practical next work

**Next implementation stage: Phase1 Stage1.2**, repair F02–F05 together as the scoped HR attendance correction/scheme unit, with regression cases before changes. Then stop/report. Subsequent separately announced stages cover month-close/report scope, hold recovery UI, real Kent integration, payroll authority/source/UI, atomic onboarding and LOI/ATS work. The detailed relationships, transaction rules, screen requirements and acceptance sequence are in [DATA-FLOWS.md](DATA-FLOWS.md); the separate action cases are in [ROLE-CASES.md](ROLE-CASES.md).

No phase gate or whole-module completion flag is advanced by this audit.
