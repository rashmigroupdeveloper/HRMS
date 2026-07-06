# Phase 2 — Payroll & Statutory (the takeover)

**Target:** 8–10 weeks · **Gate:** G2 · **Spec:** docs/13 §5, docs/04 §3/§6, docs/10 (rates + golden fixtures), docs/03 §6
**Hard preconditions (do not start 2.2+ without):** the 9 policy decisions of 10 §15 **signed** (Stage 0.1) · attendance month-lock working (Gate G1) · off-box WAL/PITR backups with a **rehearsed restore drill**.

> Statutory formulas are **test-first, no exceptions** (04 §6.9): the golden fixture exists and fails before the engine code is written. Human review mandatory on every `payroll-core/` diff.

---

## Stage 2.1 — Salary components, structures, assignments   `[ ☐ ]`
**Goal:** the salary data model, seeded with RML's real live structure.
**Depends on:** Gate G1; Stage 0.1 (P0-T02/T06 artifacts).
**Tasks:**
- [ ] P2-T01 — Components seed from live recon (09 §2): BASIC, HRA=`BASIC×0.5`, MEDICAL 1250, SPECIAL (balancing), EDUCATION 200, STATUTORY_BONUS=`BASIC×0.0833`; deductions PF_EE (base per signed policy flag), PT, TDS, recovery class (GUEST_HOUSE); employer-side PF_ER/ESI_ER/GRATUITY_ACCRUAL/EDLI/PF_ADMIN; flags (`part_of_gross`, `part_of_pf_wages`, `prorate_on_lop`, rounding, display_order) *(PAY-01)*
- [ ] P2-T02 — Structures per grade/category/location; effective-dated `pay.employee_salaries` with **`EXCLUDE USING gist` overlap constraint** (doc 14 §6.2); **probation % auto-apply + auto-switch on confirmation date**; CTC-vs-breakup validation; new-joiner salary from LOI CTC on conversion *(PAY-01/02/07)*
- [ ] Salary-structure admin UI + ESS "Salary Revision" history view (09 §5)
**Modules/files:** `backend/src/modules/payroll-core/{components,structures,salaries}/`
**Tests required:** formula evaluation vs G1 fixture (Basic 32,286 → the exact live payslip); overlap-insert rejected by DB; probation 80% (G6); CTC≠breakup rejected.
**Exit criteria:** G1 fixture employee's monthly components compute to-the-rupee vs the May-2026 live payslip · overlapping salary row physically un-insertable.

## Stage 2.2 — Run pipeline + compute engine   `[ ☐ ]`
**Goal:** the run state machine and the deterministic compute core.
**Depends on:** 2.1.
**Tasks:**
- [ ] P2-T03 — `pay.payroll_runs` state machine (draft→inputs_locked→computed→under_review→approved→finalized | reopened) as an explicit transition table + DB trigger; **attendance_lock_id NOT NULL from `computed`** (CHECK); finalized rows immutable *(PAY-03, 03 §10)*
- [ ] P2-T04 — Compute engine in 04 §3 exact order: effective salary → days (payable/LOP/LOP-reversal per signed divisor) → earnings (prorate flags) + OT pay + arrears + inputs → gross → PF → ESIC → PT → LWF → TDS → loans/other → net; negative net flagged never clamped; per-line `calc_note`; chunked worker jobs per cost-center *(PAY-03/04/16)*
- [ ] Retro model: **recompute-and-delta** — closed periods recomputed as a new result version, delta paid in current month; `earliest_retro_date` bound *(doc 14 §7.2)*
- [ ] `pay.inputs` (monthly variables), `pay.salary_holds` (payment/process per SOW-5.7) *(PAY-08)*
- [ ] doc14-§7.7 — Independent reconciliation: register totals recomputed via a second code path; must match to the paisa before finalize enables
**Modules/files:** `backend/src/modules/payroll-core/{runs,engine,retro}/`
**Tests required:** state-machine illegal transitions rejected; **property tests** (net = gross − deductions exactly; component sum = gross; paise conservation across register; recompute idempotence — byte-identical); mid-month join G7; hold scenarios.
**Exit criteria:** synthetic 100-employee run computes deterministically twice → identical output hash · run cannot reach `computed` without a locked attendance month · reconciliation path agrees to the paisa.

## Stage 2.3 — Statutory engines (test-first) + apprentice rules   `[ ☐ ]`
**Goal:** every Indian statutory calculation, each landed on its pre-written golden fixture.
**Depends on:** 2.2; P0-T06 signed.
**Tasks:**
- [ ] P2-T05a — **PF**: EE 12% on signed base (ACTUAL vs CEILING flag), EPS 8.33% capped ₹15k, EPF remainder, EDLI, admin; **ECR text file** per EPFO spec + PF register w/ NCP days *(PAY-09; goldens G1, G2)*
- [ ] P2-T05b — **ESIC**: contribution-period state machine (in stays in), 0.75/3.25 round-up, return file *(PAY-10; golden G3a–c)*
- [ ] P2-T05c — **PT-WB** slab table + register (multi-state capable) *(PAY-11; golden G4)*
- [ ] P2-T05d — **LWF-WB** half-yearly ₹3/₹30 + register *(PAY-12)*
- [ ] P2-T05e — **TDS**: old+new regime, A→R IT-statement layout (09 §3), HRA min-of-three (old), 87A + marginal relief, surcharge+cess, declarations→proof-window→verify flow, monthly projection, 24Q data, Form 16 Part B *(PAY-13; golden G5)*
- [ ] P2-T05f — **Apprentice/trainee**: Apprentices Act contracts excluded from PF/ESIC/bonus; stipend processing *(PAY-14; golden G9)*
- [ ] `pay.statutory_rates` + `pay.pt_slabs` + `pay.it_slabs` seeded from doc 10 §12 (effective-dated, source-noted)
**Modules/files:** `backend/src/modules/payroll-core/statutory/{pf,esic,pt,lwf,tds}/`, `tests/fixtures/payroll/golden/`
**Tests required:** goldens G1–G5, G9 written FIRST from doc 10 §13 (hand-computed); rounding-policy table tests; **nightly Stryker mutation run scoped to payroll-core with score threshold**.
**Exit criteria:** all golden fixtures green · mutation score above threshold · a rate change is provably a data row + new golden, not a code change.

## Stage 2.4 — Payslips, outputs, payroll console   `[ ☐ ]`
**Goal:** the artifacts people and portals actually consume — fixed template, every month the same.
**Depends on:** 2.3.
**Tasks:**
- [ ] P2-T06 — Payslip PDF: RML fixed template (09 §2 field block: PAN/UAN/PF No/bank masked/LOP/net in words/leave footer); **three types** (regular, reimbursement, overtime — golden G10 for OT); versioned template config *(PAY-06)*
- [ ] P2-T07 — Outputs per run: bank file (excludes payment-holds, totals row), JV per `pay.gl_accounts` (SAP-consumable), variance report vs prev month (Δ-highlighted); reports R7–R19 *(PAY-05)*
- [ ] P2-T08 — Payroll console UI (05 §4.5): run stepper, review grid (Δ sorted, drawer payslip preview with `calc_note` per line), **typed-confirmation finalize** + hr_head co-sign (two-person rule), outputs card, ESS payslip + YTD tax view
**Tests required:** payslip snapshot per type; bank-file format vs Finance sample (P0-T03); JV totals = register totals; finalize requires both roles (authz test).
**Exit criteria:** finalize ceremony produces payslips ZIP + bank file + JV + statutory registers, each stamped · ESS shows the payslip; template hash unchanged month over month.

## Stage 2.5 — Loans & advances + claims/reimbursements   `[ ☐ ]`
**Goal:** M11 + M12 — everything that feeds deductions and off-cycle payouts.
**Depends on:** 2.2; workflow engine (Phase 1).
**Tasks:**
- [ ] P2-T09 — Loans: types/schedulers (diminishing, flat, EMI-no-interest, advances), eligibility-gated ESS application workflow, EMI auto-deduction postings, perquisite valuation (SBI rate), **SAP legacy import** *(LN-01..04, PP-11)*
- [ ] P2-T10 — Claims: types/entitlements per grade, ESS submission with live balance + bill uploads, RM→HR-verify→payroll-batch chain, partial approval, payout via run **or** off-cycle batch (XOR by DB CHECK), reimbursement payslip, year-end TDS on unsubstantiated, R31 *(CLM-01..07)*
**Tests required:** scheduler math per loan type; outstanding reconciles to postings (property); entitlement bucket edge cases; paid-by-exactly-one constraint.
**Exit criteria:** a loan EMI appears in the next run and outstanding reconciles · a claim walks submission→verify→pay in the off-cycle batch with its own payslip.

## Stage 2.6 — Parallel run, cut-over, annual processes   `[ ☐ ]`
**Goal:** prove the engine against Protiviti's register, to the rupee — then take over.
**Depends on:** 2.4; Protiviti register access.
**Tasks:**
- [ ] P2-T11 — YTD import (mid-year TDS continuity); **parallel run ≥2 consecutive months**: import Protiviti register → per-employee per-component Δ report (R20); **tolerances agreed before starting; reconcile gross before net**; every variance logged with disposition *(04 §6.8, doc 14 §7.5)*
- [ ] P2-T12 — Annual processes: statutory-bonus year-end true-up (8.33–20%, set-on/set-off) + increment processing with effective dates *(PAY-17, 10 §7.1)*
- [ ] Cut-over sign-off pack: HR Head + Finance signatures; Protiviti retirement checklist
**Exit criteria:** month 1 Δs 100% dispositioned; month 2 matches to the rupee (or signed-off) · ECR/ESIC/PT/24Q files **accepted by the actual portals** · restore drill re-run passed within RTO.

---

## Gate G2 — Phase 2 sign-off (Protiviti retired after this gate)
- [ ] Parallel-run register matches to the rupee (or differences signed off by HR Head + Finance)
- [ ] First live payroll month processed end-to-end in HRMS
- [ ] Statutory files accepted by portals (ECR upload verified)
- [ ] PITR restore drill passed; off-box backups verified
- [ ] Payroll UAT (Subhasis + Finance) sign-off; training materials delivered
- [ ] Mutation-testing threshold met on payroll-core; shadow-run harness in place for all future logic changes
