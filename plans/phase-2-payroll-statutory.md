# Phase 2 — Payroll & Statutory (the takeover)

**Target:** 8–10 weeks · **Gate:** G2 · **Spec:** docs/13 §5, docs/04 §3/§6, docs/10 (rates + golden fixtures), docs/03 §6, docs/14 §6–7
**Hard preconditions (do not start 2.2+ without):** the 9 policy decisions of 10 §15 **signed** (Stage 0.1) · attendance month-lock working (Gate G1) · off-box WAL/PITR backups with a **rehearsed restore drill**.

> **14 Oct repair audit:** Stages 2.1–2.6 are reopened for verification. Earlier implementation ticks do not establish the exit criteria. Current defects and remaining scope are recorded for every original SOW row in [the current issue map](../outputs/remediation-2026-10-14/SOW-ISSUES-AND-REMAINING.md). Missing policy signatures, accepted output files, parallel-cycle evidence and restore/UAT receipts remain open. Do not use the historical completion labels to authorize payroll release.

> Statutory formulas are **test-first, no exceptions** (04 §6.9): the golden fixture exists and fails before the engine code is written. Human review mandatory on every `payroll-core/` diff. Float math is banned; all money computations use integer-paise `Money` from `backend/src/core/money/`.

---

## SOW Traceability & Scope Map — original spreadsheet rows

Regenerated on 14 Oct from all 176 original scored rows. IDs below are physical spreadsheet row IDs, including shared dependencies; they do not assert completion. Requirement/card crosswalk remains authoritative. Earlier contiguous block ranges were unverified.

| Exact SOW row IDs | Capability | Card | Requirement IDs |
|---|---|---|---|
| SOW-004, SOW-012, SOW-013, SOW-014, SOW-026, SOW-030, SOW-038, SOW-082, SOW-090, SOW-103, SOW-104, SOW-116, SOW-130, SOW-141, SOW-142, SOW-184 | Salary components, structures and assignments | P01 | PAY-01, PAY-02, PAY-07 |
| SOW-003, SOW-013, SOW-065, SOW-068, SOW-072, SOW-074, SOW-077, SOW-081, SOW-082, SOW-091, SOW-093, SOW-095, SOW-096, SOW-097, SOW-098, SOW-103, SOW-104, SOW-105, SOW-106, SOW-107, SOW-109, SOW-110, SOW-111, SOW-116, SOW-124, SOW-132, SOW-133, SOW-134, SOW-136, SOW-137, SOW-141, SOW-142, SOW-224, SOW-227 | Payroll inputs, runs, LOP and arrears | P02 | PAY-03, PAY-04, PAY-08, PAY-16, PAY-18 |
| SOW-014, SOW-028, SOW-073, SOW-076, SOW-100, SOW-116, SOW-122, SOW-123, SOW-130, SOW-141, SOW-142, SOW-145, SOW-146, SOW-147, SOW-150, SOW-160, SOW-163, SOW-170, SOW-178, SOW-181, SOW-185, SOW-223, SOW-224 | Statutory engines and tax declarations | P03 | PAY-09..14 |
| SOW-023, SOW-030, SOW-044, SOW-075, SOW-076, SOW-098, SOW-099, SOW-100, SOW-101, SOW-136, SOW-139, SOW-147, SOW-150, SOW-163, SOW-170, SOW-175, SOW-178, SOW-181, SOW-182, SOW-187, SOW-225, SOW-230 | Payslips, bank files, JV and outputs | P04 | PAY-05, PAY-06 |
| SOW-029, SOW-118, SOW-119, SOW-120, SOW-121, SOW-122, SOW-124, SOW-125, SOW-221 | Loans and advances | P05 | LN-01..04 |
| SOW-013, SOW-014, SOW-027, SOW-073, SOW-123, SOW-130, SOW-132, SOW-133, SOW-134, SOW-181, SOW-185, SOW-187, SOW-223, SOW-224 | Claims, reimbursements and year-end tax | P06 | CLM-01..07 |
| SOW-005, SOW-076, SOW-081, SOW-107, SOW-116, SOW-184, SOW-185 | Parallel-run validation, annual processes and cut-over | P07 | PAY-04, PAY-13, PAY-17 |

---

## Stage 2.1 — Salary components, structures, assignments (Card P01) — reopened; verification pending
**Goal:** the salary data model, seeded with RML's live structure, with strict DAG formula resolution and effective-dated assignments.
**Depends on:** Gate G1; Stage 0.1 (P0-T02/T06 artifacts signed); F02/F03 data foundation.
**Tasks:**
- [ ] P2-T01 — Components seed from live recon (09 §2):
  - **Earnings:** `BASIC` (~50% gross anchor), `HRA` (`BASIC × 0.50`), `MEDICAL_ALLOW` (fixed ₹1,250/mo), `SPECIAL_ALLOW` (balancing component), `EDUCATION_ALLOW` (fixed ₹200/mo), `STATUTORY_BONUS` (`BASIC × 0.0833`, monthly advance).
  - **Deductions:** `PF_EE` (12% of PF wage base per signed policy), `PT` (West Bengal slab on gross), `TDS` (monthly projection), recovery classes (`GUEST_HOUSE`, electricity, canteen, penalty recoveries via `pay.inputs`).
  - **Employer contributions (CTC / JV only):** `PF_ER` (12% minus EPS), `EPS_ER` (8.33% of PF wages capped at ₹15,000 = max ₹1,250), `EDLI` (0.50% capped at ₹15,000 = max ₹75), `PF_ADMIN` (0.50% min ₹500/est), `ESI_ER` (3.25% of gross), `GRATUITY_ACCRUAL` (~4.81% of Basic).
  - **Component flags:** `part_of_gross`, `part_of_pf_wages`, `prorate_on_lop`, `is_taxable`, `display_order`, `rounding_rule`. *(PAY-01, SOW-072..075)*
- [ ] P2-T02 — Structures per grade/category/location:
  - Directed Acyclic Graph (DAG) formula evaluator: validate expressions, component dependencies, and prevent circular references or division-by-zero.
  - Strict validation: `Annual CTC == Σ(Monthly Earnings + Monthly Employer Costs) × 12` down to the exact paisa; zero floats allowed.
  - Effective-dated `pay.employee_salaries` with **`EXCLUDE USING gist` overlap constraint** (doc 14 §6.2) on `[effective_from, effective_to)`.
  - **Probation % auto-apply (70%/80%/90%) + auto-switch on confirmation date**: probation salary is a first-class phase of the approved structure; confirmation approval (LC-04) atomically commits confirmed-phase salary row without manual intervention. *(PAY-02, PAY-07, SOW-082..090)*
- [ ] Salary-structure admin UI (`/admin/salary-structures`, `/payroll/structures`) + Employee revision history page (`/payroll/revisions`) with before/after comparison and retro period preview.
**Modules/files:**
- `backend/src/modules/payroll-core/components/{component.service,component.router,definitions.ts}`
- `backend/src/modules/payroll-core/structures/{structure.service,dag-evaluator.ts,structure.router}`
- `backend/src/modules/payroll-core/salaries/{salary.service,salary.router,assignment.repository}`
- `frontend/src/pages/payroll/{SalaryStructuresPage.tsx,SalaryRevisionsPage.tsx}`
**Tests required:**
- Formula DAG resolution vs G1 baseline (Basic ₹32,286 → exact live components);
- Overlapping salary row insertion rejected by PostgreSQL `EXCLUDE USING gist` constraint;
- Probation 80% test (G6 fixture: CTC ₹10L → exact monthly gross ₹66,667 / 80% breakup);
- Breakup mismatch `CTC ≠ Σ components` rejected with paise-level diff.
**Exit criteria:**
- G1 fixture employee's monthly components compute to-the-rupee vs May 2026 live payslip;
- Overlapping salary rows physically impossible at database level;
- Automated probation-to-confirmed salary switch verified on test clock.

---

## Stage 2.2 — Run pipeline + compute engine (Card P02) — repairs in progress
**19 October audit/repair increment (PAY-03/07/18, CORE-06/10, D3):** [current journey audit and evidence](../outputs/deep-flow-audit-2026-10-19/REVIEW.md). Test-first native regressions reproduced balanced-but-incomplete payroll and non-India payroll entry. Local guards now compare employee identities (including omissions/equal-count substitutions, employment dates, process holds and existing F&F ownership) and refuse India payroll creation/compute/approval/finalization for disabled legal entities. Six focused suites initially passed18/18; latest rerun17/18 because the concurrent bank repair expects an unapplied `superseded_at` column. Country/population regressions pass. Full verification is RED: concurrent joining-pack schema/import, lint, boundary/knip and runtime/coverage failures are recorded in the linked audit. Payroll-core human review, remaining money defects, integration/parallel-run/UAT evidence and this stage's exit criteria remain open; no phase gate advances.

**Goal:** the 8-state run state machine and the deterministic compute core with independent reconciliation.
**Depends on:** Stage 2.1; attendance month lock (Gate G1).
**Tasks:**
- [ ] P2-T03 — `pay.payroll_runs` 8-state machine:
  - Transition flow: `draft` → `inputs_locked` → `computed` → `under_review` → `approved` → `finalized` → `paid` (plus audited `reopened` revision loop).
  - DB Trigger enforcement: `attendance_lock_id NOT NULL` enforced by CHECK constraint from status `computed`.
  - Finalized runs and associated `pay.payroll_items` are append-only and strictly immutable via DB trigger (rejects `UPDATE`/`DELETE`).
  - Two-person authorization rule: `approved` requires independent checker (`hr_head`); maker (`payroll_admin`) cannot self-approve. *(PAY-03, docs 03 §10, SOW-076..081)*
- [ ] P2-T04 — Compute engine in exact docs/04 §3 sequence:
  1. **Effective Salary:** resolve `pay.employee_salaries` active for the period segment.
  2. **Payable Days & LOP:** calendar days (or policy divisor) minus unpaid days; payable = `P + HD×0.5 + paid-WO + H + paid-L + OD + CO` from locked `att.day_records`.
  3. **Earnings:** prorate flagged components by `payable_days / days_in_month` + approved OT pay + scheduled arrears + monthly variable inputs (`pay.inputs`).
  4. **Gross:** Σ earnings (`part_of_gross`).
  5. **Statutory deductions:** PF → ESIC → PT → LWF → TDS (strictly in this order).
  6. **Other deductions:** loan EMIs (`pay.loans`), salary advance recoveries, canteen/guest-house inputs.
  7. **Net:** Gross − Σ Deductions. **Negative net is NEVER clamped to zero**; flagged as 'review_exception' for manual executive disposition.
  8. **Line Explanations:** persist `pay.payroll_item_lines` with human-readable `calc_note` per line. *(PAY-04, PAY-16, SOW-091..116)*
- [ ] Retroactive payroll model (**recompute-and-delta**):
  - Closed periods are never edited. A retro change recalculates historical periods as new shadow result versions; net delta is paid/deducted in the current open run.
  - Bounded by `pay.earliest_retro_date` setting (default 12 months). *(doc 14 §7.2, SOW-127..137)*
- [ ] Monthly variables & salary holds:
  - `pay.inputs`: typed monthly adjustments (incentives, guest house recoveries) with unique source keys.
  - `pay.salary_holds`: distinguishes **payment hold** (computes gross & statutory liabilities, withholds net disbursement) from **process hold** (treats employee as full LOP). Released holds payout in next cycle without double-taxing. *(PAY-08, SOW-095..098)*
- [ ] Independent Reconciliation Engine (doc 14 §7.7):
  - Secondary verification code path recomputes register totals via set-based SQL; must match engine total to the exact paisa before finalization is permitted.
**Modules/files:**
- `backend/src/modules/payroll-core/runs/{run.service,run-state-machine.ts,run.router}`
- `backend/src/modules/payroll-core/engine/{compute-engine.ts,proration.ts,arrears.ts}`
- `backend/src/modules/payroll-core/retro/{retro.service,recompute-delta.ts}`
- `backend/src/modules/payroll-core/holds/{holds.service,holds.router}`
- `backend/src/modules/payroll-core/reconciliation/{reconciliation.service.ts}`
**Tests required:**
- State machine illegal transition rejections (e.g., cannot jump from `draft` to `computed`);
- Property test: `Net == Gross − Deductions` exactly for every item;
- Property test: conservation of paise across cost-center aggregates;
- Idempotence: recomputing identical inputs produces identical SHA-256 output hash;
- Mid-month joiner (G7 fixture: join 15th, 17/31 payable days).
**Exit criteria:**
- 100-employee synthetic run computes deterministically twice with identical output hashes;
- Run cannot transition to `computed` without a locked attendance month;
- Independent reconciliation path agrees to the exact paisa before `finalized` enables.

---

## Stage 2.3 — Statutory engines (test-first) + apprentice rules (Card P03) — reopened; verified delivery pending
**Goal:** every Indian statutory calculation implemented test-first and verified against Golden Fixtures G1–G5, G9.
**Depends on:** Stage 2.2; P0-T06 statutory policy decisions signed.
**Tasks:**
- [ ] P2-T05a — **Provident Fund (EPF/EPS/EDLI/Admin)**:
  - EE PF: 12% on PF wages (`ACTUAL` full-basic or `CEILING_15000` per `pay.pf_wage_base` setting).
  - ER EPS: 8.33% of min(PF wages, ₹15,000), capped at ₹1,250/mo.
  - ER EPF: 12% of PF wages − ER EPS.
  - EDLI: 0.50% of min(PF wages, ₹15,000), capped at ₹75/mo.
  - Admin charges: 0.50% of PF wages (min ₹500/establishment).
  - NCP days = `lop_days + unpaid_weekoff_days`.
  - Export: ECR text file per EPFO portal spec + PF register. *(PAY-09, Goldens G1, G2, SOW-138..144)*
- [ ] P2-T05b — **Employees' State Insurance (ESIC)**:
  - Contribution-period state machine (Apr–Sep / Oct–Mar): eligibility checked at period entry (gross ≤ ₹21,000). **Once eligible, remains covered for the entire 6-month period** even if wage increases.
  - EE ESIC: 0.75% of gross wages (excl. OT), rounded UP to next rupee.
  - ER ESIC: 3.25% of gross wages (excl. OT), rounded UP to next rupee.
  - Export: ESIC monthly return file (IP number, days, wages, contributions). *(PAY-10, Golden G3a–c, SOW-145..150)*
- [ ] P2-T05c — **Professional Tax (PT)**:
  - Multi-state slab engine with West Bengal default:
    - Gross ≤ ₹10,000: ₹0; ₹10,001–₹15,000: ₹110; ₹15,001–₹25,000: ₹130; ₹25,001–₹40,000: ₹150; > ₹40,000: ₹200.
  - Annual PTRC return register export. *(PAY-11, Golden G4, SOW-151..154)*
- [ ] P2-T05d — **Labour Welfare Fund (LWF)**:
  - West Bengal semi-annual deduction (June & December): EE ₹3, ER ₹30. Form D export. *(PAY-12, SOW-155..157)*
- [ ] P2-T05e — **Tax Deducted at Source (TDS u/s 192)**:
  - Dual regime support: New Regime (default, Budget 2025/26 slabs, ₹75,000 SD, Section 87A full rebate up to ₹12L + marginal relief) vs Old Regime (slabs, Section 80C/80D, HRA min-of-three exemption).
  - Annual taxable income projection: `YTD Actual + (Current × Remaining Months) − Exemptions − Chapter VI-A`.
  - Monthly TDS deduction: `(Projected Annual Tax − TDS Deducted YTD) / Remaining Months`.
  - Previous employer income integration (Form 12B).
  - Exports: Monthly TDS register, Quarterly 24Q text file, Annual Form 16 Part B generator. *(PAY-13, Golden G5, SOW-158..162)*
- [ ] P2-T05f — **Apprentices Act & Trainee Exclusions**:
  - Designated apprentices under Apprentices Act, 1961 excluded from PF, ESIC, and statutory bonus. Stipend processing with distinct tax rules. *(PAY-14, Golden G9, SOW-163..165)*
- [ ] Effective-dated statutory seed: `pay.statutory_rates`, `pay.pt_slabs`, `pay.it_slabs` seeded with official notification sources.
**Modules/files:**
- `backend/src/modules/payroll-core/statutory/{pf.ts,esic.ts,pt.ts,lwf.ts,tds.ts,apprentice.ts}`
- `backend/src/modules/payroll-core/tax-declaration/{declaration.service,proof-verification.ts}`
- `tests/fixtures/payroll/golden/{g1_staff.json,g2_pf_ceiling.json,g3_esic.json,g4_pt.json,g5_tds.json,g9_apprentice.json}`
**Tests required:**
- Hand-computed Golden Fixtures G1–G5 and G9 green to the exact rupee;
- Rounding policy compliance: PF nearest rupee, ESIC round UP, PT integer slabs;
- Nightly mutation testing (Stryker) scoped to statutory engine with 100% branch coverage target.
**Exit criteria:**
- All statutory golden tests pass without rounding variances;
- Statutory rate change provably requires only an effective-dated database row, zero code changes;
- ECR and ESIC export files validate against government schema validators.

---

## Stage 2.4 — Payslips, outputs, payroll console UI (Card P04) — reopened; verified delivery pending
**Goal:** the artifacts consumed by employees, banks, and accounting — strictly formatted and repeatable.
**Depends on:** Stage 2.3.
**Tasks:**
- [ ] P2-T06 — Payslip PDF generation:
  - Fixed RML layout matching live reference: PAN, UAN, PF No, ESIC No, masked Bank A/C, payable days, LOP days, OT hours, earnings, deductions, net pay in words, leave balance footer.
  - Three payslip types supported:
    1. **Regular Payslip:** monthly recurring earnings and deductions.
    2. **Reimbursement Payslip:** non-taxable expense claim settlements.
    3. **Overtime Payslip:** Factories Act base calculation (Golden G10).
  - Versioned template engine; generated PDFs archived into `core.documents` via StorageAdapter (SeaweedFS). *(PAY-06, SOW-166..172)*
- [ ] P2-T07 — Bank and Accounting outputs:
  - **Bank bulk payment file:** NEFT/RTGS CSV formatted to Finance specification; excludes employees on payment hold; includes trailer control totals.
  - **SAP Journal Voucher (JV):** debit/credit breakdown by GL account mapping (`pay.gl_accounts`) and cost-center.
  - Variance report (R10): per-employee component-wise delta comparison against previous month with configurable threshold highlighting. *(PAY-05, SOW-173..178)*
- [ ] P2-T08 — Payroll Console UI (`/payroll/console`):
  - Stepper interface: `Draft` → `Lock Inputs` → `Compute` → `Review` → `Approve` → `Finalize` → `Disburse`.
  - Interactive Review Grid: delta sorting, anomaly filter, salary slip drawer preview with per-line `calc_note`.
  - Finalize Ceremony: typed confirmation ("FINALIZE [MONTH] [COMPANY]"), maker/checker sign-off requirement.
  - ESS surfaces: `/my/pay` payslip view with password-protected PDF download, YTD tax computation statement. *(05 §4.5, SOW-179..186)*
**Modules/files:**
- `backend/src/modules/payroll-outputs/payslip/{payslip-generator.ts,template.service.ts}`
- `backend/src/modules/payroll-outputs/bank/{bank-file.service.ts,bank-formats/}`
- `backend/src/modules/payroll-outputs/gl/{sap-jv.service.ts,gl-mapping.ts}`
- `frontend/src/pages/payroll/{PayrollConsolePage.tsx,PayrollReviewGrid.tsx,PayslipDrawer.tsx}`
- `frontend/src/pages/ess/{MyPayPage.tsx,TaxDeclarationPage.tsx}`
**Tests required:**
- Visual regression & text snapshot for all 3 payslip types;
- Bank payment file format verification against Finance test benchmark;
- SAP JV debit total == credit total == gross cost to company;
- Maker-checker permission gating: `payroll_admin` cannot finalize without `hr_head` co-signature.
**Exit criteria:**
- Finalize execution produces tamper-evident ZIP containing payslips, bank batch, SAP JV, and statutory files;
- Template output hash remains invariant for identical salary inputs;
- Payslip accessible in employee portal immediately upon run release.

---

## Stage 2.5 — Loans, advances & claims management (Cards P05, P06) — reopened; verified delivery pending
**Goal:** deduction automation for staff loans, salary advances, and tax-exempt reimbursement processing.
**Depends on:** Stage 2.2; Workflow engine (Stage 1.3).
**Tasks:**
- [ ] P2-T09 — Loans & Advances engine (Card P05):
  - Loan types: Diminishing Balance, Flat Rate, Interest-Free EMI, Short-term Salary Advance.
  - Immutable loan ledger: balance derived as `SUM(disbursements) − SUM(recoveries)`.
  - ESS application workflow (eligibility gated by tenure and CTC ratio) → approval chain.
  - Automatic payroll deduction posting: monthly EMI enqueued into `pay.inputs` during input lock.
  - Perquisite tax valuation: interest rate differential vs SBI benchmark taxed under Section 17(2).
  - Legacy loan balance import from SAP/greytHR. *(LN-01..04, SOW-118..125)*
- [ ] P2-T10 — Reimbursements & Claims engine (Card P06):
  - Claim types & grade entitlement limits: Medical, LTA, Telephone/Internet, Fuel, Driver, Professional Development.
  - ESS Claim Submission: live balance check (`entitlement − approved claims`), receipt uploads with metadata.
  - Multi-tier verification: Line Manager approval → HR/Finance bill proof verification (line-item approval/rejection).
  - Payout execution: regular payroll line item OR off-cycle bank batch (enforced by DB CHECK `paid_by_run XOR paid_by_batch`).
  - Year-end unsubstantiated proof recovery: unsubstantiated claims treated as taxable earnings in final FY run. *(CLM-01..07, SOW-001)*
**Modules/files:**
- `backend/src/modules/payroll-core/loans/{loan.service,amortization.ts,loan-ledger.repository}`
- `backend/src/modules/payroll-core/claims/{claim.service,entitlement.service,proof-verifier.ts}`
- `frontend/src/pages/payroll/{LoansAdminPage.tsx,ClaimsAdminPage.tsx}`
- `frontend/src/pages/ess/{MyLoansPage.tsx,MyClaimsPage.tsx}`
**Tests required:**
- Amortization calculation accuracy for diminishing vs flat loan schedules;
- Loan ledger property test: balance matches sum of transactions after 12 monthly deductions;
- Claim XOR constraint: payment cannot be routed to both regular run and off-cycle batch;
- Unsubstantiated reimbursement tax recovery correctly adds to taxable gross in Month 12.
**Exit criteria:**
- Approved loan EMI automatically deducts in payroll run and reconciles outstanding balance;
- Verified claims disburse with dedicated reimbursement payslips and clean audit trails.

---

## Stage 2.6 — Parallel run, cut-over & annual processes (Card P07) — reopened; verified delivery pending
**Goal:** prove exact parity with Protiviti/greytHR registers for ≥2 consecutive months, execute annual true-ups, and cut over.
**Depends on:** Stage 2.4; Stage 2.5; Protiviti historical pay register exports.
**Tasks:**
- [ ] P2-T11 — Parallel Run Execution & Delta Analysis:
  - YTD historical payroll data import (ensuring mid-year TDS continuity for all 1,066+ employees).
  - Ingestion of Protiviti Monthly Pay Register and conversion into standardized comparison format.
  - Automated Reconciliation Report (R20): component-by-component, employee-by-employee variance calculation.
  - Variance protocol: **reconcile gross earnings before net pay**; 100% of discrepancies classified (rounding tolerance, policy divergence, or bug).
  - Threshold: zero unexplained discrepancies in Month 2. *(04 §6.8, doc 14 §7.5, SOW-066..071)*
- [ ] P2-T12 — Annual Statutory Processes:
  - Payment of Bonus Act annual true-up: calculation of 8.33% to 20% entitlement against allocable surplus, offset of monthly bonus advances, set-on/set-off accounting. *(PAY-17, SOW-187..190)*
  - Annual increment processing: batch effective-dated salary revision tool with retroactive calculation support.
- [ ] Cut-over sign-off pack — signed receipts not verified:
  - Formal sign-off dossier signed by HR Head, Finance Controller, and Internal Audit.
  - Protiviti contract retirement checklist and historical archive lock.
**Modules/files:**
- `backend/src/modules/payroll-core/parallel-run/{parallel-import.ts,variance-reporter.ts}`
- `backend/src/modules/payroll-core/annual/{bonus-trueup.ts,increment-batch.ts}`
- `scripts/payroll/reconcile-parallel-run.ts`
**Tests required:**
- Parallel run comparison test suite running against anonymized Protiviti register;
- Bonus true-up test covering minimum 8.33%, maximum 20%, and recovery of excess advances.
**Exit criteria:**
- Month 1 variances 100% categorized with signed dispositions;
- Month 2 matches Protiviti register to the rupee (or variance formally signed off);
- Portal files (ECR, ESIC, PT) successfully accepted on government portals;
- PITR database restore drill successfully executed within RTO.

---

## Deep Code Audit & Integrity Repairs (Mapped to Phase 2)

Before executing or signing off Stages 2.1–2.6, the following open code findings from [10-CODE-AUDIT-AND-GAPS.md](sow-completion/10-CODE-AUDIT-AND-GAPS.md) must be resolved:
- **C01 — RBAC Data Scope Filtering:** all payroll procedures (`payroll.run`, `salary.read`, `salary.write`, `compensation.read`) must enforce caller's legal entity and OU boundaries.
- **C07 — Money Floating-Point Immunity:** eliminate any float arithmetic in component calculations, OT divisors, or statutory percentages; enforce integer-paise `Money` exclusively.
- **C10 — Effective Date Overlaps:** enforce temporal exclusion on `pay.employee_salaries` using PostgreSQL `EXCLUDE USING gist` with GiST tsrange/daterange.
- **C11 — Attendance Month-Lock Integrity:** prevent payroll computation if dirty attendance records exist in the locked period.
- **C12 — Two-Person Rule Enforcement:** require independent maker/checker roles for payroll finalization; self-approval strictly rejected.
- **C13 — Immutability Triggers:** verify append-only triggers on `pay.payroll_runs`, `pay.payroll_items`, and `pay.payroll_item_lines`.
- **C30 — Missing Business Routers:** register all payroll, loan, and claim procedures in `backend/src/api/router.ts` with complete Zod input and output schemas.
- **C35 — Centralized Rounding Policy:** strictly bind all statutory deductions to `backend/src/core/money/rounding.ts`.

---

## Gate G2 — Phase 2 Sign-off Criteria (Protiviti Retired)
- [ ] Parallel-run register matches Protiviti to the rupee for 2 consecutive months (or variances formally approved);
- [ ] First live payroll processed end-to-end in HRMS with payslips, bank file, and SAP JV generated;
- [ ] Statutory files (EPFO ECR, ESIC return, PT challan) accepted by official portals;
- [ ] Complete PITR backup restore drill rehearsed and validated on staging;
- [ ] UAT sign-off secured from Subhasis (Payroll Admin) and Corporate Finance;
- [ ] 100% branch test coverage achieved on `backend/src/modules/payroll-core/`.
