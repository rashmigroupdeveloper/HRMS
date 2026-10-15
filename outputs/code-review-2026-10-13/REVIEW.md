# HRMS schema, migration and code review — 13 Oct 2026

**Verdict: material implementation exists, but clear AI-slop patterns remain and the new payroll/lifecycle stages cannot be accepted as complete.** The observable patterns are fixture values used as financial truth, successful-looking controls with no persisted effect, disconnected calculation helpers, invented policy/IDs, synthetic delivery evidence, schema assumptions hidden by an already populated DB, and mocked tests that miss the real API/DB contract. This assessment describes code quality; it does not infer who authored a file.

This is a fresh review of the current shared checkout, not a restatement of the 09/10 Oct review. It records **38 actionable findings: 35 P1 and 3 P2**. P1 means fix before accepting or relying on the affected flow; P2 means required follow-up with lower immediate impact. Individual violations have source locators, requirements, impact, required repair and evidence below. Existing local DBs remain test-only per sponsor instructions.

## Verification actually performed

| Check | Result |
|---|---|
| Backend npm run verify | **Failed** after typecheck, at lint: 603 errors (82 source; 521 tests) |
| Backend test:coverage separately | **Failed**: 351 passed, 16 failed, 27 skipped; 41 files passed, 11 failed |
| Backend coverage | Statements/lines72.27%, functions73.43%, branches69.64%; all below80% general floor |
| Backend knip separately | **Failed**: two unused exports: STANDARD_ONBOARDING_TASKS / STATUTORY_GRATUITY_CAP_PAISE |
| Backend dependency-cruiser separately | Passed:198 modules/742 dependencies |
| Backend build separately | Passed |
| Frontend npm run verify | Passed:233 tests/23 files, including build |
| Native local catalog | PostgreSQL14.24;132 business relations;48 applied migrations;13 missing source files |
| Typed database contract | 92 relations;40 observed relations untyped; two declared GL fields absent physically |
| Fresh migrations, native14 | Failed on NULLS syntax; version differs from target16 |
| Fresh migrations, isolated17.11 | Failed at migration175227: claims.budget_id does not exist |
| HTTP routing probes | Claims/loans requested product paths404; doubled /api paths match401. Other procedure routes disagree with screen callers |
| Read-only/pure behavior probes | Attendance column/enum errors; HD counted as1; recovery displayed but not deducted; missing maker/reconciliation accepted |

Later backend checks were run as **independent diagnostics**, not treated as a passed verify chain. Test failures include old assumptions such as10 roles versus12, setup/API400 failures, and behavioral failures; they are not all attributed to new features. The frontend's existing green tests do not validate the new business flows. PostgreSQL16/Node24 exact-stack acceptance, browser journeys, external connector evidence, statutory-law sign-off, real payment receipts and production/UAT acceptance are not claimed. Statutory review here checks repository consistency and integration, not current law.

## What is real progress

The new code is registered in the router: payroll components/structures/salaries/runs/holds/statutory helpers/parallel run/annual operations, output services, loans, claims, lifecycle submodules and structured surveys. The local database has28 more business relations than the10 Oct baseline104. Effective salary exclusion exists; useful pure Money/statutory/F&F calculations and golden fixtures are present; several transactions and row locks exist, and the module-boundary/build checks pass. Those are useful foundations to repair, not a reason to rebuild a second module.

Core library arithmetic is not sufficient acceptance: the actual run orchestration, DB invariants, workflow authorities, persisted outputs and screen/API contracts must all use the same approved facts. Declared CREATE IF NOT EXISTS statements and TypeScript interfaces do not prove the actual older table has their columns/checks.

## Schema against the remaining plan

- The physical catalog and TypeScript field comparison are saved without employee records or credentials. The schema metadata includes columns, defaults, FKs, indexes and trigger declarations; it is not a data backup.
- The original proposed46 model names are still absent from the observed catalog. This is **not** an instruction to create all46 blindly: they were review proposals behind D decisions, and a justified canonical implementation may use an existing alternative such as core.transfers. Freeze a signed model/ownership decision per stage and demonstrate its invariants.
- Specified education/previous-employment tables remain absent. eng.poll_votes is absent but working eng.poll_responses is the established canonical alternative; do not recreate a parallel ballot table.
- Budget-backed claims/lines/reservations and entity/plant GL mapping exist physically. New reimbursement code must preserve those owners and reconcile their constraints and dimensions.
- Loan postings and finalized payroll line immutability are not enforced by the inspected DB. Claim run/batch XOR is absent on the reused older table. Expected source/type declarations are not proof of these constraints.
- Native PostgreSQL14 cannot reproduce newer SQL in the checkout; exact target16 rehearsal remains required. Using isolated17 exposed the independent budget migration-chain failure rather than hiding behind the older installed schema.

Missing applied migration sources:

- `1752060000000_sec-identity-hardening`
- `1752070000000_cmp-licences-calendar`
- `1752080000000_shift-micro-scheduling`
- `1752090000000_org-mis-spine`
- `1752100000000_prv-dpdp`
- `1752110000000_ess-identity-daily`
- `1752120000000_doc-vault`
- `1752140000000_ird-posh-grievance`
- `1752150000000_pay-budgets-claims`
- `1752160000000_employee-hod`
- `1752170000000_audit-chain-seq`
- `1752180000000_org-spine-integrity`
- `1752190000000_attendance-day-integrity`

## Priority findings

| ID | Priority | Finding | Requirement context |
|---|---|---|---|
| [R01](#r01) | P1 | Fresh migration chain cannot build claims schema | NFR-04, CLM-02 |
| [R02](#r02) | P1 | Applied schema and typed checkout still disagree | CORE-12, NFR-04 |
| [R03](#r03) | P1 | Payroll attendance SQL is incompatible and day arithmetic is unsafe | ATT-09, ATT-15, PAY-04 |
| [R04](#r04) | P1 | Mid-month salary assignments can be skipped silently | PAY-02, PAY-04, PAY-16 |
| [R05](#r05) | P1 | Real payroll never supplies required statutory and debt facts | PAY-09, PAY-10, PAY-12, PAY-13, PAY-14, LN-03 |
| [R06](#r06) | P1 | Recovery inputs print but do not reduce net pay | PAY-04, PAY-08 |
| [R07](#r07) | P1 | Detected OT is paid without approval and uses an absent component | ATT-08, LV-04, PAY-04 |
| [R08](#r08) | P1 | Arrears can be paid again on subsequent runs | PAY-16 |
| [R09](#r09) | P1 | Finalization ignores line and review reconciliation failures | PAY-03, PAY-04, NFR-04 |
| [R10](#r10) | P1 | Closed payroll results remain editable | PAY-03, PAY-16, NFR-04 |
| [R11](#r11) | P1 | Maker/checker validation fails open on missing evidence | PAY-03, CORE-10 |
| [R12](#r12) | P1 | New API routes disagree with product callers | CORE-10, CLM-02, LN-02, PAY-03 |
| [R13](#r13) | P1 | Payroll UI simulates successful computation and payment facts | PAY-03, PAY-05, PAY-06 |
| [R14](#r14) | P1 | API errors silently become sample employee records | LC-01, LC-04, LC-06, LN-01 |
| [R15](#r15) | P1 | New financial/lifecycle endpoints do not enforce ownership scope | CORE-10, LC-06, LN-04 |
| [R16](#r16) | P1 | F&F substitutes fixture salary, leave and payable days | PAY-15, LV-06, LC-06 |
| [R17](#r17) | P1 | F&F can mark paid and issue letters without approval/payment | PAY-15, LC-06, LC-07, CORE-11 |
| [R18](#r18) | P1 | Onboarding conversion is not atomic and creates unusable salary/login | LC-01, LC-02, PAY-02, CORE-04 |
| [R19](#r19) | P1 | Lifecycle approval and notification claims lack workflow records | WF-01, WF-04, LC-04, LC-06 |
| [R20](#r20) | P1 | Probation confirmation leaves a salary gap and zero components | LC-04, PAY-02 |
| [R21](#r21) | P1 | Transfer e-codes use employee count instead of allocator | CORE-02, LC-05 |
| [R22](#r22) | P1 | Future transfers mutate today and promotions do not change salary | LC-05, PAY-16, RPT-05 |
| [R23](#r23) | P1 | ESS loan application bypasses eligibility and approval | LN-01, LN-02 |
| [R24](#r24) | P1 | Loan ledger is mutable and repeated deductions are not unique | LN-03, LN-04, NFR-04 |
| [R25](#r25) | P1 | General claims cannot insert into the actual budget-owned model | CLM-02, CLM-04 |
| [R26](#r26) | P1 | Claim routing declares paid before funds or batch lines exist | CLM-04, CLM-07, LN-03 |
| [R27](#r27) | P1 | Entitlement policy is invented and the reservation check races | CLM-01, CLM-02 |
| [R28](#r28) | P1 | Year-end claim taxable recovery counts unrelated bills repeatedly | CLM-05, PAY-13 |
| [R29](#r29) | P1 | Parallel-run gate can pass with missing population or component errors | PAY-04, PAY-13, NFR-04 |
| [R30](#r30) | P1 | Opening YTD financial facts exist only in process memory | PAY-13, CORE-12 |
| [R31](#r31) | P1 | Apply-increment reports success without salary revisions | PAY-16 |
| [R32](#r32) | P1 | Executive financial KPIs silently substitute estimates | RPT-03, RPT-04 |
| [R33](#r33) | P2 | Output readiness and artifact ownership are inferred incorrectly | PAY-05, PAY-06 |
| [R34](#r34) | P1 | SAP mapping loses legal payer and cost-center dimensions | PAY-05, RPT-06 |
| [R35](#r35) | P2 | Prejoin single-use and at-rest token claims are inaccurate | LC-01, NFR-03 |
| [R36](#r36) | P2 | Biometric verification stamps evidence without checking Kent | LC-02, ATT-01 |
| [R37](#r37) | P1 | Completed-stage and UAT labels exceed verified behavior | NFR-04, CORE-11 |
| [R38](#r38) | P1 | Income-tax seed contradicts its cited reference and FY claim | PAY-13, CORE-12 |

<a id="r01"></a>

### R01 · P1 · Fresh migration chain cannot build claims schema

Source: [backend/migrations/1752270000000_claims-reconciliation.ts](/Users/anooppratapsingh/Documents/HRMS/backend/migrations/1752270000000_claims-reconciliation.ts:29) · NFR-04, CLM-02.

The earlier payroll migration creates a claim table without budget_id/reference; this later migration assumes both exist. Existing hrms masks the missing historical budget migration. Fresh up failed at budget_id on disposable PostgreSQL17; native14 separately fails on NULLS syntax.

**Required repair:** Recover original migration sources, reconcile canonical claims/budgets through forward alterations, then prove empty up, no-op up, down/up and upgrade. Rehearse exact target16.

Evidence: migration-rehearsal-pg17.json; migration-rehearsal.json.

<a id="r02"></a>

### R02 · P1 · Applied schema and typed checkout still disagree

Source: [backend/src/core/db/types.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/core/db/types.ts:1404) · CORE-12, NFR-04.

Local catalog has 132 business relations and 48 applied migrations; 13 applied migration sources are absent. Database interface covers92 relations, leaving40 untyped. pay.gl_accounts declares cost_center_id and gl_description that do not exist physically; actual ownership uses company_code/plant_code/cost_center_code. IF NOT EXISTS does not reconcile a different existing definition.

**Required repair:** Recover and hash migration provenance; reconcile actual table contracts before feature work. Update Kysely types and migrations together, without dropping canonical models. Untyped deferred modules need explicit scope decisions.

Evidence: local-schema.json; types-vs-schema.json.

<a id="r03"></a>

### R03 · P1 · Payroll attendance SQL is incompatible and day arithmetic is unsafe

Source: [backend/src/modules/payroll-core/runs/run.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/runs/run.service.ts:274) · ATT-09, ATT-15, PAY-04.

Actual column is work_date; paid_wo/paid_l are not enum statuses. Read-only EXPLAIN reproduced both errors. COUNT(CASE ... HD THEN0.5) counts HD as1 (P+HD became2 instead of1.5). Zero payable attendance keeps the initialized full month, so correcting SQL alone still overpays wholly absent employees.

**Required repair:** Use work_date plus paid leave/weekoff predicates, SUM weighted days, require complete locked inputs and retain true zero payable days. Integration-test P/HD/LWP/paid-WO/all-absent cases.

Evidence: behavior-probes.json.

<a id="r04"></a>

### R04 · P1 · Mid-month salary assignments can be skipped silently

Source: [backend/src/modules/payroll-core/runs/run.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/runs/run.service.ts:250) · PAY-02, PAY-04, PAY-16.

Salary lookup uses first of month; a new joiner or first assignment effective later that month has no matching row and is silently skipped. emp.doj is loaded but never used to produce the required partial-month pay.

**Required repair:** Resolve approved effective salary segments through the covered period and derive payable tenure from joining/leaving dates. Fail an incomplete run with explicit missing-salary exceptions.

Evidence: Source + specifications.

<a id="r05"></a>

### R05 · P1 · Real payroll never supplies required statutory and debt facts

Source: [backend/src/modules/payroll-core/runs/run.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/runs/run.service.ts:292) · PAY-09, PAY-10, PAY-12, PAY-13, PAY-14, LN-03.

The production orchestration supplies salary/days/inputs/arrears/hold only. It does not load approved effective PF policy, employee applicability/category/contract, ESIC period membership, TDS projection, LWF or loan installments. The engine defaults PF ceiling, TDS/LWF0 and current-gross ESIC; standalone statutory helpers passing tests do not fix the run.

**Required repair:** Freeze and pass authoritative effective policy, membership, tax/YTD and debt facts; call the same tested statutory engines used by previews. Prove end-to-end run goldens including mid-period ESIC increase, apprentice and existing loan.

Evidence: Source + specifications.

<a id="r06"></a>

### R06 · P1 · Recovery inputs print but do not reduce net pay

Source: [backend/src/modules/payroll-core/engine/compute-engine.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/engine/compute-engine.ts:255) · PAY-04, PAY-08.

Deduction-kind variable inputs emit a positive line but never increment totalDeductionsPaise. A synthetic BASIC10000 plus GUEST_HOUSE2500 produced net8800 with only PF1200 deducted; expected recovery changes net to6300 under the same supplied policy.

**Required repair:** Classify input and arrear effects by component kind, validate allowed amounts and update earning/deduction/employer bases consistently. Add an independent full-run recovery fixture.

Evidence: behavior-probes.json.

<a id="r07"></a>

### R07 · P1 · Detected OT is paid without approval and uses an absent component

Source: [backend/src/modules/payroll-core/runs/run.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/runs/run.service.ts:277) · ATT-08, LV-04, PAY-04.

Run sums detected day_record OT instead of approved overtime_entries, with no paid-once/comp-off consumption. Engine emits OT_PAY while seed/local catalog contain OT and no OT_PAY, causing a line FK failure whenever payable OT is produced.

**Required repair:** Consume only approved unconsumed OT against locked inputs; prohibit CO double consumption and bind the approved canonical component/policy base.

Evidence: Source; behavior-probes.json component_fk_targets.

<a id="r08"></a>

### R08 · P1 · Arrears can be paid again on subsequent runs

Source: [backend/src/modules/payroll-core/runs/run.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/runs/run.service.ts:218) · PAY-16.

Unpaid arrears for_month<=month are loaded into calculation, but compute/finalize never marks their consumption or creates a unique consumption posting. Every later run selects the same rows again.

**Required repair:** Reserve/consume each signed delta exactly once in the same financial transaction; preserve original/result versions and retry-safe keys.

Evidence: Source + specifications.

<a id="r09"></a>

### R09 · P1 · Finalization ignores line and review reconciliation failures

Source: [backend/src/modules/payroll-core/runs/run.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/runs/run.service.ts:477) · PAY-03, PAY-04, NFR-04.

Finalize checks aggregate discrepancy only, ignoring recon.isReconciled, lineMismatchCount and negativeNetCount. Reconciliation also compares sum of positive earning+deduction line amounts with net, and does not include that mismatch in isReconciled. Zero aggregate discrepancy can finalize an empty or line-inconsistent run.

**Required repair:** Independently reconcile signed component classes, per-item and full-register totals, expected population and approved review exceptions; require the complete reconciled gate under a transaction/row lock.

Evidence: Source + specifications.

<a id="r10"></a>

### R10 · P1 · Closed payroll results remain editable

Source: [backend/migrations/1752220000000_pay-schema-init.ts](/Users/anooppratapsingh/Documents/HRMS/backend/migrations/1752220000000_pay-schema-init.ts:168) · PAY-03, PAY-16, NFR-04.

Headers guard UPDATE/DELETE only; item lines have no immutability trigger and headers allow INSERT into closed runs. Inputs remain mutable. Finalized runs can be reopened and their results deleted/rebuilt; paid-run updates are unrestricted by the run trigger. Actual catalog confirms no line trigger.

**Required repair:** Protect insert/update/delete of all frozen facts/results using DB constraints/triggers and grants. Retro creates new versions and current-period deltas; preserve original closed results.

Evidence: local-schema.json; source migration/service.

<a id="r11"></a>

### R11 · P1 · Maker/checker validation fails open on missing evidence

Source: [backend/src/modules/payroll-core/runs/run-state-machine.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/runs/run-state-machine.ts:79) · PAY-03, CORE-10.

Missing makerUserId is accepted; missing reconciliationDiffPaise is accepted. Real service derives maker from an optional audit row, and state updates/audit are separate operations without compare-and-swap. Independent hr_head co-sign is not recorded as a distinct required approval.

**Required repair:** Persist authoritative maker/checker records with separate DB-backed authorities, reject missing evidence, and atomically enforce legal transitions/audit/reconciliation.

Evidence: behavior-probes.json; actual run service.

<a id="r12"></a>

### R12 · P1 · New API routes disagree with product callers

Source: [backend/src/modules/claims/claims.router.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/claims/claims.router.ts:86) · CORE-10, CLM-02, LN-02, PAY-03.

Middleware already mounts /api; loans/claims add /api again. /api/claims/my and /api/loans/my return404; /api/api/... matches401. Payroll/lifecycle handlers without explicit routes default to procedure paths/methods; product callers use different REST paths and response envelopes. Claims/loans also bypass authenticated apiFetch with raw fetch.

**Required repair:** Generate and use the OpenAPI client, define explicit matching routes without a duplicate prefix, align input/output contracts and authenticated transport; test real browser->API flows.

Evidence: http-probes.json; openapi.json; ClaimsPage/LoansPage/SeparationBoardPage.

<a id="r13"></a>

### R13 · P1 · Payroll UI simulates successful computation and payment facts

Source: [frontend/src/pages/payroll/PayrollPage.tsx](/Users/anooppratapsingh/Documents/HRMS/frontend/src/pages/payroll/PayrollPage.tsx:291) · PAY-03, PAY-05, PAY-06.

Run controls only change React state and show success toasts; no backend calls occur. Finalize claims outputs generated, downloads only toast, and displayed employees/lock/timing are sample constants. MyPayPage displays a fixed sample payslip and Disbursed to Bank for arbitrary months.

**Required repair:** Read authoritative runs/results, persist actions through protected API, surface pending/error states and download actual generated artifacts. Keep fixture demos outside product routes.

Evidence: Source + specifications.

<a id="r14"></a>

### R14 · P1 · API errors silently become sample employee records

Source: [frontend/src/pages/lifecycle/SeparationBoardPage.tsx](/Users/anooppratapsingh/Documents/HRMS/frontend/src/pages/lifecycle/SeparationBoardPage.tsx:241) · LC-01, LC-04, LC-06, LN-01.

Separation, onboarding, probation and loan screens insert realistic sample IDs/people/amounts in catch blocks without a dev-only guard. Missing/unauthorized/broken APIs look like actual business records, and action buttons can submit sample IDs.

**Required repair:** Remove product fake-data fallbacks; separate explicit dev fixtures and use honest loading/empty/permission/error states. Load master selectors and IDs from the API.

Evidence: Source + specifications.

<a id="r15"></a>

### R15 · P1 · New financial/lifecycle endpoints do not enforce ownership scope

Source: [backend/src/modules/lifecycle/separation/separation.router.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/separation/separation.router.ts:83) · CORE-10, LC-06, LN-04.

Any logged-in caller supplies employeeId for resignation without a self check; Loans getLedger accepts arbitrary loanId without ownership. Many permission-gated payroll/lifecycle/claims handlers discard permissionAccess and operate globally, so scoped managers/HR can act outside their permitted subjects.

**Required repair:** Require one declared business permission and server-derived self/subtree/entity/category scope on reads and writes; deny foreign subject IDs and test all restricted roles.

Evidence: Source + specifications.

<a id="r16"></a>

### R16 · P1 · F&F substitutes fixture salary, leave and payable days

Source: [backend/src/modules/lifecycle/separation/separation.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/separation/separation.service.ts:382) · PAY-15, LV-06, LC-06.

Missing salary uses BASIC32286/Gross64573 from G8, missing inputs use15 payable days and12 EL days, held salary is holds.length>0?0:0, and DOJ has a fallback. These values are written into settlement rows as business facts instead of reading locked attendance/leave/debt/tax ledgers.

**Required repair:** Require authoritative as-of salary, attendance, leave ledger, paid holds, debt and final tax inputs. Fail missing facts explicitly; retain frozen calculation provenance and reviewed overrides.

Evidence: Source + specifications.

<a id="r17"></a>

### R17 · P1 · F&F can mark paid and issue letters without approval/payment

Source: [backend/src/modules/lifecycle/separation/separation.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/separation/separation.service.ts:518) · PAY-15, LC-06, LC-07, CORE-11.

Method accepts any existing settlement, does not validate approved state/resolved clearances/checker or external payment receipt, issues letters then marks paid and changes employee/roles through separate autocommits. Retries can duplicate letters; a later error leaves a partial exit. Endpoint uses payroll.run.manage.

**Required repair:** Implement approved immutable settlement->payment obligation->verified receipt transitions, with maker/checker, idempotency, audit/outbox and atomic exit/letter release. Do not label queued payouts paid.

Evidence: Source + specifications.

<a id="r18"></a>

### R18 · P1 · Onboarding conversion is not atomic and creates unusable salary/login

Source: [backend/src/modules/lifecycle/onboarding/onboarding.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/onboarding/onboarding.service.ts:285) · LC-01, LC-02, PAY-02, CORE-04.

Atomic conversion is claimed but no transaction/row lock wraps employee/user/salary/candidate/tasks/review. It omits cost-center assignment, writes salary component_amounts:{} and password_hash:PENDING_INITIAL_LOGIN without initial credential delivery or employee grants. Failure/retry can leave partial master data.

**Required repair:** Use the existing validated employee/e-code/salary/auth public APIs inside one owned transaction. Resolve mandatory master links and actual salary breakup, candidate consumption key, welcome credentials/grants and outbox tasks.

Evidence: Source + specifications.

<a id="r19"></a>

### R19 · P1 · Lifecycle approval and notification claims lack workflow records

Source: [backend/src/modules/lifecycle/separation/separation.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/separation/separation.service.ts:68) · WF-01, WF-04, LC-04, LC-06.

Resignation creates no wf.request/steps, probation decides directly, and transfers set notified_at=now without enqueueing a notification. Prejoin ingestion sets sent_at although no send is enqueued. Comments/trackers claim multi-tier approval and delivery proof that these paths do not create.

**Required repair:** Wire authoritative versioned workflow requests and domain hooks, transactional audit/outbox and actual notification attempts/receipts. Never manufacture sent/verified timestamps.

Evidence: Source + specifications.

<a id="r20"></a>

### R20 · P1 · Probation confirmation leaves a salary gap and zero components

Source: [backend/src/modules/lifecycle/probation/probation.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/probation/probation.service.ts:191) · LC-04, PAY-02.

The temporal range is [effective_from,effective_to), but confirmation closes the old salary at previous day, leaving that day uncovered. New confirmed salary has empty component_amounts; updates are separate autocommits and there is no completed-review retry guard. Separated outcome only marks the review; no separation is initiated.

**Required repair:** Close the prior interval at confirmation date, resolve actual approved salary amounts, make decision/salary/employee/letter effects atomic and idempotent, and connect non-confirmation separation.

Evidence: Source + specifications.

<a id="r21"></a>

### R21 · P1 · Transfer e-codes use employee count instead of allocator

Source: [backend/src/modules/lifecycle/transfers/transfer.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/transfers/transfer.service.ts:139) · CORE-02, LC-05.

COUNT(current company employees)+1 ignores historical sequences and concurrent requests. Multiple pending transfers obtain the same target code; transfers out make counts smaller. Existing safe core.next_ecode is available.

**Required repair:** Allocate via the canonical locked company sequence within the approved transfer transaction; use an external-identity mapping and concurrent transfer tests.

Evidence: Source + specifications.

<a id="r22"></a>

### R22 · P1 · Future transfers mutate today and promotions do not change salary

Source: [backend/src/modules/lifecycle/transfers/transfer.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/transfers/transfer.service.ts:381) · LC-05, PAY-16, RPT-05.

Approving a future effective date immediately changes the employee master. Salary revision amount is only a history string; no pay.employee_salaries revision is created. Entity changes do not establish aligned OU/cost-center/company and financial continuity.

**Required repair:** Publish effective-dated placement/salary changes; activate projections on effective date with validated aligned links, historical scope snapshots and signed leave/entity payroll continuity.

Evidence: Source + specifications.

<a id="r23"></a>

### R23 · P1 · ESS loan application bypasses eligibility and approval

Source: [backend/src/modules/loans/loans.router.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/loans/loans.router.ts:157) · LN-01, LN-02.

Apply does not call checkEligibility or create an approval workflow; inserts active loans immediately. Missing salary eligibility substitutes50000 monthly gross, with hardcoded service/ratio/benchmark policy. Preview validation does not protect the mutation.

**Required repair:** Check authoritative effective eligibility under lock, require approved workflow/funding evidence and typed policy configuration; start as a request, not an active funded loan.

Evidence: Source + specifications.

<a id="r24"></a>

### R24 · P1 · Loan ledger is mutable and repeated deductions are not unique

Source: [backend/src/modules/loans/loans.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/loans/loans.service.ts:304) · LN-03, LN-04, NFR-04.

Actual loan_postings has no append-only trigger or unique source-consumption key. Retrying the same run/loan inserts another deduction. Balance recomputation uses original principal, not imported opening balance; claim advance settlement directly changes outstanding without a posting. Legacy source writes sap_legacy:reference, which violates the migration source CHECK.

**Required repair:** Use immutable funded/opening/recovery/settlement postings with once-only source keys and SUM-derived debt; reconcile legacy provenance in its own field and validate installment ownership.

Evidence: local-schema.json; service and claims.routePayout.

<a id="r25"></a>

### R25 · P1 · General claims cannot insert into the actual budget-owned model

Source: [backend/src/modules/claims/claims.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/claims/claims.service.ts:142) · CLM-02, CLM-04.

Submit omits funding_kind/budget_id. Actual funding_kind defaults budget and CHECK requires a budget, so a standalone claim fails. New payout_component_code defaults REIMB while local component catalog lacks REIMB. Existing claim_lines and new claim_bills need one explicit canonical receipt/financial-line contract.

**Required repair:** Preserve shared claims ownership; explicitly choose validated entitlement funding, required provenance and existing canonical lines/bills. Bind an approved seeded component and reconcile prior budget reservations.

Evidence: local-schema.json; behavior-probes.json; migration227.

<a id="r26"></a>

### R26 · P1 · Claim routing declares paid before funds or batch lines exist

Source: [backend/src/modules/claims/claims.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/claims/claims.service.ts:269) · CLM-04, CLM-07, LN-03.

Routing immediately marks paid when merely adding a payroll input; off-cycle routing only points at a batch and does not add its payable line or ensure employee/company/run ownership/state. AdvanceLoanId can offset another employee loan and directly changes debt. Actual upgraded claims has no XOR CHECK because CREATE IF NOT EXISTS skipped it.

**Required repair:** Create conserved settlement/obligation/consumption records, validate subject/payer and legal states, materialize frozen payroll/batch lines and mark paid only from payment receipt. Attach invariant CHECKs to the existing table.

Evidence: Source; local-schema.json claims constraints.

<a id="r27"></a>

### R27 · P1 · Entitlement policy is invented and the reservation check races

Source: [backend/src/modules/claims/entitlement.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/claims/entitlement.service.ts:106) · CLM-01, CLM-02.

Unconfigured claims receive guessed15000/5000/2000/50000/10000 limits. Availability is read before submit transaction without a locked reservation, so concurrent claims can both pass. Periods spanning bucket boundaries can evade contained-range totals.

**Required repair:** Use signed effective entitlement rows, exact bucket membership and locked immutable reservation/consumption; reject unconfigured entitlement and test concurrency/period edges.

Evidence: Source + specifications.

<a id="r28"></a>

### R28 · P1 · Year-end claim taxable recovery counts unrelated bills repeatedly

Source: [backend/src/modules/claims/claims.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/claims/claims.service.ts:517) · CLM-05, PAY-13.

Inside each taxable type, the query sums every unverified approved/paid bill for the employee without claim-type or FY filters; multiple taxable types duplicate the same sum and historic bills enter the current year. Unclaimed allowance treatment and final-run posting are not implemented.

**Required repair:** Query each approved taxable bucket/FY and verified line amount exactly once; distinguish unclaimed from unsubstantiated policy and post one idempotent final-FY tax adjustment.

Evidence: Source + specifications.

<a id="r29"></a>

### R29 · P1 · Parallel-run gate can pass with missing population or component errors

Source: [backend/src/modules/payroll-core/parallel-run/variance-reporter.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/parallel-run/variance-reporter.ts:318) · PAY-04, PAY-13, NFR-04.

Gate ignores dataDiscrepancies and unsanctioned policy divergence; an empty HRMS run yields no unexplained bugs and passes. Iteration only covers HRMS population; components can differ while header totals match, yet exact_match is assigned. Comparisons/dispositions/two-cycle sign-offs are not durable.

**Required repair:** Compare the union of both employee/component populations, reject empty/mismatched inputs, and require approved tolerances, explained dispositions and persisted two-cycle human sign-offs.

Evidence: Source + specifications.

<a id="r30"></a>

### R30 · P1 · Opening YTD financial facts exist only in process memory

Source: [backend/src/modules/payroll-core/parallel-run/ytd-loader.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/parallel-run/ytd-loader.ts:47) · PAY-13, CORE-12.

YTD import stores normalized payroll facts in a module Map; restart loses them and clustered API processes see different data. The real run does not consume this state for tax projection.

**Required repair:** Persist immutable reviewed imports/mappings/opening postings with source checksum, employee/FY validation and replay keys; feed the exact facts into payroll snapshots.

Evidence: Source + specifications.

<a id="r31"></a>

### R31 · P1 · Apply-increment reports success without salary revisions

Source: [backend/src/modules/payroll-core/annual/annual.router.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-core/annual/annual.router.ts:237) · PAY-16.

Apply uses client-supplied employee facts, inserts arrears with constant salary_id1, writes no salary revision, then reports employeesUpdatedCount. Repeated invocation duplicates arrears; foreign salary1 can satisfy a simple FK while belonging to someone else.

**Required repair:** Resolve approved employee salary facts server-side, atomically create real effective revisions and replay-safe recompute/delta obligations, and return actual persisted counts.

Evidence: Source + specifications.

<a id="r32"></a>

### R32 · P1 · Executive financial KPIs silently substitute estimates

Source: [backend/src/modules/reports/kpi-snapshot.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/reports/kpi-snapshot.service.ts:313) · RPT-03, RPT-04.

Missing payroll cost becomes CTC/headcount estimation; missing OT cost becomes an estimated hourly rate, sometimes100/hour. These values have no unavailable/estimate marker. OT hours use detected minutes, costs lack ER contributions, and burnout uses hardcoded OT/absence weights instead of the specified configurable composite. Historical requested-date metrics also use current master/status.

**Required repair:** Use approved versioned scoped snapshots from actual finalized financial/approved OT facts; preserve missing versus0, label any approved estimates and implement the signed KPI formulas/settings.

Evidence: docs06 §4; current source.

<a id="r33"></a>

### R33 · P2 · Output readiness and artifact ownership are inferred incorrectly

Source: [backend/src/modules/payroll-outputs/outputs-bundle.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-outputs/outputs-bundle.service.ts:128) · PAY-05, PAY-06.

Statutory outputs are called ready from run state while documentId/generatedAt are null. Payslip readiness needs only one archived slip and generatedAt is now; JV lookup uses month filename without run/company. Finalize itself does not generate these outputs.

**Required repair:** Persist versioned per-run/payer artifacts with checksum, complete population and actual generation receipts; expose availability from those records, not approval state.

Evidence: Source + specifications.

<a id="r34"></a>

### R34 · P1 · SAP mapping loses legal payer and cost-center dimensions

Source: [backend/src/modules/payroll-outputs/gl/sap-jv.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/payroll-outputs/gl/sap-jv.service.ts:90) · PAY-05, RPT-06.

GL mappings across entities/plants/cost centers collapse into a component-only map, so last row wins for all companies. Unconfigured accounts fall back to guessed510xxx/210xxx literals and missing cost center becomes GEN; current DB dimensions are not honored.

**Required repair:** Use the approved scoped GL mapping keys from the canonical table, fail missing/ambiguous mappings and reconcile exact balanced amounts from frozen placement/result versions.

Evidence: Source + specifications.

<a id="r35"></a>

### R35 · P2 · Prejoin single-use and at-rest token claims are inaccurate

Source: [backend/src/modules/lifecycle/onboarding/onboarding.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/onboarding/onboarding.service.ts:117) · LC-01, NFR-03.

Raw bearer token is stored alongside its SHA256 hash. Submission validates before an unguarded update, permitting concurrent successful submissions and overwrites. Data is JSON.stringify-ed before storage in JSONB.

**Required repair:** Store only a hashed expiring invitation token, lock/compare-and-swap atomic consumption, validate typed profile fields and store one consistent object representation; audit and mask statutory data.

Evidence: Source + specifications.

<a id="r36"></a>

### R36 · P2 · Biometric verification stamps evidence without checking Kent

Source: [backend/src/modules/lifecycle/onboarding/task-fanout.service.ts](/Users/anooppratapsingh/Documents/HRMS/backend/src/modules/lifecycle/onboarding/task-fanout.service.ts:191) · LC-02, ATT-01.

Method only flips biometric_registered and completes the task; it never invokes a connector or records source evidence, yet writes Verified against Kent feed. Task/probation reminder helper methods are not registered in the worker.

**Required repair:** Separate human-confirmed versus connector-confirmed evidence, retain actor/source receipt and wire approved scheduled reminder/escalation jobs; do not manufacture integration proof.

Evidence: Source + specifications.

<a id="r37"></a>

### R37 · P1 · Completed-stage and UAT labels exceed verified behavior

Source: [plans/phase-3-lifecycle-assets-executive.md](/Users/anooppratapsingh/Documents/HRMS/plans/phase-3-lifecycle-assets-executive.md:231) · NFR-04, CORE-11.

Phase2 all six stages and Phase3 all five stages are marked completed; G3 says real disbursement/UAT/CEO acceptance/law verification. Current code lacks workflow/payment evidence and full verify is red. This review found no signed acceptance artifacts in docs/outputs; source presence and synthetic tests cannot establish those manual gates.

**Required repair:** Retain work credit but reopen failed acceptance items; attach dated signed evidence for any external/UAT/legal claim. Never infer proof from a checked box.

Evidence: Current trackers; verify/test results; source-path review. Absence of an artifact in this scope is not proof no off-repo human review occurred..

<a id="r38"></a>

### R38 · P1 · Income-tax seed contradicts its cited reference and FY claim

Source: [backend/migrations/1752220000000_pay-schema-init.ts](/Users/anooppratapsingh/Documents/HRMS/backend/migrations/1752220000000_pay-schema-init.ts:439) · PAY-13, CORE-12.

The migration labels its IT seed FY2025-26/2026-27, but inserts only2025-26 rows with a300000 first band and700000 rebate threshold. Its cited doc10 specifies a400000 first band and1200000 rebate threshold. Separate helper constants do not reconcile this contradictory persisted configuration. This is a repository-consistency finding, not certification of current law.

**Required repair:** Resolve D01 with signed authoritative notification/FY evidence; keep one effective-dated statutory policy source shared by real payroll and previews, with independent goldens and explicit unsupported-FY failures.

Evidence: Migration seed versus docs10 §6 and §15.

## Repair order and proof required

Continue one approved existing stage at a time; this review advances no gate. The first dependency remains **Phase0 Stage0.2 / F01**: recover migration provenance, reconcile the actual canonical tables/types and pass a clean target16 migration rehearsal and backend verify. Avoid weakening coverage/lint or removing DB constraints to make the checks green.

Then repair Phase2 Stage2.2 production orchestration with independent full-run goldens: locked attendance, joining/leaving/salary intervals, signed policy/membership/tax/debt facts, deduction input handling, approved once-only OT/arrears, complete reconciliation and immutable results. Resolve its governing P01/P03 input contracts within their own approved stages rather than shipping another disconnected calculator.

Repair scoped workflow/domain authority and transaction/outbox/payment receipt boundaries before accepting claims, loans, F&F, onboarding or transfers. Replace all product mock records/success toasts with persisted API flows. Persist YTD/comparison/increment source facts and independently signed cut-over dispositions. Restore actual scoped KPI/artifact ownership and missing-data behavior.

For each repair prove the real browser->protected procedure->transaction/DB constraint->readback/output path, including deny cases, concurrency, rollback, retries and missing inputs. Money expectations must be independently computed; memory query-builder mocks alone cannot establish FK/temporal/immutability or API correctness. Human payroll/statutory review and signed applicable policy/UAT evidence remain mandatory.

## Review evidence and limits

`findings.json` contains all38 locators and repairs; `verification.json` records exact results/limits; `local-schema.json`, `types-vs-schema.json`, `migration-rehearsal*.json`, `http-probes.json`, `behavior-probes.json`, `lint-findings.json` and generated `openapi.json` contain reproducible evidence. `source-inventory.json` fingerprints424 owned source/test/migration/script files. Critical money/lifecycle/schema/API paths were manually reviewed; the full file scan and this review do not prove every line, screen, policy or external service correct. Revalidate hashes before repair if the shared checkout changes.

Existing hrms schema was not migrated or edited by this review. Catalog/probes were read-only; the expressly approved local test target was used for test fixtures. Fresh-chain migrations ran only in disposable review databases, which were removed; the temporary PostgreSQL17 server was stopped. No application source was changed and no prior completion ticks were silently removed.
