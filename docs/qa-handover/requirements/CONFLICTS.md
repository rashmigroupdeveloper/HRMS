# Rashmi HRMS: conflicts, contradictions and client-only questions

Prepared Sun 18 Oct 2026 (IST). Each item gives the conflicting sources, why it matters, what the current code does (`/workspace/hrms-fix` at `ba6e81d` plus uncommitted changes), and the decision needed.

Owner codes:
- **C** = client (RML HR/Finance/sponsor)
- **L** = legal/statutory
- **S** = sponsor (Anoop)

Decision IDs D01–D12 refer to `plans/sow-completion/08-DECISIONS-AND-OPERATIONS.md`, which already logs several of these as unresolved.

## A. Status and scope contradictions

| ID | Conflict | Sources | Current code / impact | Decision needed (owner) |
|---|---|---|---|---|
| C-01 | **Completion is reported four different ways.** | SOW Tracker sheet total is 93.1% (most rows scored 1). The Agreement Tracker RML totals are 81.3% and 85.5% in its two copies. Pending Implementation (28 Aug) has Protiviti saying "Completed" while RML counters on 16 ESS rows. QA on 18 Oct found SOW rows Done 8 / Partial 106 / Broken 8 / Missing 16 / N/A 38. This baseline finds SOW rows Done 5 / Partial 123 / Missing 14 / Not software 34. | Client scores describe the *greytHR/Protiviti* delivery, not this HRMS. Do not reuse the client's "1" scores as acceptance. | Agree that SOW_TRACEABILITY.xlsx (code verdict) is the working baseline, and that acceptance is by UAT per row. (S/C) |
| C-02 | **HOD role.** The user requires department HODs to approve within their department. docs/08 defines 10 roles and no HOD. EMS has `hod_id`, documented as the *functional manager*. docs/01 TE-07 uses "RM → HOD → Admin/Finance". | User context; docs/08 §1; docs/recon/ems-master-taxonomy.md; docs/01 TE-07 | There is no HOD role and no department-head approver type. A `core.employees.hod_employee_id` column exists (migration `1752160000000_employee-hod.ts`), but no code reads it. The domestic travel advance uses `functional_manager` as a stand-in (`workflows/definitions.seed.ts:69-75`). | Is HOD (a) the department head from the org master, (b) the functional manager, or (c) both? Which requests need an HOD step (travel advance, long leave, OT pre-approval, requisition, offer)? (C/S) |
| C-03 | **Group vs entity scope.** The user says hr_head, super_admin and ceo_cell are GROUP-level. docs/08 calls hr_head "full-company scope" (ambiguous between company and group) and gives ceo_cell ✓(R) employee.read with aggregate-only compensation. | User context; docs/08 §1–2 | Group = role assigned with no org unit. This is in progress and uncommitted (`core/rbac/company-scope.ts`, `tests/group-entity-scope.integration.test.ts`). | Confirm ceo_cell is group-level *read*, and whether any hr_head is ever entity-limited (e.g. an RGH-only HR head). (S) |
| C-04 | **Who co-signs payroll.** docs/08 says finalize needs payroll_admin plus an hr_head co-sign, with ceo_cell read-only. | docs/08 §2/§4; docs/14 §3 | `payroll-core/runs/run.service.ts:200-206` accepts hr_head **or super_admin or ceo_cell** through hard-coded role strings. This breaks both docs/08 and the AGENTS "no role strings in handlers" rule. | Confirm hr_head only (super_admin break-glass?). Move the check to a permission code. (S) |
| C-05 | **Offer/LOI approval chain differs across documents and code.** | The LOI flowchart has Initiator → Plant Head (RML1) / GM (RML6) → HR Head → CEO. SOW_ATS_FINAL has Draft → HRBP/Manager review → Business Head → HR Head → Management → CEO → Issued. docs/08 §4 has Initiator → Plant Head/GM → HR Head → CEO. | Code seed: `offer_approval` = hr_head → ceo_cell only. There is no offer entity in HRMS. | Choose the chain, including whether HRBP/Manager review and a separate "Management" stage exist. (C) |
| C-06 | **Is offer approval in or out of HRMS scope?** | Pending Implementation: Anirban says exclude it because it is in Workday ATS. Reports-Templates email (Sharique): deliver the offer approval workflow separately from ATS. docs/07: Phase 4. | Missing (RQ-ATS-002). | In HRMS now, in the separate ATS app, or in Workday? (C/S) |
| C-07 | **What the ATS is.** | Protiviti proposed a paid ATS (₹1,900/login/month plus ₹50k setup, 15 recruiters). ERP update says ATS at ₹1,800/login with no timeline. Latest Update: "If Excel is possible to upload we can proceed". Pending Implementation mentions Workday ATS. Protiviti Status says ATS is not aligned. docs say an in-house ATS app (`interview_scheduling`) runs alongside with SSO. | `RecruitmentPage.tsx` is a Phase-4 placeholder, yet its copy says "Offers already become joiners" and "Hiring reports already read across". `/lifecycle/candidates/ingest` takes JSON. No Excel offer upload. SSO is not built. | Which system is the system of record for candidates and offers? Is an interim Excel upload of offers/joiners acceptable? (C/S) |
| C-08 | **Claims and travel scope.** | SOW §6 (reimbursement bank file, register, payslip) and PRD M12/M13 are in scope. Protiviti Status says the travel advance module was dropped. The sponsor deferred claims and budgets (plans/launch-readiness/00). The Latest Update still wants George as final approver for global travel advances. | Claims insert violates a DB CHECK (SCHEMA_AUDIT S-02). There are two parallel claim models (`pay.claims` and `te.claims`). | Confirm claims and travel go-live timing, and pick one claims model. (S/C) |
| C-09 | **Payroll ownership.** | plans/non-payroll-microfeature-evidence: the sponsor deferred payroll to a payroll specialist (5 Sep 2026). Payroll code was built afterwards (commits b92b6d2, ba6e81d). The user now requires exact register parity. | Payroll engine exists. Parity is 11/44 per QA, with fixes not yet re-verified. | Confirm payroll is in scope for this go-live and who signs off money diffs (human review is mandatory per AGENTS). (S) |
| C-10 | **Flexi benefits.** | SOW rows 14 and 27 are scored 1. Pending Implementation says flexi is not part of the RML salary structure. | Not built. | Exclude flexi formally? (C) |
| C-11 | **Annual bonus.** | Agreement: annual bonus has "no use case". PRD PAY-17 has an annual bonus. The register pays STATUTORY_BONUS 8.33% monthly. | `calculateBonusTrueup` exists. | Is the monthly 8.33% final, with no annual true-up or ceiling proration? Confirm eligibility (₹21k) for monthly payment. (C/L) |
| C-12 | **Ad hoc reports, recommendations, communication protocol.** | SOW rows 143, 194 and 222 are scored 1, but they are service terms or undefined features. Rows 113–115 are scored 1 although row 112 says those proration modes are "not possible". | Marked Not software / Missing in the baseline. | Include or exclude each clause (D08). (C/S) |

## B. Payroll and statutory rule conflicts

| ID | Conflict | Sources | Current code | Decision needed |
|---|---|---|---|---|
| C-13 | **PF wage base.** | greytHR and the client register deduct 12% of ACTUAL basic (32,286 → 3,874). The statutory ceiling is ₹15,000. EPF scheme changes are pending (D01). | `pf.ts` defaults to ACTUAL, with CEILING_15000 available. QA saw a capped 1,800 before the fixes. | Confirm ACTUAL basic for all employees, or opt-in per employee. Confirm the employer EPS/EPF split and admin charges. (C/L) |
| C-14 | **Gratuity eligibility.** | docs/04: ≥ 4 years 240 days. docs/10: STRICT_5Y by default. | Configurable in statutory params. | Which rule, and is fixed-term employee treatment under the Labour Codes in scope? (L/C) |
| C-15 | **OT rate base.** | docs/04: Basic/26/8. docs/10 and the OT payslip template: (Basic + DA + allowances)/208 at 2× (Factories Act). | The template uses the Factories Act base. | Provide the signed OT formula per category, and the OT cost used in the CEO dashboard. (C/L) |
| C-16 | **LOP divisor and proration.** | SOW rows 109–111 are supported modes and rows 113–115 are "not possible". The SOW payroll remark says "working day logic corrected as per RML from Aug payroll". docs/10 offers a WORKING_DAYS option. | Proration is configurable, and D10 is open. | Which divisor does RML use (calendar, 26, 30, working days)? Provide a worked register example with LOP. (C) |
| C-17 | **Payroll/attendance cycle.** | The June 2025 muster runs from the 26th of the previous month to the 25th. All docs and code use calendar months. | The muster uses calendar months (`reports/muster.service.ts:72-73`). There is no cycle setting. | Confirm the 26–25 cycle for attendance cut-off, and whether payroll still pays calendar-month salary with LOP from 26–25. (C) |
| C-18 | **ESIC and OT.** | docs/10 excludes OT from contribution wages. The ESIC FAQ includes OT in contribution wages while excluding it for the coverage test. | Engine follows docs/10. | Legal confirmation (D01). (L) |
| C-19 | **LWF frequency.** | docs/10: WB half-yearly ₹3/₹30. Some greytHR configurations deduct monthly. | Half-yearly. | Confirm the period and states (Odisha?). (L/C) |
| C-20 | **TDS scope.** | SOW row 145 remark: "Handling only white collars". The PRD computes TDS for all employees. | All employees with taxable income. | Should blue-collar TDS be computed by HRMS or not? (C) |
| C-21 | **FY slabs.** | docs/10 has FY 2025-26+ slabs (0–4L nil, 87A ≤ 12L/₹60k). The DB seed `pay.it_slabs` had FY 2024-25 slabs, with no FY 2026-27 rows (SCHEMA_AUDIT S-13). | Commit ba6e81d moved rates to versioned config. Re-verify. | Approve the FY 2026-27 slab table. (L) |
| C-22 | **F&F turnaround.** | SOW: 3 working days and 2 F&F cycles a month. Code on Wages §17(2): wages within 2 working days for specified separations (D01). | No cycle or TAT tracking (RQ-SEP-006). The unique run key prevents two F&F runs a month (D11). | Legal applicability, and the cycle dates. (L/C) |
| C-23 | **"Exactly reproduce the client register" vs statutory correctness.** | The user requires exact parity. D01 warns that the register's rules (e.g. PF on actual basic, PT state, ESIC gate) need legal confirmation, and historical values are not legal truth. | Parity work in progress. | If the register deviates from law, does parity or compliance win? Get a signed exception list. (S/L) |
| C-24 | **Payslip template.** | Protiviti Status: match the *old* RML format. Pending Implementation: May/Jun/Jul payslips used three different templates. Docs: three payslip types. | Three types, generic layout. | Provide the single approved sample for regular, OT and reimbursement payslips. (C) |
| C-25 | **Probation % appears in three places.** | LOI 70/80/90%. `core.employees.probation_salary_pct`, `pay.employee_salaries.probation_percent` and `onboarding_candidates.probation_salary_pct` (default 100). | Duplicated sources (SCHEMA_AUDIT S-26). | Single source of truth (an engineering decision) plus client confirmation of the allowed % values. (S/C) |
| C-26 | **Loan eligibility multiple.** | The SOW remark says loan eligibility is "calculated to Basic". The PRD says "multiple of Basic" without the number. QA found a ₹1 crore loan accepted. | Tenure and CTC-ratio checks exist. | Provide the eligibility policy: multiple, minimum tenure, maximum concurrent loans, interest, categories. (C) |

## C. Attendance and leave policy conflicts

| ID | Conflict | Sources | Current code | Decision needed |
|---|---|---|---|---|
| C-27 | **Who may modify attendance.** | Temp Copy PainPoint: "We do not want anybody to have access to modify the attendance, except the Protiviti team on clearance from HR." docs/01 ATT-17 and docs/08 let hr_ops override with a reason. | hr_ops override with mandatory reason and audit (pack29). Managers are blocked. | After Protiviti exits, which HR role may override, and must a second person approve each override? (C) |
| C-28 | **Week-off eligibility.** | Pending Implementation: no WO if UAB on all 6 working days, and no WO if absent the whole month. Reports-Templates email: must work ≥ 1 day in the week. docs/01 ATT-09 combines both. | `att.weekoff_min_worked_days` setting. D05/D06 open. | Do leave, OD and holidays count as "worked"? What happens with a half-day? (C) |
| C-29 | **Absentee threshold.** | PainPoint: show-cause at 7–10 days. docs/01 ATT-10: 7 days (configurable). | Configurable. | The exact day count, and whether week-offs/holidays count. Stages and letter templates. (C) |
| C-30 | **Two-session rules.** | greytHR G5 sessions 09:00–13:30 / 13:31–18:00. HRMS uses first-to-last overlap with a fraction threshold (an assumption). Minimum hours, grace and penalties were not recovered (recon). | Session status implemented. Thresholds unconfirmed (D05). | Provide the minimum full/half-day hours, grace, break and penalty-day rules per scheme, plus the GCS Saturday rule. (C) |
| C-31 | **OT approval model.** | SOW row 62: OT based on *pre-approved* policies (0.5, "automated application is not possible"). Protiviti Status and PRD: detect, then manager approves within 48h. Latest Update: OT assignment to new employees. | Post-detection approval with 48h lapse. No pre-approval (D06). | Pre-approval, post-approval or both? Which categories are OT-eligible? (C) |
| C-32 | **Roster ownership and deadline.** | Agreement 4.1b: managers cannot update shifts; the roster must be updated by the 5th. docs/01: managers maintain the roster, with reminders. | Manager roster exists. The reminder fires at 09:00 *on* the 5th (`jobs/worker.ts:179`), not before it. | Should the deadline be the 5th of the month being rostered or of the prior month? Reminder schedule? (C) |
| C-33 | **Leave approval chain.** | docs/08 §4: Leave RM → HR. SOW row 58: multi-level. User: HODs approve within the department. | Seed chain is RM only. | Final chain per leave type and duration. (C) |
| C-34 | **Leave accrual.** | EL only after 1 year (Latest Update). Accrual rates and the leave year were never supplied. ATT-12 says attendance approval precedes credit, while docs/04 says gaps flag but do not block (D02). | Configurable. | Provide accrual rates, the leave year (calendar or FY), carry-forward caps and the encashment rules. (C) |
| C-35 | **Holiday calendar granularity.** | SOW row 57: by location *and department*. docs: by location/plant. | Location only. | Are department calendars needed? (C) |

## D. Data and master conflicts

| ID | Conflict | Sources | Notes |
|---|---|---|---|
| C-36 | **Headcount.** | May invoice monthly fee at headcount **4,593**. EMS master **1,066** users. Sponsor: ~**3,000** on-roll, designed for 10k. Protiviti Status: Emsphere selected at ₹12.76L for **labourers**. | Which population does HRMS cover? Are contract labourers in Emsphere outside HRMS, despite the CEO dashboard "Contract" column? (C) |
| C-37 | **Entity list.** | docs/09: 6 entities. docs/11: 14. The DB seeds 13 companies. EMS lists "Rashmi Metalix Ltd" (typo → merge into RML) and "Rashmi 6 Paradigm Limited" (suspected typo). RDL = Reach Dredging Limited. RPL = Rashmi 6 Paradigm. | Confirm the canonical legal names and which entities run India payroll in HRMS (RPF Dubai, UK, Bahrain, Tanzania excluded?). (C) |
| C-38 | **E-code series vs entity.** | CORE-02 says one series per entity. EMS prefixes split RML into RML/RMLC/RMLS/RMLUK, plus RGH/RDL/RPL/KIOL/EIPL/EIPLL/KOL/KOLC/RREL/RPF/RMTZ/RMB/RBS/RASPL/RDLC/RPLC. | Which prefixes are entities and which are categories (C = consultant? S = staff?). E-code policy on entity transfer (D09). (C) |
| C-39 | **Functional reporting manager data.** | PRD CORE-03 and Pending Implementation require it. RT: "not yet updated". | Who provides the functional RM data? (C) |
| C-40 | **Master mandatory fields.** | docs/03 declares 10 employee columns NOT NULL. The DB has them nullable, with gaps in the data (SCHEMA_AUDIT S-04). | Backfill source and onboarding exceptions. (S/C) |
| C-41 | **Validation rules.** | SOW 5.2 lists the PAN, Aadhaar, IFSC, account length, minor, ESIC duplicate and special-character checks, but gives no exact rules (D09). | Approve the regex catalogue in RQ-CORE-010..016. (C) |
| C-42 | **Muster template.** | Two June 2025 muster files: the ".xls" (actually xlsx) has no manager columns, while the other has Manager No/Name. PRD adds RM, Emp ID and cost centre. | Confirm the final column list and order. (C) |

## E. Missing or unusable source inputs

| ID | Item | Impact |
|---|---|---|
| C-43 | `Documention_ProtiVity/Document.docx` is empty (only an empty document2.xml). | No content. Ask the client what it should contain. |
| C-44 | The `NDA` folder named in the task does not exist in the repo. | Nothing to extract. |
| C-45 | `ATS/Temp Copy/ATS TRACKER.url` is only a Google Sheets link. | Tracker content unavailable offline. |
| C-46 | The BU/HR dashboard and recruitment report templates were "shared long back" (Reports-Templates email) but are absent from the docs. | RQ-RPT-004/005 cannot be accepted without them (D08). |
| C-47 | No bank file, SAP JV, ECR or payslip format specifications were supplied. | RQ-OUT-001/004/005, RQ-STAT-009 acceptance is blocked. |
| C-48 | No real Kent access, protocol or raw data yet (sponsor will supply). | RQ-ATT-001 remains Partial. |
| C-49 | `docs/16-MICROFEATURE-INVENTORY.md` is referenced by plans but absent (D12). | — |

## F. Questions only the client can answer (consolidated)

1. **HOD:** who is the HOD per department, which requests need an HOD step, and is the HOD the functional manager (C-02)?
2. **Offer/LOI:** what is the final approval chain, and is it in HRMS, the ATS, or Workday? Is an Excel upload of offers/joiners acceptable as an interim (C-05..07)?
3. **LOP and proration:** confirm the divisor, the 26th–25th cycle, and give a worked LOP example from the register (C-16, C-17).
4. **PF:** confirm ACTUAL basic for everyone, the employer split and admin charges (C-13). **Gratuity:** which rule (C-14)? **OT formula and eligible categories** (C-15, C-31)?
5. **Attendance policy:** minimum hours, grace, penalty days, session thresholds, the GCS Saturday scheme, week-off qualification, and the absentee day count (C-28..30).
6. **Leave policy:** accrual rates, leave year, EL after 1 year, carry/encash caps, and the approval chain per type (C-33, C-34).
7. **Attendance overrides:** which HR role may override after Protiviti exits, and is a maker-checker needed (C-27)?
8. **Statutory scope:** PT for Odisha and other states, LWF frequency, TDS for blue-collar staff, and FY 2026-27 slabs (C-19..21).
9. **Formats:** approved payslip samples (regular/OT/reimbursement), bank file, SAP JV, ECR/ESIC/PT formats (C-24, C-47).
10. **Population:** headcount in scope (4,593 vs 1,066 vs ~3,000); contract labourers (Emsphere); and which of the 14 entities run payroll in HRMS (C-36, C-37).
11. **E-code prefixes:** the meaning of the RMLC/RMLS/KOLC/… variants, and the policy on entity transfer (C-38).
12. **Functional reporting manager** data owner, and the master mandatory fields (C-39, C-40).
13. **Loans:** eligibility policy, existing SAP loan balances as of cut-over, and whether all employees can apply (C-26).
14. **Flexi, annual bonus, ad hoc reports, survey recommendations, F&F communication protocol, alumni access:** include or exclude each (C-10..12).
15. **Claims and travel advance:** go-live timing, and confirm George (CHRO) as final approver for global advances (C-08).
16. **Dashboards:** supply the BU/HR dashboard templates. Supply the production-output source for the per-unit and per-man-hour KPIs (C-46, RQ-RPT-108/110).
17. **Notice periods** (90 days white collar / 30 days others is a placeholder setting) and probation length (6 months placeholder).
18. **Register parity vs law:** when the register deviates from statute, which wins (C-23)?
