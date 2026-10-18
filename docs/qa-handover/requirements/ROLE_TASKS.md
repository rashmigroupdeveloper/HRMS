# Rashmi HRMS: role task catalogue for UI test suites

Prepared Sun 18 Oct 2026 (IST). Sources:
- docs/08 (role catalogue, permission grid, navigation per role, approval chains).
- docs/01 and docs/04–06.
- The client documents in `Documention_ProtiVity/`.
- The user's context for this baseline.

Each task ends with one or more `RQ-…` IDs. The numbered UI steps for an ID are in `REQUIREMENTS.md` and `REQUIREMENTS.xlsx`. Every role also has **negative tests** (things it must NOT be able to do), and those matter as much as the positive ones. The **Status** tag is the current code verdict from REQUIREMENTS.xlsx, so a suite can mark the expected failures.

## Scope model (applies to every role)

| Scope class | Roles | Rule to test |
|---|---|---|
| **Group** (all legal entities, present and future) | hr_head, super_admin, ceo_cell (read and aggregates only) | The role is assigned with no org unit. The user sees RML, RGH, RDL, RPL, eHoome, Koove and others without reassignment, and a newly created entity is visible immediately (RQ-RBAC-003). |
| **Entity / plant / org unit** | hr_ops, payroll_admin, plant_head, it_admin | Records of other entities return 404 on read and 403 on action. Lists never include them (RQ-RBAC-004). |
| **Department** | HOD | Sees and approves only employees of their department, across that department's teams (RQ-RBAC-002, RQ-WF-010). |
| **Reporting tree** | manager (direct), senior_manager (direct and indirect) | Derived from core.reporting_tree. Employees outside the tree are invisible (RQ-RBAC-005). |
| **Self** | employee | Own records only. Changing an id in the URL or API returns 403/404 (RQ-OUT-002, RQ-SEP-001). |

Seeded QA users (password `Rashmi#Test2026`, from hrms-test/seed):
- employee@ (RML000008), employee2@ (RML000009), rgh.employee@
- manager@ (RML000007), srmanager@
- hrops@ (RML-scoped), hrhead@
- payroll@, planthead@, ceo@, itadmin@
- admin@ (super_admin, no employee record)

There is no HOD user, because the HOD role does not exist yet (RQ-RBAC-002, Missing).

---

## 1. employee (ESS)

Navigation (docs/08 §3): Home, My Attendance, My Leave, My Pay, My Claims, Helpdesk, Directory, Me/Letters/Policies.

| # | Task | Acceptance (summary) | RQ | Status |
|---|---|---|---|---|
| E1 | Log in with e-code and password. Log out. Reset a forgotten password. | Lockout after repeated failures. Same error for an unknown user and a bad password. A protected URL after logout shows sign-in. | RQ-NFR-001/002/003 | Done/Done/Partial |
| E2 | View own profile (personal, employment, statutory masked, RM and functional RM) | Own record only. Sensitive fields are masked. There are no edit controls on master fields. | RQ-CORE-001, RQ-NFR-004 | Partial |
| E3 | Request a family/nominee change | Request goes to HR for approval, and the master changes only after approval. | RQ-CORE-025 | Missing |
| E4 | View own attendance calendar and day detail | FILO in/out, worked hours, two-session glyph (A:P = half-day present), IST windows. | RQ-ATT-005, RQ-ATT-010 | Done/Partial |
| E5 | Apply AR for a whole day or one half, with reason. Track status, edit after send-back, resubmit. | Day becomes P only after final approval. Request history keeps the half. | RQ-ATT-013, RQ-WF-002 | Done |
| E6 | Apply Permission (short-duration) | Monthly limit is enforced. | RQ-ATT-014 | Partial |
| E7 | Apply OD, including future-dated OD | A future date is accepted, and the day shows OD after approval. | RQ-ATT-015 | Done |
| E8 | Claim comp-off for week-off or holiday work, and apply comp-off leave | Credit after approval. Expiry applies. | RQ-LV-006, RQ-ATT-034 | Partial |
| E9 | Apply leave: CL/SL/EL/Maternity (female)/RH, half-day, balance preview | Over-balance is blocked. Sandwich rule applies. Maternity is offered only to female employees. | RQ-LV-004, RQ-LV-002, RQ-LV-011 | Done/Partial/Done |
| E10 | Cancel an approved leave | Routes for re-approval. Ledger is reversed. Future days are NOT marked Absent. | RQ-LV-010 | Partial |
| E11 | Request leave encashment | Three-step approval. Paid in payroll. | RQ-LV-008 | Partial |
| E12 | View leave balances and ledger | Balance equals the sum of ledger lines. | RQ-LV-007 | Done |
| E13 | View and download own payslips (regular, OT, reimbursement), tax sheet, Form 16 | Own data only, never sample data. RML format with PAN/UAN/PF/ESIC. | RQ-OUT-001/002/007, RQ-STAT-007 | Partial/Partial/Partial/Missing |
| E14 | Submit investment declaration in the window, and upload proofs at year end | TDS projection updates after payroll verification. | RQ-STAT-006 | Missing |
| E15 | Apply for a loan within eligibility. View schedule, balance, ledger. | Ineligible amounts are rejected. Loan is active only after RM → HR Head → Payroll. | RQ-LN-001..004 | Partial |
| E16 | Raise a travel trip and advance. Submit a claim with bills. See wallet and settlement. | Chain per configuration. Over-budget is flagged. | RQ-TE-001..004, RQ-LN-007 | Partial |
| E17 | Submit an expense claim with bills (deferred by sponsor) | Shows entitlement balance. Partial approval visible. | RQ-CLM-002 | Partial |
| E18 | Resign (self only), see notice/shortfall, withdraw before final approval | Cannot resign on behalf of anyone else. LWD is frozen after submit. | RQ-SEP-001, RQ-WF-012 | Partial |
| E19 | As alumni after exit: see payslips, Form 16, letters only | No other modules. | RQ-SEP-008 | Partial |
| E20 | View and download issued letters | Appointment, confirmation, experience, relieving and others. | RQ-LTR-001 | Partial |
| E21 | Acknowledge policies. Respond to polls and surveys. Read announcements for own company only. | Each acknowledgement is recorded once. Audience is restricted to own company. | RQ-EN-001..004 | Partial |
| E22 | Raise a helpdesk ticket, see auto-ack, reply, reopen | Thread history is kept. | RQ-HD-001/003 | Partial |
| E23 | Mobile: ESS home, apply leave/AR/OD, payslip. Geo check-in (field staff). | Responsive. Geo captures lat/long. | RQ-NFR-013, RQ-ATT-025 | Partial/Missing |
| E24 | Prejoin (as candidate): open link, fill the form, upload documents, submit once | Link is single-use and time-limited. | RQ-LC-002, RQ-CORE-024 | Partial/Missing |

**Negative tests:**
- Open another employee's profile, payslip, loan, trip, wallet or separation by id. Expect 403/404 (QA B-04, B-14).
- Open /payroll, /admin, /reports/*, /people/{other} for sensitive tabs. Expect 403 page.
- Approve own request, including through delegation. Not possible (RQ-RBAC-009).
- Edit attendance directly. No control (RQ-ATT-027).

## 2. manager (derived: anyone with direct reports)

Navigation: everything the employee has, plus My Team, Team Overtime, Approvals, Team reports.

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| M1 | Approvals inbox: badge, approve inline (≤ 2 clicks), reject with reason, send back | Timeline is recorded. Only requests for own reports, or where the manager is the configured step. | RQ-WF-002/005/008, RQ-NFR-006 | Done/Done/Done/Partial |
| M2 | Approve or reject AR, Permission, OD, leave, leave cancel, comp-off, RH | Final effects apply only after the last step. | RQ-ATT-013..015, RQ-LV-004..011 | Done/Partial |
| M3 | Receive the daily OT summary. Approve or reject OT within 48h, otherwise it lapses automatically. | A lapsed item cannot be approved and is not paid. | RQ-ATT-016/017 | Partial/Done |
| M4 | Pre-approve OT for team members (OT plan) | Only pre-approved OT is payable. | RQ-ATT-018 | Missing |
| M5 | Maintain next month's team roster by the deadline (5th). Get reminders before it. | Saved roster drives day status. After lock, only HR can change it. | RQ-ATT-009 | Partial |
| M6 | Monthly attendance approval (attestation) for the team | Missing approvals block HR month lock. | RQ-ATT-023 | Done |
| M7 | View the team muster and team attendance grid. Export to Excel. | Rows limited to own tree. RM, functional RM and cost centre columns present. | RQ-ATT-029, RQ-RBAC-005 | Partial |
| M8 | Get absence / late / UAB alerts for reports | Recipients follow the configured matrix. | RQ-ATT-022 | Partial |
| M9 | Probation: get reminders and submit the review form (confirm / extend / terminate) | RM alone cannot finalise confirmation. HR Head step follows. | RQ-LC-007/008/009 | Partial |
| M10 | Approve resignations (step 1), loans (step 1), transfers (step 1), encashment (step 1), travel (step 1) | The next step is notified. | RQ-SEP-002, RQ-LN-003, RQ-LC-010 | Partial |
| M11 | Delegate approvals while absent (date range). Cannot delegate to own report or to the requester. | Delegate sees items "on behalf of". | RQ-WF-004, RQ-RBAC-009 | Partial |
| M12 | Raise a manpower requisition | RM → HR Head chain. | RQ-ATS-001 | Missing |
| M13 | Approve claims (step 1) | Partial approval allowed downstream. | RQ-CLM-002 | Partial |

**Negative tests:**
- No "mark present" or override control anywhere. The direct API returns 403 (RQ-ATT-027).
- Cannot see team salaries or bank details (masked).
- Cannot see employees outside the tree.
- Cannot confirm probation alone.

## 3. senior_manager (derived: manager of managers)

Everything the manager has, plus:

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| S1 | View the whole subtree (direct and indirect), e.g. "everyone under managers who report to Kinjal" | Muster, team grid and reports include indirect reports. People outside the subtree are excluded. | RQ-RBAC-005 | Partial |
| S2 | Receive escalations when a direct manager breaches SLA | Escalated item appears with an escalation marker. | RQ-WF-003 | Partial |
| S3 | Get UAB / absenteeism alerts "up the hierarchy" | As configured. | RQ-ATT-022 | Partial |

**Negative tests:** cannot act on a step that belongs to the direct manager unless it was escalated or delegated.

## 4. HOD (head of department; required by the user, missing in docs/08 and code)

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| H1 | HOD role assignable per department | Admin assigns HOD for a department. One department can have one or more HODs per policy. | RQ-RBAC-002 | Missing |
| H2 | Approve department-level requests where a chain contains a "department head" step: travel advance (RM → HOD → Admin/Finance), leave beyond N days, OT pre-approval, requisitions, offers for the department | Only requests from own department reach the HOD. Other departments' items are invisible. | RQ-WF-010, RQ-LN-007, RQ-TE-010 | Missing |
| H3 | View department muster, attendance, leave and OT reports across all teams of the department | Scope = department, not only the reporting tree. | RQ-RBAC-002, RQ-ATT-029 | Missing |
| H4 | Department dashboard (headcount, absenteeism, OT, attrition) | Aggregates for own department only. | RQ-RPT-004 | Missing |

**Negative tests:**
- Cannot see another department's employees.
- Cannot edit attendance.
- Cannot see individual compensation unless granted.

> Data note: EMS `hod_id` is documented as the *functional manager* (docs/recon/ems-master-taxonomy.md). Confirm with the client whether HOD means the functional manager or the department head (see CONFLICTS.md C-02).

## 5. hr_ops (entity-scoped HR operations)

Navigation: HR dashboard, People, Attendance ops (exceptions, month lock, absence cases, devices), Leave admin, Lifecycle (onboarding, probation, transfers, separations), Letters, Policies, Engagement, Helpdesk, Assets, Reports, Approvals.

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| O1 | HR dashboard: joiners/exits this week, absence cases, OT aging, probation due, policy acknowledgement %, helpdesk SLA | Counts scoped to own entity. | RQ-RPT-003 | Partial |
| O2 | Search people. Export the filtered directory. | Own entity only. | RQ-CORE-027 | Partial |
| O3 | Create and edit employee master records with validation (PAN, Aadhaar, IFSC, bank length, minor, duplicate UAN/ESIC, special characters, CTC = breakup) | Errors inline. Audit row for each change. | RQ-CORE-002, RQ-CORE-010..017 | Missing (IFSC length only) |
| O4 | Bulk import employees from Excel with a per-row validation report | .xlsx accepted. Error file downloadable. | RQ-CORE-020/021 | Missing |
| O5 | Maintain shifts, schemes, holidays (by location) | Changes audited. | RQ-ATT-007/008/024 | Partial/Done/Partial |
| O6 | Resolve unmatched/quarantined swipes and re-ingest | Day recomputed. | RQ-ATT-003 | Done |
| O7 | Manual attendance correction (own entity) with mandatory reason. Blocked on locked days. | Audit before/after. 409 when locked. | RQ-ATT-028 | Done |
| O8 | Recompute attendance for a range | Idempotent. | RQ-ATT-032 | Done |
| O9 | Month-lock checklist and lock per entity/month | Blocked until managers have attested and requests are resolved. | RQ-ATT-023/026 | Done |
| O10 | Absence cases: watch → show-cause letter → closure | Letter archived and visible in ESS. | RQ-ATT-021 | Partial |
| O11 | Build the muster for the 26th–25th cycle. Export Excel. | Template columns present. | RQ-ATT-029/030 | Partial/Missing |
| O12 | Leave types, accrual run, adjustments with reason, year-end run, RH list | Ledger lines written. | RQ-LV-001/003/007/011/012 | Done/Partial/Done/Done/Done |
| O13 | Step-2 approvals: leave (if configured), encashment, transfers, resignation step 3, claims HR verify | Per chain. | RQ-LV-005/008, RQ-LC-010, RQ-SEP-002 | Partial |
| O14 | Onboarding: candidates from ATS, send prejoin link, review application, confirm actual joining → e-code | Atomic conversion. No orphan employee. | RQ-LC-001..003, RQ-CORE-003/004 | Done/Partial/Done |
| O15 | Onboarding tasks follow-up (IT/Admin/HR) and escalations | Overdue tasks escalate. | RQ-LC-004 | Partial |
| O16 | Daily boarding/exit report: view, Excel, send | Recipients are Plant Head, HR, Business Head and CEO Cell. | RQ-LC-006 | Partial |
| O17 | Probation board. Confirmation letters after HR Head approval. | Salary switches automatically. | RQ-LC-007/008, RQ-PAY-004 | Partial |
| O18 | Transfers (department, location, cost centre, entity) with future effective date | No change before the effective date. History kept. | RQ-LC-010, RQ-PAY-014 | Partial |
| O19 | Separations: clearances, absconding, relieving/experience letters after clearance | Letters are gated on clearance. | RQ-SEP-003/004/007 | Partial |
| O20 | Letters: templates and issue with signature workflow | Archived in ESS. | RQ-LTR-001/002 | Partial |
| O21 | Policies: publish, acknowledgement report, nag. Announcements, polls, surveys. | Company audience enforced. | RQ-EN-001..004 | Partial |
| O22 | Helpdesk: work the queue, reply, change status, monthly performance report | SLA escalation. | RQ-HD-001..003 | Partial |
| O23 | Assets: register (past warranty allowed), assign to employee or third party, return, maintenance, non-returned list | Search by asset number. | RQ-AST-001..007 | Done/Partial |
| O24 | Reports R2–R31 and offer report, with Excel export | Scoped to own entity. | RQ-RPT-001/007, RQ-NFR-005 | Partial/Done/Done |
| O25 | Routing-hold queue: fix the approver, retry routing with a note | Cannot approve on someone's behalf. | RQ-WF-009 | Done |
| O26 | Create an offer/LOI draft and submit for approval (Plant Head/GM → HR Head → CEO) | Stage tracker with reminders. | RQ-ATS-002/008 | Missing |

**Negative tests:**
- RML hr_ops cannot see or act on RGH records (QA B-16).
- No payroll finalize.
- No compensation edit unless granted.
- Blank override reason is rejected.
- No role/permission administration.

## 6. hr_head (GROUP level)

Everything hr_ops has, across **all entities**, plus:

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| HH1 | Group-wide visibility of people, attendance, lifecycle and reports across RML/RGH/others. New entities appear automatically. | No per-entity reassignment needed. | RQ-RBAC-003 | Partial |
| HH2 | Approvals: loan step 2, confirmation step 2, resignation step 2, letter signature step 2, requisition step 2, offer approval | Notified for every configured step (the "Chaitanya never notified" defect must not recur). | RQ-WF-007, RQ-SEP-002, RQ-LC-008, RQ-LN-003 | Partial |
| HH3 | Co-sign payroll approve/finalize after payroll_admin computes | Finalize impossible without the co-sign. | RQ-RBAC-011 | Partial |
| HH4 | Configure workflows (steps, SLA, escalation, recipients), settings and leave policies | Configuration only, with audit. | RQ-WF-001/003/007 | Partial |
| HH5 | Review the access-control matrix and export it | Matches docs/08. | RQ-RBAC-008 | Partial |
| HH6 | Audit log review and chain verification | Old/new values present. | RQ-RBAC-010 | Partial |
| HH7 | Approve post-lock attendance changes and payroll reopen (with reason) | Audit recorded. | RQ-ATT-026, RQ-PAY-017 | Done/Partial |
| HH8 | CEO / HR / BU dashboards: full view including drill-down | Values reconcile. | RQ-RPT-002..004, RQ-RPT-101..117 | Partial |
| HH9 | Maintain org masters and entity statutory identifiers | Audited. | RQ-CORE-022/023 | Partial/Missing |
| HH10 | Statutory rate/slab changes with effective dates (jointly with payroll) | No retroactive effect on finalized months. | RQ-STAT-013, RQ-PAY-017 | Partial |

**Negative tests:**
- Cannot approve own request.
- Cannot finalize payroll alone without the payroll_admin compute step (separation of duties).

## 7. payroll_admin (entity-scoped)

Navigation: Payroll (runs, structures, revisions, parallel run, loans, claims payouts, statutory, outputs), Reports (payroll).

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| P1 | Maintain components and structures (formula DAG). Preview the G1 sample (BASIC 32,286 … gross 64,573). | Preview equals the register values. | RQ-PAY-001 | Partial |
| P2 | Assign and revise salaries (CTC → breakup, CTC = sum). Effective dates. Arrears. | History kept. Arrears computed. | RQ-PAY-002/012, RQ-CORE-017 | Partial |
| P3 | Probation % salary and auto-switch on confirmation | No manual restructuring. | RQ-PAY-004 | Partial |
| P4 | Create a run (requires the attendance lock), upload variable inputs (**Excel**), lock inputs, compute, review, submit | Inputs validated: e-code/name match, active only, no duplicates, value ranges. | RQ-PAY-005/007/008, RQ-CORE-018/019 | Partial/Missing |
| P5 | Register parity: import the client register, compare, explain every variance. RML033625 must net 59,124. | 0 mismatches on the June cohort. | RQ-PAY-006/018 | Partial |
| P6 | Proration modes, mid-month joiner/leaver, LOP and LOP reversal, holds | Per policy. Leaver never paid twice. | RQ-PAY-009/010/011/013 | Partial |
| P7 | Statutory: PF (ACTUAL basic), ESIC (≤ 21k gate), PT (WB slabs), LWF (Jun/Dec), TDS new regime | Golden values per docs/10 and register. | RQ-STAT-001..005 | Partial |
| P8 | Configure statutory rates, PT slabs, GL accounts (versioned) | Audit recorded. No retroactive change. | RQ-STAT-013, RQ-OUT-005 | Partial |
| P9 | Outputs: payslips (regular/OT/reimbursement, RML format), bank file, SAP JV, register, variance, statutory files (ECR, ESIC, PTRC, Form D) | Totals reconcile to the register. | RQ-OUT-001..006, RQ-STAT-009..011 | Partial |
| P10 | Form 24Q, Form 16, TDS challan reconciliation | Files generated. Employees can download Form 16. | RQ-STAT-007/008 | Missing |
| P11 | Verify investment declarations and proofs | TDS projection updates. | RQ-STAT-006 | Missing (no ESS) |
| P12 | Loans: approve as final step, legacy SAP import (**Excel**), EMI posting, perquisite | Active only after the full chain. | RQ-LN-002..006 | Partial |
| P13 | Entity-transfer split payroll. Apprentices/trainees. Off-cycle run. | Per SOW. | RQ-PAY-014/015/016 | Partial/Partial/Missing |
| P14 | F&F compute, statement, pay. Two cycles. TAT tracking. | Correct rupees (no ×100). | RQ-SEP-005/006 | Partial/Missing |
| P15 | Annual bonus true-up and increment batch (**Excel**) | Prorated. | RQ-PAY-020/021 | Partial |
| P16 | Mark run paid. Release holds in a later run. | Bank file excludes held salaries. | RQ-PAY-013, RQ-OUT-004 | Partial |
| P17 | Claims payout routing and reimbursement batch (deferred) | Separate bank file and payslip. | RQ-CLM-003 | Partial |

**Negative tests:**
- Cannot finalize without the hr_head co-sign.
- Cannot see or act on another entity's run.
- Cannot edit the employee master (except salary).
- No attendance override.

## 8. plant_head (plant / business head; entity- or plant-scoped)

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| PH1 | Receive the daily boarding & exit email for own plant | Joins and exits of the previous day, per plant. | RQ-LC-006 | Partial |
| PH2 | BU dashboard and attendance reports for own plant | Read-only. | RQ-RPT-004/006, RQ-RBAC-013 | Partial/Done |
| PH3 | Approve offers/LOIs for own plant (RML1 Plant Head, RML6 GM) as step 1 of the offer chain | Only offers for own plant. | RQ-ATS-002, RQ-WF-011 | Missing |
| PH4 | View the muster and absentee pivot for own plant | Mapped cost centre is shown. | RQ-ATT-029/031 | Partial |

**Negative tests:**
- No access to other plants.
- No attendance edits.
- No individual salaries unless granted.

## 9. ceo_cell (GROUP-level, read and aggregates)

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| C1 | CEO dashboard with all 17 KPIs per workforce split, plus new-hire attrition at 3/6/12 months, and trends | Values reconcile with source reports. Group-wide. | RQ-RPT-002, RQ-RPT-101..117 | Partial |
| C2 | Receive the daily boarding & exit email (group) | Per plant sections. | RQ-LC-006 | Partial |
| C3 | Final approval in the offer/LOI chain (CEO step), and CEO review on separations where configured | Only at their step. | RQ-ATS-002, RQ-SEP-002 | Missing/Partial |
| C4 | Group-wide headcount, attrition and leaver lists (aggregate) | No salary column. | RQ-RPT-007 | Done |

**Negative tests:**
- Must NOT see individual salaries, payslips, bank details (QA B-13).
- Must NOT approve or finalize payroll. The code currently allows a ceo_cell co-sign (RQ-RBAC-011).
- No master edits.

## 10. it_admin (entity- or group-scoped per assignment)

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| I1 | User admin: activate/deactivate, unlock, reset password, assign roles (within delegation rules) | Audited. | RQ-NFR-003, RQ-RBAC-001 | Partial/Done |
| I2 | Device health: offline alerts, sync status, watermarks | Red device raises an alert. | RQ-NFR-010, RQ-ATT-004 | Partial |
| I3 | Kent sync trigger (fails closed without an adapter) | No fabricated punches. | RQ-ATT-001 | Partial |
| I4 | Onboarding IT tasks: e-code activation, email, biometric enrolment verification | Task completion needs evidence. | RQ-LC-004/005 | Partial |
| I5 | Exit clearance IT items (laptop/email) | Clears the item. | RQ-SEP-004 | Partial |
| I6 | Settings (non-payroll) and SMTP configuration | Delivery state visible. | RQ-WF-006 | Partial |
| I7 | Backups and restore drill evidence | Recorded. | RQ-NFR-009 | Missing |

**Negative tests:** no compensation, payslips or bank data. No payroll pages (RQ-RBAC-007).

## 11. super_admin (GROUP level, break-glass)

| # | Task | Acceptance | RQ | Status |
|---|---|---|---|---|
| SA1 | Full configuration: roles/permissions grid, workflows, settings, org masters, entities | Every action audited and flagged break-glass. | RQ-RBAC-001/008, RQ-CORE-022 | Partial |
| SA2 | Group-wide access to all modules for support | Works for every entity. | RQ-RBAC-003 | Partial |
| SA3 | Audit verification and export | Chain intact. | RQ-RBAC-010 | Partial |

**Negative tests and notes:**
- Not for daily use (docs/08). The super_admin user has no employee record, so ESS pages must degrade gracefully (QA: 13 broken pages for admin@).
- Cannot approve requests where they are the subject.
