# Amendments to Phases 1–4 (the doc-15 Register E depth gaps)

**Purpose.** 30 of the 116 gaps are not new modules — they are **missing depth inside modules we already own**.
They do not deserve a phase; they deserve to be folded into the phase that already touches that code. This file is
the checklist of those folds, so they are not lost between the gap register and the build plan.

**Rule:** an amendment marked 🔴 **must be added to the phase's spec *before* that phase starts.** Retrofitting it
after the module ships costs multiples more — and for Phase 2, some of them change arithmetic.

---

## A. Phase 1 (Attendance · Leave · Workflow) — already at Gate G1, so these are follow-ups

| Gap | Amendment | Where it lands | Effort |
|---|---|---|---|
| **E06** | **Permission / short-leave quota engine.** The `PERMISSION` request type is built; the *entitlement* is not — n per month, max minutes per instance, cumulative cap, and what happens on breach (auto-convert to half-day LOP, per policy). All values in `core.settings`. | `attendance-requests.router.ts` + a `permission_quota` setting group | S |
| **E08** | **Statutory & policy leave types missing from the catalog:** paternity, adoption, bereavement, marriage, quarantine, sabbatical. The type engine already supports the rules; these are seed + policy decisions, not code. | `lv.leave_types` seed + docs/09 recon confirmation | S |
| **E09** | **Leave planner / team calendar** with blackout periods and minimum-coverage rules, so a manager can see the month before approving the fourth request for the same week. | new tab in `/my/team`; `lv` coverage rules | M |
| **E10** | **Negative-balance / advance-leave policy object**, and leave donation/bank if policy allows. Today the ledger cannot go negative by design; the *policy* question has never been asked. | `lv` policy settings | S |
| **E11** | **Restricted-holiday quota per calendar per grade** — RH is built, the entitlement count is not differentiated. | `attendance-config.router.ts` | S |
| **E21** | **No-code approval-chain builder for `hr_head`.** WF-01 promises configurability; today chains are seeded. Build the builder UI over the existing definition model. | `/admin/workflows` | M |
| **E22** | **Conditional routing on data attributes** — amount, grade, entity, plant, not just "> N days". The engine needs a condition object per step. | `workflows` module | M |
| **E23** | **Parallel / quorum approval steps** — needed properly by POSH (5.5) and IC decisions; build it once here. | `workflows` module | M |
| **E24** | **Approve from email / push deep-link** with a signed, single-use, short-TTL token. Pairs with Phase 8 channels. | `workflows` + `notifications` | M |
| **E25** | **Bulk approve across request types** in one inbox action, with per-item results (partial success is normal). | `/approvals` | S |

---

## B. Phase 2 (Payroll) — 🔴 **all of these belong in the spec before the first line of money code**

These are cheap to design in and brutal to retrofit, because each one either changes the run model or adds a
column to something immutable.

| Gap | Amendment | Why it must be up-front |
|---|---|---|
| 🔴 **E12** | **Salary hold / withheld payment** with a release workflow. | A run that cannot hold a payment forces manual bank-file editing — which breaks the audit chain on day one. |
| 🔴 **E13** | **Off-cycle / supplementary run type**, distinct from the monthly run, with its own numbering, registers and bank file. | Retrofitting a second run type into a locked-month model is a migration, not a feature. |
| 🔴 **E14** | **Multi-bank / multi-format bank advice per entity**, plus **payment-status reconciliation** (returned/failed credits re-opening a payable). | 14 entities, several banks. The failure path is the part everyone forgets and everyone needs. |
| 🔴 **E15** | **GL/JV posting to SAP** with cost-centre mapping, posting status and re-post. | The mapping shape determines the run's output model. |
| 🔴 **E16** | **Tax-regime election per employee per FY**, with a lock date and a change audit. | It is an input to every TDS computation from the first run. |
| 🔴 **E17** | **Form 16 Part A+B assembly, bulk digital signing, distribution, reissue.** | Depends on the e-sign provider chosen in Phase 5 Stage 5.4. |
| 🔴 **E18** | **Perquisites beyond loans** (car, accommodation, ESOP) and **Form 12BA**. | Perquisite valuation is part of the calc order, not an afterthought. |
| 🔴 **E19** | **Variance-vs-prior-month exception dashboard** as the pre-finalize control (the natural home for Phase 8's anomaly detection). | It is the single most effective payroll defect control there is. |
| 🔴 **E20** | **Input freeze / cut-off calendar** with per-source status: attendance locked ✓, claims closed ✓, loans ✗. | Defines when a run may compute at all. |
| 🔴 **A01/A02/A04** | Wage-definition check, 48-hour F&F clock, fixed-term gratuity — **delivered by Phase 5 Stage 5.1 and consumed here.** | Gate G5a exists precisely for this. |

**Also fold in:** the payroll-input contract from Phases 6–7 (canteen recovery, transport recovery, disciplinary
fine, subsistence allowance, benefit deductions, comp-cycle revisions) — all arrive as **rows in payroll input
tables**, never as direct writes to a run. Design that interface once, in Phase 2.

---

## C. Phase 3 (Lifecycle · Assets · Helpdesk · Engagement · Executive)

| Gap | Amendment | Where |
|---|---|---|
| **E28** | **Knowledge base / FAQ with deflection at ticket creation** — surface relevant articles before the employee hits submit. Becomes the corpus the Phase-8 assistant answers from. | `helpdesk` |
| 🔴 **E29** | **Confidential / sensitive ticket class** with restricted visibility. **Prerequisite for POSH and grievance (5.5)** — build it here, use it there. | `helpdesk` |
| **E30** | **CSAT on resolution**, plus attachments, re-open window and linked/duplicate tickets. | `helpdesk` |
| **B17** | **Onboarding depth:** buddy assignment, 30/60/90 check-ins, onboarding feedback survey. Folds into the LC-02 task fan-out rather than becoming a new system. | `lifecycle` |
| **B14** | **Exit interview + attrition-reason taxonomy + knowledge-transfer checklist + rehire flag.** Detailed in Phase 7 Stage 7.7, but the *taxonomy* should be seeded here so exits from day one are classified. | `lifecycle` |
| **E26** | Remaining reports R7–R23, R25–R31 — sequence by usage telemetry once Phase 8 §PLT-11 exists; until then by the CEO-dashboard dependency order. | `reports` |
| **AST** | Asset **incident/damage/lost** handling with payroll recovery; employee asset request via ESS; QR/barcode audit. | `assets` |

---

## D. Phase 3.5 (Travel & Expense)

| Gap | Amendment | Note |
|---|---|---|
| **13.15** | **OCR receipt capture** — auto-fill amount, date, merchant from the bill image. Ships as a *draft* the employee confirms (the Phase-8 AI write-guard rule applies). | Highest-value T&E micro-feature by usage |
| **13.16** | 🔴 **GST input-credit capture** — GSTIN, invoice number, tax split on expense lines. | For a manufacturer this is real money; adding the columns later means re-keying a year of claims |
| **13.17** | **Corporate card feed + statement reconciliation.** | Depends on whether cards are in use — confirm with finance |
| **13.18** | **Per-diem/DA auto-computation by city slab with half-day rules** — the budget engine covers DA loosely; make it explicit. | |
| **13.19** | **Duplicate receipt/claim detection.** | Cheap, high trust value |
| **13.20** | **Mileage / own-vehicle claim with a rate master.** | |

---

## E. Phase 4 (ATS) — a decision, not an amendment

Phase 4 is three tasks: "absorb the existing ATS". Phase 7 Stage 7.6 specifies what a complete recruitment spine
looks like (MRF with budget check, position master, scorecards, offer modelling with the wage check, BGV, e-sign,
IJP, referrals, analytics). **These two cannot both be right.**

| Option | What it means | Recommendation |
|---|---|---|
| **Absorb** | Keep the existing ATS as the pipeline; build only MRF + position master + offer chain + handoff in HRMS | Viable if the ATS is genuinely serving recruiters today |
| **Rebuild** | Phase 7 Stage 7.6 becomes the recruitment module; the ATS is retired like Yatra Avedan | Better long-term; higher cost |
| **Split** | HRMS owns requisition→approval→offer→onboarding (the *governed* parts); ATS keeps sourcing→pipeline (the *recruiter tooling*) | **Recommended.** It puts the budget check, the wage check and the approval chain where the controls live, without rebuilding sourcing |

**Regardless of the option:** MRF with a budgeted-headcount check, the position/establishment master, and candidate
privacy (notice/consent/retention from 5.3) are needed. Those three are not optional under any of the three paths.

---

## F. Coverage close-out (holes from the 5–8 review — now tasked)

Full catalog: [`coverage-closeout.md`](coverage-closeout.md). Host stages:

| Item | Host |
|---|---|
| Company / plant / MIS / department filters | Phase 2 Stage **2.0** |
| Payroll E12–E20 + loan foreclosure + MIS registers | Phase 2 Stage **2.7** |
| Foreign entity local/WPS payroll | Phase 2 Stage **2.8** (proposed **D14**) |
| Shift micro-controls, scheduling, chain preview | Phase 1 Stage **1.11** |
| SCIM | Phase 5 Stage **5.2b** SEC-15 |
| Forgot-password, profile-change, custom fields | Phase 5 Stage **5.8** |
| Fatigue, NAPS/NATS, ID card | Phase 6 Stage **6.8** |
| Retirement pipeline, workforce scenarios | Phase 7 Stages **7.6 / 7.7** |
| R&R, eNPS, birthdays, EAP, education | Phase 7 Stage **7.8** |
| In-app bell, auto-roster, smart MIS/roster/leave, branding | Phase 8 Stages **8.2 / 8.4 / 8.6 / 8.7** |

---

## Tracking

Each amendment becomes a task in its host phase file when that phase is opened, tagged with its gap ID
(`fix: E13 off-cycle payroll run type`). This file is the source; the phase files are the execution. When an
amendment is absorbed into a phase file, tick it here with a pointer.

- [ ] A. Phase 1 follow-ups scheduled **(+ Stage 1.11 shift micro / scheduling written into phase-1)**
- [ ] B. Phase 2 amendments merged into `phase-2-payroll-statutory.md` **before Phase 2 starts** 🔴 **(+ Stages 2.0, 2.7, 2.8 written)**
- [ ] C. Phase 3 amendments merged into `phase-3-lifecycle-assets-executive.md`
- [ ] D. Phase 3.5 amendments merged into `phase-3.5-travel-expense.md`
- [ ] E. Phase 4 decision taken and recorded as a locked decision in `docs/00`
- [x] F. Coverage close-out stages written into Phases 1, 2, 5, 6, 7, 8 — see `coverage-closeout.md`
