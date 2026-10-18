# Rashmi HRMS — End-to-end Payroll Test (June 2026) + module flows + DB slop check

- **Target:** DB `hrms` (local test DB) and the backend already running on **:5100**, frontend :5173. App source was **not modified**.
- **Run window:** 18-Oct-2026, about 21:30–22:15 IST.
- **Mock data tag:** employee codes **RML033901–RML033924** and **RGH033901–RGH033908**, emails `<ecode>@qa-payroll.rashmi.test`. The sample employee is **RML033625**, loaded exactly as in the register.
- **Isolation history:** the earlier `hrms_payroll_qa` DB and the :5102 instance were dropped or stopped, per the user's correction. Their snapshots are archived in `logs/discarded_qa_db_snapshots/`.
- **Concurrency caveat:** another agent's process was running vitest under `/workspace/hrms-fix` at the same time. I saw no evidence that it touched DB `hrms`.

## 1. Verdict

**FAIL — not production-ready for payroll.**
- The run lifecycle works end to end through the API: create → lock inputs → compute → review → approve (a different checker) → finalize, for both RML and RGH.
- Bank file and SAP JV generate and balance.
- **However, the numbers are wrong for 33 of 44 employees.** The defects are systematic:
  - PF is always capped at ₹15,000 wages.
  - TDS is never deducted.
  - Statutory bonus is not prorated.
  - ESI is charged to non-ESIC employees.
  - OT blocks the run.
  - Maternity leave cannot be applied.
  - F&F is about 100× wrong, is negative, and was still marked *paid*.
  - Leavers are paid twice (regular run + F&F).
- Payslip batch generation fails after finalize.
- The payroll and ESS UI pages show hard-coded mock figures instead of the real run.

| Item | Result |
|---|---|
| Payroll ran end to end via API | **Yes, with a workaround for RML.** RML run 4's finalize was blocked by a negative-net employee (500). Unblocked by: super_admin reopen → process hold on RML033922 → re-lock → re-compute → review → approve → finalize. RGH run 5 finalized without intervention. |
| `paid` state | No API transition exists, so it was not reachable. |
| Sample RML033625 | App net **₹61,198** vs register **₹59,124** (**+₹2,074**). The only differing line is PF_EE: 1,800 vs 3,874. All other lines match exactly. |
| Reconciliation (44 items) | **11 MATCH / 33 MISMATCH** (mock cohort: 10/23). Net overpaid by ₹1,78,413.53 in total. |
| New bugs | 33 (P-01…P-33): **Critical 5, High 10, Medium 13, Low 5** |

## 2. Cohort (33 mock employees + the 11 pre-existing seed employees who also fell into the runs)

| Ecode | Name | Case | Monthly gross (₹) |
|---|---|---|---|
| RML033625 | Prateek Kumar Singh | SAMPLE (register row) | 64,573 |
| RML033901 | Ananya Ghosh | ESI eligible | 18,500 |
| RML033902 | Rakesh Mahato | ESI boundary 21,000 + 2 LOP | 21,000 |
| RML033903 | Soumen Bera | ESI ineligible 21,001 | 21,001 |
| RML033904 | Arpita Mondal | Maternity from 08-Jun | 45,000 |
| RML033905 | Vikram Jha | PF wage > 15k (Basic 22k) | 52,000 |
| RML033906 | Sneha Kumari | PF wage < 15k | 30,000 |
| RML033907 | Rohit Das | Apprentice stipend | 15,000 |
| RML033908 | Mohit Agarwal | Joiner 16-Jun | 40,000 |
| RML033909 | Priyanka Dutta | Leaver LWD 20-Jun + notice recovery + F&F | 42,000 |
| RML033910 | Sanjay Paul | 3 LOP | 36,000 |
| RML033911 | Abhijit Sen | Full-month LOP | 33,000 |
| RML033912/13/14 | Tanmoy / Rina / Debashis | Probation 80/70/90 % | 30k/25k/50k (full) |
| RML033915 | Kunal Chatterjee | Incentive + arrears + other earnings | 60,000 |
| RML033916 | Nilanjan Bose | Payment hold | 48,000 |
| RML033917 | Amitava Roy | App loan EMI 5,000 + guest house | 55,000 |
| RML033918 | Suresh Yadav | Travel advance + misc recovery | 38,000 |
| RML033919 | Ritika Jain | TDS old regime, 80C 1.5L | 1,20,000 |
| RML033920 | Arnab Mukherjee | TDS new regime | 1,10,000 |
| RML033921 | Rajiv Bhattacharya | Surcharge band | 4,50,000 |
| RML033922 | Kaushik Dey | Negative net (20 LOP + recoveries) | 12,000 |
| RML033923 | Pooja Singh | Odisha (Bhubaneswar) PT | 35,000 |
| RML033924 | Sayan Majumdar | CL2 + SL1 + LWP1 | 34,000 |
| RGH033901 | Bikash Behera | OT 4h approved | 55,000 |
| RGH033902 | Mamata Nayak | ESI eligible RGH | 16,000 |
| RGH033903 | Pradeep Sahu | Joiner 10-Jun | 45,000 |
| RGH033904 | Lipika Das | 5 LOP | 32,000 |
| RGH033905 | Satyajit Mohanty | PF ACTUAL basic 30k, TDS new | 75,000 |
| RGH033906 | Jyoti Prakash Rout | Leaver LWD 15-Jun + F&F gratuity | 50,000 |
| RGH033907 | Smita Panda | Canteen + guest house | 28,000 |
| RGH033908 | Ashok Pradhan | Process hold | 40,000 |

## 3. Payroll run results

| Run | Co | Status | Items | Gross ₹ | Deductions ₹ | Net ₹ | Maker / Checker |
|---|---|---|---|---|---|---|---|
| 4 | RML | finalized (after reopen) | 35 | 19,56,527.49 | 73,489 | 18,83,038.49 | payroll@ (computed) / hrhead@ (approved, finalized) |
| 5 | RGH | finalized | 9 | 3,23,295.04 | 18,265 | 3,05,030.04 | payroll@ / hrhead@ |

- **Before the workaround, run 4** was gross 19,59,327.49 and net 18,78,274.49. Finalize returned a 500: `Cannot finalize payroll run: Notice: 1 employee(s) have negative net pay` (run.service.ts:214, gated by reconciliation.service.ts:82-93/139-144).
- **The negative net was RML033922:** gross 2,800, deductions PF 168, ESI 21, canteen 1,375 and loan 6,000, so net **−4,764**. A snapshot of the first compute is in `logs/items_first_compute.tsv`.
- **Maker/checker:** the maker's self-approve and approve-before-review are both refused, but as **500s** (see P-14).

## 4. Reconciliation (full detail in `reconciliation.xlsx`; mismatches are red)

- **Method:** expected values were computed independently in `scripts/reconcile.py` and compared with the app's values. Conventions are on the "Conventions" sheet:
  - calendar proration, rounded to the rupee, bonus prorated;
  - PF at 12% of actual earned basic;
  - ESI only for ESIC-applicable employees with gross ≤ 21k;
  - WB PT slab (Odisha assumed ₹200/month);
  - TDS per docs/10 §6.3 (new regime with 87A and marginal relief; old regime with 50k standard deduction, 80C and PT);
  - OT = Basic/208 × 2 × hours.
- **Tolerance:** a difference under ₹1 counts as rounding. None occurred.

| Field | Items with diff ≥ ₹1 | Root cause |
|---|---|---|
| PF_EE | 27 | P-01 PF ceiling |
| Net | 33 | combined |
| Total deductions | 31 | combined |
| Gross | 10 | P-03 bonus not prorated (8: joiners, leavers, LOP, LWP), P-07 maternity (1), P-06 OT not paid (1) |
| ESI | 4 | P-05 (Arpita 90, apprentice 113, Mohit 157, Abhijit 11) |
| TDS | 3 | P-04 (Ritika 15,928, Arnab 3,900, Rajiv 1,12,255 per month expected; app 0) |
| PT | 3 | P-17 (Odisha 150 vs 200); a knock-on of bonus/maternity for Arpita and Jyoti |
| Other recoveries | 1 | P-08 loan EMI 5,000 not deducted (RML033917) |
| Payable days | 1 | P-07 Arpita 7 vs 30 |

- **17 of the 33 mismatches are explained by the PF ceiling alone.**
- **Notable rows (expected → app):**
  - RML033921: net 3,10,545 → 4,48,000. No TDS of 1,12,255, and PF 27,000 → 1,800.
  - RML033904 (maternity): 42,100 → 11,106.74.
  - RML033911 (0 days): 0 → **1,363**, bonus paid in full. This amount is also in the bank file.
  - RML033917: 44,000 → 50,500 (no loan EMI, PF capped).
  - RGH033901: OT ₹1,058 not paid. The approved OT made compute throw, so I rejected it by SQL to proceed.
- **Correct:** ESI eligibility at the 21,000 boundary (Rakesh/Soumen); probation scaled salaries (assigned as scaled structures); canteen, guest-house, travel and misc recoveries; notice recovery; incentive, arrears and other earnings; payment hold (net retained, excluded from bank); process hold (zero item).

### Sample RML033625, line by line

| Line | Register | App | Diff |
|---|---|---|---|
| BASIC | 32,286 | 32,286 | 0 |
| HRA | 16,143 | 16,143 | 0 |
| EDU | 200 | 200 | 0 |
| MED | 1,250 | 1,250 | 0 |
| BONUS | 2,689 | 2,689 | 0 |
| SPECIAL | 12,005 | 12,005 | 0 |
| **GROSS** | 64,573 | 64,573 | 0 |
| **PF** | **3,874** | **1,800** | **−2,074** |
| ESI | 0 | 0 | 0 |
| PT | 200 | 200 | 0 |
| TDS | 0 | 0 | 0 |
| CANTEEN | 1,375 | 1,375 | 0 |
| **Total deductions** | 5,449 | 3,375 | −2,074 |
| **NET** | **59,124** | **61,198** | **+2,074** |

- **Cause of the PF gap:** the engine defaults `pfWageCeilingPaise = 1500000` (compute-engine.ts:149, applied at 284-287), and run-compute.service.ts:190-202 never passes a ceiling or company setting. The register uses 12% of the full basic.
- **Other observations on the sample:** the payslip shows no employer contributions; PF number and ESIC number show "—".

## 5. Outputs

| Output | Status | Notes |
|---|---|---|
| Payslips: batch `generateRunPayslips` | **FAIL, 500** on both runs | The generator updates `pay.payroll_items.payslip_document_id`, which the finalized-items trigger blocks (payslip-generator.ts:296-301 vs migration 1752220000000_pay-schema-init.ts:152-160). It runs without a transaction, so orphan `core.documents` 4 and 7 (plus their stored files) were left behind. `getRunOutputs` reports "0 of 35 archived". |
| Payslip view `getPayslip` / `getMyPayslip` | OK (API) | 44 HTML payslips saved to `outputs/payslips/`. The sample's ESS payslip API returns net 61,198. The ESS **UI** ignores the API (P-11). |
| Bank file | OK | RML: 33 records, ₹18,37,038.49; holds excluded (Nilanjan ₹46,000, Kaushik ₹0). RGH: 8 records, ₹3,05,030.04, Ashok excluded. It includes the leavers (double pay with F&F), Abhijit's ₹1,363 and paise amounts. JSON totals are float (`1837038.4900000002`). Files: `outputs/4-generateBankFile.csv`, `outputs/5-generateBankFile.csv`. |
| SAP JV | OK, balanced | Problems: no employer cost lines; ESI posted to "210090 Other Deductions" instead of an ESIC payable GL; the same GL is repeated per component (not aggregated). Files: `outputs/4-generateSapJv.csv`, `outputs/5-generateSapJv.csv`. |
| Variance report | OK | No previous month, so every row is an "anomaly". |
| PF ECR | Generated | The endpoint only formats records supplied by the caller; it does not read the run. I built the records from the run: RML 32 and RGH 8 members, all EPF wages capped at 15,000 (P-01). File: `outputs/statutory/ECR_*.txt`. |
| ESIC return | Generated (caller-supplied) | RML 8 rows, 4 of them with IP number "NA" (non-ESIC employees charged ESI, P-05). RGH 1 row. |
| PTRC | Totals only, no file | RML ₹5,630 / 34 employees; RGH ₹1,330 / 8. These match the run. It accepts the Odisha employee under WB. |
| LWF Form D | Totals only | No LWF is computed in the run. |
| TDS `projectTds` | Partly OK | New regime matches the expected values: Arnab ₹46,800/yr, Rajiv ₹13,47,060/yr, Satyajit ₹0. **Old regime uses the ₹75k standard deduction** (tds.ts:297 defaults to `NEW_REGIME_SD_PAISE`): Ritika taxable 12.15L vs 12.40L. **None of it flows into payroll** (P-04). |
| Form 16 / 24Q | **Not available** | `generateForm24QSummary` exists in tds.ts:358 but there is no route. The ESS page shows "Form 16 Part B — Available Year-End". |
| `estimate` | Inconsistent | Defaults to PF **ACTUAL**, giving 3,874 for the sample, while the run uses the ceiling (1,800). Returns PT 0 for OD. |

## 6. Module results

| Module | Result | Key observations |
|---|---|---|
| Attendance | PASS with workarounds | Kent unavailable, so a test connector was injected via `runKentSync`. 2,044 swipes; recompute API for 84 days; manager approvals; lock checklist; both months locked via the normal API. Biometric verify always rejects. `day_records` 'A' rows are created the day before DOJ (P-26). |
| Regularisation AR/OD/Permission (Oct) | PASS | Submitted → routed to the delegate (srmanager) → approved, so the days became P/OD (source `regularized`); a reject also works. Validation is good: older than 30 days, future AR and inverted ranges are refused with 400. Self/peer/other-company approvers are refused with 403. A double act is refused with 400. |
| OT | FAIL | An approved OT entry makes payroll compute throw (P-06). Re-deciding a rejected entry → 400. OT is never paid. |
| Leave / Maternity | FAIL | ML is rejected for gender 'Female' (P-07). Applications backdated about 4 months are accepted. CL/SL/LWP work and the LWP is reflected in pay. |
| Approvals / workflows | PASS | Inbox, delegation and act all work; the approver guard works. |
| Loans | FAIL | `/api/loans/apply` creates an **active** loan with no approval or workflow. The EMI is never deducted and there are 0 postings (P-08). The ledger route is declared as `/api/loans/:id/ledger` (Express syntax), so `id` is not bound (P-30). The UI calls the wrong prefix and gets 404 (P-12). |
| Claims | FAIL | Every submit returns **500**: the insert omits `funding_kind`/`budget_id`, which violates `claims_budget_present` (claims.service.ts:142-158). An unknown claim type also gives 500. The UI gets 404. |
| Travel | FAIL (logic) | See the list below. |
| Lifecycle: onboarding | PARTIAL | Ingest → pre-join submit → convert worked: emp 46, RML000012. See the list below. |
| Lifecycle: probation / confirmation | Limited | Reviews exist only for earlier test data. My SQL-imported probationers got no review rows. The UI formats dates without the year ("Sun Oct 18"). Probation-% salary assignment returns 500 (P-19). |
| Lifecycle: transfer | FAIL | See the list below. |
| Lifecycle: separation / F&F | FAIL | See P-02 and P-22. |
| Reports / dashboards | PARTIAL | See the list below. |
| Payroll UI (Playwright, 12 screenshots) | FAIL | `/payroll` shows **hard-coded** data: "Total Employees 5, Gross ₹1,67,572, Lock #102, status COMPUTED" (PayrollPage.tsx:366/424), not run 4. `/payroll/parallel-run` shows mock data (1,066 headcount). `/my/pay` shows a hard-coded payslip — "₹57,999, RML035384, 2026-10", identical for the sample and for Nilanjan (MyPayPage.tsx:38-60). The plain `employee@` user can open `/payroll`. `/loans` and `/claims` return 404 on the API. |

**Travel details:**
- Inverted trip dates are accepted.
- Claim items outside the trip dates are accepted.
- A draft claim was settled with no submit/approval step (₹4,400 payable).
- Advance approval needs `payroll.run.manage`, so managers get 403. Approval disburses immediately.
- An advance approved *after* settlement is never adjusted, so the employee holds both ₹5,000 and ₹4,400.
- **IDOR:** an employee raised an advance on another employee's trip (advance 4).
- Double settle, double approve, and adding an item to a settled claim all return 500.

**Onboarding details:**
- A duplicate candidate (same email and mobile) is accepted at ingest.
- A DOB of 2015 is accepted.
- An offer date after DOJ is accepted.
- An invalid PAN is accepted at pre-join.
- Probation 6 months / 80% from the offer is **not carried** to the employee.
- Good: cross-company locations and duplicate Aadhaar are caught at convert.

**Transfer details:**
- **The maker approved their own transfer.** hr_ops created and approved #3; earlier test data #1 shows the same.
- A transfer effective 01-Nov was applied **immediately** (RML033906 location is already 3).
- A location in another company was accepted at create and only failed on the FK at approve.
- Inter-entity approve returns **500** (cost-centre FK; transfer.service.ts:408-419 changes `company_id` without resetting cost centre or org unit). The target ecode RGH000002 is reserved while pending.
- Transferring an exited employee returns 500 (line 156).

**Reports / dashboards details:**
- r27 headcount matches the DB: RML 36, RGH 8.
- Muster June RML: 35 rows; payable days are consistent with the run.
- The executive snapshot was **stale** (manpower 11) until a manual rebuild, after which it showed 44.
- `gross_salary_cost_mtd` (₹25.2L) is derived from CTC, not from payroll runs.
- The business-unit dashboard shows headcount 0 for the CEO.
- r3-regularizations ignores the month filter.
- r31 claims is empty (claims cannot be submitted).

## 7. DB slop check

- **Snapshots:** BEFORE 146 tables / 2,792 rows → AFTER 147 tables / 9,379 rows.
- **Schema diff:** the only change is a partition `att.swipe_events_202606` created at runtime by ingest. Note that the parent table's count includes partition rows.
- **Files:** `snapshots/rowdiff_BEFORE_AFTER.tsv`; queries and results in `slop/slop_checks.sql` and `slop/slop_results.txt`.

| # | Check | Finding | Created by this run? |
|---|---|---|---|
| S1/S2/S3 | Item company scoping, duplicates, header = Σ lines | Clean | — |
| S4 | Non-integer rupee money | 18 lines in 6 items (unrounded proration), carried into the bank file | yes |
| S6 | Leaver paid in the run **and** F&F paid | RML033909 (₹19,752.99 + F&F) and RGH033906 (₹24,391 + F&F) | yes |
| S7 | F&F | fnf 2: **−₹1,12,00,000**; fnf 3: **−₹1,25,83,333.34**, gratuity ₹20L (cap reached because of ×100). Both **paid** with IT and Finance clearances *pending*. fnf 1 (earlier data) is +₹10.29L for an active employee. | 2, 3 yes; 1 earlier |
| S8 | Approved LWD before the resignation date | separations 6 and 7 (LWD Jun vs resigned 18-Oct) | yes (accepted by the API) |
| S9 | Salary with empty `{}` components, future effective | RML000011 (emp 12) | earlier |
| S10 | Attendance outside the employment window | RGH033903 09-Jun, RML033908 15-Jun ('A' the day before DOJ) | yes (app ingest) |
| S11 | Future-dated rows | recompute_queue 1 (emp 9, 2026-11-24; this re-queues forever and hung the drain loop); day_records 6 | earlier |
| S12 | Orphan documents after a 500 | payslip docs 4 and 7 (partial write from `generateRunPayslips`) | yes |
| S14 | Travel | 2 inverted trips; 2 items outside the trip; 2 settled claims with 0 advance adjusted; disbursed advance 3 left open; advance 4 by emp 14 on emp 31's trip | trips 5/6, items 5, claim 2, adv 3/4 yes |
| S15 | Location/cost-centre company mismatch | Clean (DB FKs block it) | — |
| S16 | Structure company ≠ employee company | RGH000001 holds RML structure "G1 Staff Baseline" | earlier data; reused by my run |
| S17 | Users without roles | beta.newjoin@ (earlier). The importer grants no roles, so I granted them via the RBAC API. | earlier |
| S18 | Loans active without approval | all 4 (loan 4 is mine). Loans 1 and 3 (earlier) have principal 5,00,00,000 / 1,00,00,000 in a rupee column, which looks like a unit mix-up. | 4 yes |
| S19 | Aadhaar stored as plain 12 digits | 46 / 46 employees | mixed |
| S20 | Sessions | 269 total, 258 live (each login is a new session, no cap) | +106 yes |
| Audit | Missing audit rows (Δ audit_log +286) | Present: payroll run transitions (created 2, inputs_locked 3, computed 3, under_review 3, approved 3, reopened 1, finalized 2), salary assign 40, structures 36, transfers, workflow acts. **Absent:** F&F compute/pay, separations, clearances, salary holds, loans, investment declarations, bank/JV/document generation, travel, attendance-request create, OT decide, user create (33 users, only grants). | yes |

**Row-count diff vs expected (my run):**

| Table | Change | Explanation |
|---|---|---|
| employees | +34 | 33 mocks + 1 converted candidate |
| users | +33 | |
| employee_salaries | +40 | 33 + 7 existing employees given structure 2 |
| salary_structures | +36 | 33 + 3 PROB |
| payroll_runs | +2 | |
| payroll_items | +44 | |
| payroll_item_lines | +333 | |
| pay.inputs | +13 | |
| salary_holds | +3 | |
| fnf_settlements | +2 | |
| bank_batches | +2 | |
| documents | +6 | 2 bank + 2 JV + 2 orphan payslips |
| swipe_events | +2,044 | |
| day_records | +1,433 | |
| month_locks | +2 | |
| devices | +2 | |
| transfers | +3 | |
| separations | +2 | |
| clearances | +8 | |
| te.* | various | trips +3, items +3, advances +2, claims +1, settlements +1 |

All of these match the actions taken. No unexplained rows.

## 8. New bugs

Severity: C = critical, H = high, M = medium, L = low. Steps to reproduce are in `logs/api-calls.jsonl` (tagged).

| ID | Sev | Title | Steps / evidence | Root cause |
|---|---|---|---|---|
| P-01 | C | PF always capped at ₹15,000 wages; no company/employee ACTUAL option used | Run 4/5: every basic > 15k gets PF 1,800 (sample 3,874 expected) | compute-engine.ts:149, 284-287; run-compute.service.ts:190-202 passes no `pfWageCeilingPaise`/settings |
| P-02 | C | F&F ~100× inflated; negative F&F marked **paid** with clearances pending; held salary always 0 | Separation → compute-fnf → pay for RML033909/RGH033906 → net −1.12 Cr / −1.26 Cr, status paid, employee exited | separation.service.ts:391-395 (paise ×100), gross sums all components incl. deductions/employer; :418 `heldSalaryPaise = … ? 0 : 0`; pay step has no net ≥ 0 / clearance gate |
| P-03 | C | Leavers paid twice (regular run to LWD + F&F days payable); bank file includes them | S6 | Run selection includes exited employees whose F&F covers the same days; no cross-check |
| P-04 | C | TDS never deducted in payroll | RML033919/20/21: TDS 0 (expected 15,928 / 3,900 / 1,12,255 per month) | compute-engine.ts:151/344 default 0; run-compute.service.ts:190-202 never supplies `projectedMonthlyTdsPaise` |
| P-05 | C | ESI charged to non-ESIC employees and apprentices (ignores `esic_applicable` and contribution period) | Arpita 90, Rohit 113, Mohit 157, Abhijit 11; ESIC return lists IP "NA" | compute-engine.ts:~305 eligibility by earned gross only |
| P-06 | H | Approved OT makes the whole run compute throw (500); OT never paid | Approve OT entry 2 → `/payroll/runs/compute` 500 | run-compute.service.ts:181-184 |
| P-07 | H | Maternity leave impossible for gender 'Female' | Apply ML for RML033904 → rejected; paid 7 days (₹11,107 vs ₹42,100) | leave-validation.ts:94-95 compares 'Female' to applicable_gender 'F' |
| P-08 | H | Loans active without approval; EMI never deducted | `/api/api/loans/apply` → status active, 0 postings; run 4 has no LOAN_EMI for RML033917 | loans apply creates active; compute ignores pay.loans |
| P-09 | H | Payslip batch fails after finalize + leaves orphan documents | `generateRunPayslips` run 4/5 → 500; docs 4, 7 | payslip-generator.ts:296-301 vs trigger in 1752220000000_pay-schema-init.ts:152-160; no transaction |
| P-10 | H | Claim submit always 500 | `/api/api/claims/submit` (valid type 'hotel') → 500 | claims.service.ts:142-158 omits funding_kind/budget_id → `claims_budget_present` |
| P-11 | H | Payroll console and ESS My Pay show hard-coded mock data; employee can open /payroll | screenshots `payroll_payroll.png`, `sample_RML033625_my_pay.png`, `employee_payroll.png` | PayrollPage.tsx:366, 424; MyPayPage.tsx:38-60 (no API) |
| P-12 | H | Loans and Claims UI hit 404 | `/loans`, `/claims`, `/my/claims` | Frontend uses `/api/loans/*`, `/api/claims/*`; backend routes are `/api/loans` under the `/api` mount, i.e. `/api/api/...` (ClaimsPage.tsx:120…) |
| P-13 | H | Transfers: maker approves own; future-dated applied immediately; inter-entity approve 500 | Transfers 3/4/5 | transfer.service.ts:408-419 (no cost-centre/org reset, no effective-date scheduling), no maker≠checker check |
| P-16 | H | Statutory bonus not prorated (paid on LOP/joiners/leavers; 0-day employee paid ₹1,363) | RML033911, 908, 909, 910, 924, RGH033903/904/906 | `STATUTORY_BONUS.prorate_on_lop=false` + proration.ts:73 |
| P-23 | H | Travel: settle draft claim without approval; advance on another's trip (IDOR); late-approved advance never adjusted; inverted dates and out-of-trip items accepted | trips 5/6, claim 2, advances 3/4 | travel.service / settlement.service lack ownership, status and date checks |
| P-14 | M | Negative-net finalize block only escapable via super_admin reopen; refusal is a 500 | Run 4 finalize | run.service.ts:214; reconciliation.service.ts:82-93/139-144; no carry-forward / recovery cap |
| P-15 | M | Business-rule refusals return 500 (plain Error) | approve-before-review/self-approve (run.service.ts:92/133/180), travel double-settle (settlement.service.ts:228), item to settled claim (:114), advance re-approve (travel.service.ts:299), transfer non-pending/exited (transfer.service.ts:237/156), unknown claim type (claims.service.ts:116), past LWD (separation.service.ts:91-92), payslip for non-run employee | generic Error → 500 mapping |
| P-17 | M | PT state not passed; Odisha employee gets WB slab; estimate gives OD = 0 | RML033923 PT 150 | compute-engine.ts:155/321 default 'WB'; pt.ts WB-only |
| P-18 | M | Apprentice not representable; stipend charged ESI/PT | RML033907 | contract_type enum lacks 'apprentice'; category/contract not passed to engine |
| P-19 | M | Probation-% salary assignment returns 500 | POST salary assign phase=probation 80/70/90 | salary.service.ts:89-97 validates the scaled breakup against the full CTC |
| P-20 | M | Employer contributions not computed in run; JV lacks employer cost and ESIC payable GL | payslips `employerContributions: []`; JV | run-compute / JV mapping |
| P-22 | M | Separation: approved LWD before resignation (shortfall 210 d), RM approves directly, view hard-codes dept/designation, payroll/IT can't act on their clearances | separations 6/7 | separation.service.ts:286-287; RBAC |
| P-24 | M | Onboarding: duplicate/minor/invalid-PAN candidates accepted; probation terms dropped on convert | candidates 3/4/5, emp 46 | candidate ingest / prejoin validation; convert mapping |
| P-25 | M | Investment declarations: employee can't declare; payroll declares and verifies own; old-regime projection uses 75k SD | declaration 1; projectTds Ritika | statutory.router.ts:348-412 permissions; tds.ts:297 |
| P-27 | M | Executive snapshot stale until manual rebuild; cost MTD from CTC not payroll; BU dashboard headcount 0 | executive.json vs executive_after_rebuild.json | reporting snapshot job |
| P-28 | M | Missing audit rows for F&F, separations, holds, loans, travel, documents, user create | Audit row of §7 | services write without audit |
| P-29 | M | Plain-text Aadhaar storage | S19 | core.employees.aadhaar |
| P-31 | M | Payroll inputs (variable pay/recoveries) have no API; must be SQL | pay.inputs | missing router |
| P-21 | L | Unrounded paise earnings and float JSON totals; bank file pays paise | S4, bank JSON | proration without rounding policy; JS float sums |
| P-26 | L | day_records 'A' created the day before DOJ | S10 | ingest/recompute D-1 lookback ignores doj |
| P-30 | L | Loan ledger route uses Express `:id` syntax | `/api/api/loans/4/ledger` needs `?loanId` | loans.router.ts:179 |
| P-32 | L | Unbounded live sessions | S20 | auth session issuance |
| P-33 | L | r3-regularizations ignores month; probation dates shown without year | reports | report filter / date formatting |

### Top 10

1. P-01 PF ceiling.
2. P-02 F&F ×100, negative, marked paid.
3. P-04 no TDS.
4. P-03 double payment of leavers.
5. P-05 ESI on non-ESIC.
6. P-16 bonus not prorated.
7. P-06 OT blocks run.
8. P-07 maternity impossible.
9. P-09 payslips fail after finalize (orphan docs).
10. P-11 payroll and ESS UI show mock data.

## 9. Direct-SQL / non-API steps I had to take (no app path exists)

1. Location "Bhubaneswar Office" (id 3, OD), grade JG, cost centre ERP-CELL inserted.
2. Employee master fields for the imported cohort: status, org, location, plant, cost centre, grade, contract, ESIC, tax regime, probation.
3. `biometric_registered=true` for 44 employees.
4. Device → location mapping for the devices auto-created by ingest.
5. 13 `pay.inputs` rows (`logs/pay_inputs.sql`).
6. `att.overtime_entries` id 2 set to `rejected`, to let RGH compute (P-06).

Also changed via the API (not SQL): the setting `att.manager_approval_required_for_lock=true` (via PUT /settings), and the role grants for cohort users (via the RBAC API).

## 10. Blocked / not covered

- The `paid` run state has no API.
- Form 16 / 24Q has no route.
- ECR, ESIC, PTRC and Form D do not read run data; they were tested with records I built from the run.
- Biometric registration and verification: the verify call always rejects and Kent is unavailable, so a test connector was used.
- Claims: the end-to-end flow (approve/payout) is blocked by P-10.
- Probation evaluate/decide: no review rows exist for the cohort.
- Auto-switch from probation to confirmed: not exercised.
- Inter-entity transfer completion: blocked by P-13.
- Payslip PDF archive: blocked by P-09.
- Second-month variance: there is only one month of runs.

## 11. Files

- `PAYROLL_TEST_REPORT.md` (this file)
- `reconciliation.xlsx`
- `cohort.json`, `ids.json`, `runs.json`
- `scripts/`: qa.py, cohort.py, import-cohort.ts, s1_salaries.py, ingest-june.ts, s2_recompute.py, reconcile.py, build_xlsx.py, m1/m2/m2b/m3.py, and the diagnostic scripts diag-*.mts (each rolls back its transaction)
- `outputs/`: bank, JV, payslips, statutory, reports
- `screenshots/`: 12 PNG + ui_results.json
- `snapshots/`: BEFORE / MID / AFTER row counts + schema, maxid_BEFORE, rowdiff_BEFORE_AFTER.tsv
- `slop/`
- `logs/`: api-calls.jsonl, reconciliation.json, items_first_compute.tsv, statutory_results.json, mod*.json
