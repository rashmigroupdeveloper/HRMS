# Phase 2 — Payroll & Statutory (the takeover)

**Target:** 8–10 weeks · **Gate:** G2 · **Spec:** docs/13 §5, docs/04 §3/§6, docs/10 (rates + golden fixtures), docs/03 §6
**Hard preconditions (do not start 2.2+ without):** the 9 policy decisions of 10 §15 **signed** (Stage 0.1) · attendance month-lock working (Gate G1) · off-box WAL/PITR backups with a **rehearsed restore drill**.

> Statutory formulas are **test-first, no exceptions** (04 §6.9): the golden fixture exists and fails before the engine code is written. Human review mandatory on every `payroll-core/` diff.
>
> **Also blocking for 2.2+:** Gate **G5a** (wage-definition, MFA/step-up, DPDP baseline, masked sandbox) and **Stage 2.0** (company / plant / MIS spine). Do not compute a rupee without those filters.

**Catalog of holes this phase now owns:** [`coverage-closeout.md`](coverage-closeout.md) · Register E12–E20 in [`amendments-existing-phases.md`](amendments-existing-phases.md).

---

## Stage 2.0 — Company, plant, MIS & department spine   `[ ◐ DB integrity + unified masters UI + scoped directory/report predicate · live backfill / complete filter adoption / payroll scope still open ]`  🔒 blocks 2.2
**Goal:** every employee, every payroll run, every register and every dashboard slices on the same codes Finance and SAP already use — not on a display name.
**Depends on:** Gate G1; P0-T30 companies/cost centres. **Closes:** CORE-04 depth, GAP-B08 reporting half. **Requirement IDs:** `ORG-01..08`

Today CORE-04 stores a **cost centre** (e.g. `1701`) and a **company_id**. That is not enough. A steel group queries *company-wise, plant-wise, MIS-wise, department-wise*. Cost centre ≠ plant. Department name ≠ MIS code.

**Tasks**
- [~] `P2-T20` **ORG-01 company code.** `core.companies.code` is the SAP/company code (RML, RGH, RDL, RPL, …) **and** a separate `sap_company_code` if they ever diverge. Every payroll run, bank file, JV and register is stamped with it. UI and exports never show only the legal name. *Schema + audited master UI exist; downstream payroll/bank/JV/register stamping cannot be complete before those Stage 2 modules exist.*
- [~] `P2-T21` **ORG-02 plants.** New `core.plants`: `plant_code` (SAP WERKS / greytHR plant, e.g. KGP, DIP-6, 1701-plant), `company_id`, `location_id`, status. **A plant has many cost centres; a cost centre belongs to exactly one plant.** Backfill from live cost-centre/plant mapping (P0-T30 + greytHR recon); do not guess. *Schema, CRUD and same-company DB constraints are complete; live plant/cost-centre backfill is not.*
- [~] `P2-T22` **ORG-03 MIS code.** New `core.mis_codes` (code, name, company_id, optional parent) and `core.departments.mis_code_id`. The EMS “MIS” *department* (10 people) is a department; this is the **management-information code** used to slice reports. Seed from the Finance/SAP MIS list (external input, like Kent) — never invented. *Schema, CRUD and Department mapping tab are complete; Finance has supplied no catalog, so the live table correctly remains empty.*
- [~] `P2-T23` **ORG-04 employee carries all four.** `core.employees` gains `plant_id` (NOT NULL for active India staff) in addition to `company_id`, `department_id`, `cost_center_id`. Transfer workflow (LC-05) updates the tuple as one dated revision. Directory, muster, payroll input lists and CEO tiles all read the same four FKs. *All org FKs are company-consistent at DB level; `plant_id` cannot yet be tightened because 866 active India rows remain unmapped in the development DB, and transfer atomicity is still open.*
- [~] `P2-T24` **ORG-05 the filter contract.** Every list, report, payroll run, dashboard and Excel export accepts `companyCode[]`, `plantCode[]`, `misCode[]`, `departmentId[]`, `costCenterCode[]` as first-class query params. Empty = caller’s RBAC scope. **The same predicate is shared** — a report cannot invent a fifth way to mean “this plant”. *Shared predicate is used by directory and R27; MIS matching now fails closed across companies. Remaining reports, dashboards and future payroll exports still need adoption/equivalence tests.*
- [ ] `P2-T25` **ORG-06 payroll run scope.** A run is `company` (mandatory) + optional `plant` / `mis` / `cost_centre` restriction. Consolidated group view is a *report* over finalized runs, never one mixed-entity compute. Foreign companies (`is_india_payroll=false`) cannot enter an India run (hard CHECK).
- [ ] `P2-T26` **ORG-07 MIS reports.** Headcount, attendance, gross, deduction, net, OT hours, attrition — each available company-wise, plant-wise, MIS-wise, department-wise, cost-centre-wise, with drill-down to the row. This is PAY-05’s “CTC/cost-center/department/location reports” made complete.
- [~] `P2-T27` **ORG-08 JV / SAP map.** `pay.gl_accounts` maps `(company_code, plant_code, cost_center_code, component) → GL`. A missing map is a pre-finalize exception, not a silent dump into a default. **`cost_center_code` is fed from the register's `OUMIS` value** (`core.cost_centers.code`, e.g. `RML1`) — *not* from greytHR's misleadingly-named `Cost Center` column, which carries a department label (sponsor correction, 4 Sep 2026; register recon §2a). Add an equivalence test: a JV keyed on the department label must fail. *CRUD exists and DB/service guards reject fictional or cross-company tuples; component FK and pre-finalize completeness check wait for Stage 2.1/2.2.*

**Integrity review — 3 Sep 2026.** Forward migration `1752180000000_org-spine-integrity` was applied after the populated development data: seven company-aware foreign keys validated without rewriting rows; audited org mutations are now atomic; `/admin/masters` is the single master-data surface (the later `/admin/org` route remains only for backward compatibility). Verification added seven live-Postgres invariants plus the UI/API contract. **Data gate remains red:** the development DB contains 155 companies / 1,191 employees because integration suites share and pollute the normal DB; 866 active India employees lack `plant_id`; 30 cost centres lack a plant; 35 departments lack MIS and Finance MIS/GL tables have zero rows. Do not mark Stage 2.0 complete or start money computation from this database snapshot.

**R7 register key mapping — settled 4 Sep 2026 (sponsor), no schema change needed:**

| Register column | Source | Note |
|---|---|---|
| `OU` | `core.companies.code` | the OU *is* the legal entity (`RML`, `RGH`, …) — `core.org_units` is unrelated |
| **`OUMIS`** | **`core.cost_centers.code`** | **the real cost centre and the JV/GL key** (`RML1`) |
| `Cost Center` | department label | greytHR's header is misleading — *not* the cost centre |
| `DEPTMIS` | `core.departments.mis_code_id` → `core.mis_codes.code` | |
| `PT Location` | `stateName(core.locations.state_code)` | `core/org/states.ts` |
| `PAYROLL MONTH` | `formatPayrollMonth(y, m)` | `core/dates.ts` — text `Jun 2026` |

- [x] `P2-T28` **Register field helpers.** `formatPayrollMonth()` (`core/dates.ts`) and `core/org/states.ts` (India state code → name, PT-complete) with unit tests. *Done 4 Sep 2026 — the only code the 21 identity columns still needed; the other 43 columns wait on Stage 2.1/2.2.*

**UI:** `/admin/masters` gains tabs *Companies · Plants · MIS codes · Cost centres · Departments* with the mapping grid. Every report filter bar shows the four codes first, names second.

**Real-world use case.** *Subhasis runs April for RML / plant 1701 / MIS “Hot Mill” only. The bank file, ECR and JV contain only those people. The CHRO then opens the group MIS view and sees RML vs RGH vs RDL net, then drills to Hot Mill overtime cost. Previously this was four Excel pivots and a fight about which cost centre was “the plant”.*

**Tests:** an employee with company A / plant X cannot appear in a plant-Y run; filter predicate identical across muster, payroll register and KPI snapshot (property); JV refuses finalize when a cost centre has no GL map; `is_india_payroll=false` company cannot join an India run.

**Exit criteria:** all 14 entities coded · plants backfilled from recon · one India payroll rehearsal in the sandbox sliced to one plant + one MIS · sponsor confirms the MIS list with Finance.

---

## Stage 2.1 — Salary components, structures, assignments   `[ ☐ ]`
**Goal:** the salary data model, seeded with RML's real live structure.
**Depends on:** Gate G1; Stage 0.1 (P0-T02/T06 artifacts); **Stage 2.0**.
**Tasks:**
- [ ] P2-T01 — Components seed from the **live monthly register** (docs/10 §10.1, `docs/recon/greythr-monthly-salary-register.md` — supersedes the narrower 09 §2 list):
  - **8 proratable fixed earnings** (`prorate_on_lop=true`, each carries a `FULL …` register column): BASIC (`floor(gross/2)` for STAFF_STANDARD), STIPEND, HRA=`BASIC×0.5`, EDUCATION 200, MEDICAL 1250, STATUTORY_BONUS=`floor(BASIC×0.0833)`, SPECIAL (balancing, computed last), PROJECT_ALLOW
  - **8 variable earnings** (never prorated, via `pay.inputs`): INCENTIVE, OTHER_EARNINGS, GRATUITY, LEAVE_ENCASHMENT, OVERTIME, EX_GRATIA, HOLD_SALARY, PERFORMANCE_LINKED
  - **11 deductions as a fixed catalog** (reserved columns, not free-form): PF_EE (base per signed policy flag), ESI_EE, PT (keyed on **PT Location**, not work location), TDS, LOAN, **LOAN2** (two concurrent EMI slots), MISC_RECOVERY, CANTEEN_RECOVERY, GUEST_HOUSE_DEDUCTION, TRAVEL_ADVANCE_RECOVERY, NOTICE_PERIOD_RECOVERY
  - employer-side PF_ER/ESI_ER/GRATUITY_ACCRUAL/EDLI/PF_ADMIN (CTC/JV only, not register columns)
  - flags (`part_of_gross`, `part_of_pf_wages`, `prorate_on_lop`, rounding, display_order) — display_order **is** the register column order *(PAY-01)*
- [ ] P2-T02 — Structures per grade/category/location; effective-dated `pay.employee_salaries` with **`EXCLUDE USING gist` overlap constraint** (doc 14 §6.2); **probation % auto-apply + auto-switch on confirmation date**; CTC-vs-breakup validation; new-joiner salary from LOI CTC on conversion *(PAY-01/02/07)*
- [ ] Salary-structure admin UI + ESS "Salary Revision" history view (09 §5)
**Modules/files:** `backend/src/modules/payroll-core/{components,structures,salaries}/`
**Tests required:** formula evaluation vs **G1** (May-2026 payslip) *and* **G1b** (`backend/tests/fixtures/payroll/golden/G1b-monthly-register-jun2026.json` — the full Jun-2026 register row: gross 64,573 · PF 3,874 · PT 200 · canteen 1,375 · net 59,124); overlap-insert rejected by DB; probation 80% (G6); CTC≠breakup rejected.
**Exit criteria:** G1 **and G1b** compute to-the-rupee against the live artifacts · overlapping salary row physically un-insertable.
**Blocked-on-input (do not guess):** `HOLD_SALARY` semantics · LOP divisor (June's 30 days cannot distinguish CALENDAR from FIXED_30 — need a Feb/31-day register) · per-component proration rounding · `ESI GROSS SALARY` exclusion list. All four listed in the recon doc §5.

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
- [ ] P2-T07 — Outputs per run: **R7 Final Pay Register in the locked live format** (docs/06 §2.1 — 64 columns in order, verbatim headers incl. the misspelled `MONH DAYS`, `TOTAL DEDUCTIONS` written **negative**, `Grand Total` row labelled in the IFSC column summing FULL BASIC→NET PAY; asserted by G1b's `reportShape`); bank file (excludes payment-holds, totals row) **— format still not supplied by Finance**, JV per `pay.gl_accounts` (SAP-consumable) **— format still not supplied**, variance report vs prev month (Δ-highlighted); reports R8–R19 *(PAY-05)*
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

## Stage 2.7 — Payroll completeness (the E-register + loan life-cycle + MIS registers)   `[ ☐ ]`
**Goal:** the run model can hold, supplement, pay through several banks, freeze inputs, explain a delta vs last month, sign Form 16, value perquisites, and close a loan — *before* the first live month, because each of these is brutal to retrofit onto an immutable run.
**Depends on:** 2.2, 2.4, 5.4 (e-sign for Form 16). **Closes:** GAP-E12..E20, doc 16 §12.8. **Requirement IDs:** `PAY-18..24`

🔴 **These belong in the spec before the first line of money code** (see amendments §B). This stage is the execution of that list, not a later retrofit.

**Tasks**
- [ ] `P2-T30` **PAY-18 / E12 salary hold.** Payment-hold and process-hold as first-class rows with a release workflow. A held employee is in the register (gross computed) and **absent from the bank file**. Release is two-person, audited. No manual bank-file editing — that breaks the audit chain.
- [ ] `P2-T31` **PAY-19 / E13 off-cycle / supplementary run.** Distinct run type, own numbering, own bank file, own registers. Cannot silently mutate a locked monthly run.
- [ ] `P2-T32` **PAY-20 / E14 multi-bank advice.** Per entity × bank format; payment-status reconciliation (returned / failed credits re-open a payable). 14 entities, several banks — the failure path is the part everyone forgets.
- [ ] `P2-T33` **E15 GL/JV posting status.** Map from 2.0; post / fail / re-post with status on the run. Never a fire-and-forget file.
- [ ] `P2-T34` **E16 tax-regime election** per employee per FY, lock date, change audit. Input to every TDS computation from run one.
- [ ] `P2-T35` **E17 Form 16 Part A+B** assembly, bulk e-sign (5.4), ESS distribution, reissue.
- [ ] `P2-T36` **E18 perquisites beyond loans** (car, accommodation, ESOP) + Form 12BA. Part of the calc order, not an afterthought.
- [ ] `P2-T37` **E19 variance-vs-prior-month** dashboard as the pre-finalize control (the natural home for Phase 8 anomaly detection).
- [ ] `P2-T38` **E20 input-freeze calendar** with per-source status: attendance locked ✓, claims closed ✓, loans ✗. A run cannot compute while a required source is open.
- [ ] `P2-T39` **PAY-21 loan life-cycle.** Foreclosure, part-prepayment, moratorium / EMI pause, with the schedule rebuilt as new ledger rows (never edited). Outstanding still = SUM of postings.
- [ ] `P2-T40` **PAY-22 MIS-wise payroll registers.** Gross / deduction / net / component / OT / LOP — company-wise, plant-wise, MIS-wise, department-wise, cost-centre-wise — same numbers as the run, same filter contract as 2.0.
- [ ] `P2-T41` **PAY-23 payroll input contract** for later phases: canteen recovery, transport recovery, disciplinary fine, subsistence, benefit deduction, comp-cycle revision — **all arrive as rows in `pay.inputs`**, never as direct writes to a run.
- [ ] `P2-T42` **PAY-24 off-cycle reimbursement XOR monthly** already in 2.5; this task is the CHECK that an input source cannot pay twice.

**Tests:** hold excluded from bank file but present on register (golden); off-cycle cannot write a locked month; foreclosure rebuilds schedule and outstanding reconciles; variance dashboard flags a seeded Δ; input freeze blocks compute; Form 16 golden against a hand-built Part B; every MIS slice sums to the company total (no double-count).

**Exit criteria:** a held employee, an off-cycle batch, a failed-credit re-open, and a foreclosure each proven on the sandbox parallel run · MIS-wise net = company net for a seeded month.

---

## Stage 2.8 — Foreign-entity payroll (local / WPS)   `[ ☐ ]`  **blocked on proposed D14**
**Goal:** the five foreign entities stay in the same master and the same attendance, and get a **local payroll path** — not PF/ESIC/PT/TDS.
**Depends on:** G2 (India engine proven); **sponsor decision D14**. **Closes:** the “until a foreign-payroll module is scoped” clause in D3.
**Requirement IDs:** `FGN-01..08`

D3 remains true: **India statutory payroll does not run for RPF (Dubai FZCO), Reach Mining (Tanzania), Rashmi Metaliks UK, Rashmi Metaliks Bahrain, or the holding row.** This stage is the scoped module D3 deferred.

**Tasks**
- [ ] `P2-T50` **FGN-01 entity flags.** `is_india_payroll=false` already exists; add `local_payroll_mode`: `wps_uae` | `manual_tz` | `manual_uk` | `manual_bh` | `none`. A mode of `none` means master + attendance only, pay stays off-system (recorded).
- [ ] `P2-T51` **FGN-02 currency & calendar.** Payroll currency, pay frequency, local holiday calendar, weekend pattern — all settings per entity. Money still integer minor-units; FX rate captured on any INR reporting conversion, never implicit.
- [ ] `P2-T52` **FGN-03 UAE WPS file.** SIF / WPS-compatible bank file for RPF Dubai, behind a format interface (same pattern as India bank advice). Golden against a Finance sample.
- [ ] `P2-T54` **FGN-04 local earnings/deductions catalog** per entity (no PF/ESIC/TDS components permitted — CHECK). Gratuity/end-of-service as a local rule object, not the India 5y/240d engine.
- [ ] `P2-T55` **FGN-05 attendance in, statutory out.** Day-status and muster work. India registers (ECR, 24Q, Form 12/15/22) **refuse** a foreign company_id.
- [ ] `P2-T56` **FGN-06 group MIS.** Foreign net and headcount appear on the executive dashboard as a separate band, never mixed into India PF wage or CTC-average KPIs.
- [ ] `P2-T57` **FGN-07 master parity.** Same employee record, same e-code series, same org/MIS spine (2.0). No second employee table.
- [ ] `P2-T58` **FGN-08** TZ / UK / BH start as **manual local-pay register** (upload + lock + ESS payslip) until a local accountant signs a format. Do not invent UK PAYE or Tanzania NSSF in v1.

**Tests:** an India run physically cannot include a foreign e-code; a WPS file golden; group KPI “average CTC” excludes foreign unless the tile says so; India statutory export with a foreign id is 403.

**Exit criteria:** D14 signed · Dubai WPS file accepted by Finance for one month · the other three foreign entities on the manual register · India parallel-run numbers unchanged (no leakage).

---

## Gate G2 — Phase 2 sign-off (Protiviti retired after this gate)
- [ ] Parallel-run register matches to the rupee (or differences signed off by HR Head + Finance)
- [ ] First live payroll month processed end-to-end in HRMS
- [ ] Statutory files accepted by portals (ECR upload verified)
- [ ] PITR restore drill passed; off-box backups verified
- [ ] Payroll UAT (Subhasis + Finance) sign-off; training materials delivered
- [ ] Mutation-testing threshold met on payroll-core; shadow-run harness in place for all future logic changes
- [ ] Stage 2.0: payroll rehearsal sliced by company + plant + MIS, totals reconcile
- [ ] Stage 2.7: hold / off-cycle / foreclosure / Form 16 proven on sandbox (E12–E20 absorbed)
- [ ] Stage 2.8 is **not** a G2 gate — it waits on D14 and runs after India cut-over
