# 08 — Roles, Permissions & Per-Role Experience

The single reference for "who sees what and can do what." An implementing AI/developer should be able to build the RBAC seed data and every role's navigation shell from this document alone. Mechanism: `core.roles` / `core.permissions` / `core.role_permissions` (03-DATABASE §1); data scoping via `core.reporting_tree` and `user_roles.scope_org_unit_id`.

## 1. Role catalog

| Role code | Who it is (RML examples) | One-line charter |
|---|---|---|
| `employee` | Everyone with a login | Self-service: own data, own requests |
| `manager` | Anyone with direct reports (derived, not assigned — having rows in `reporting_tree` depth=1 activates it) | Approve + monitor own team |
| `senior_manager` | Managers of managers (reporting_tree depth ≥ 2 non-empty) — the "Kinjal Ma'am" case (KQ) | Everything `manager`, but over the **entire subtree** |
| `hr_ops` | Rachna, Sushanta, Sweta | Run HR daily operations across assigned entity |
| `hr_head` | Chaitanya Paila (DGM-HR) | Approvals of record (confirmations, resignations, offers), HR dashboards, policy control |
| `payroll_admin` | Subhasis Panda | Payroll runs, statutory outputs, salary data. The only role that sees unmasked bank/PAN/Aadhaar |
| `plant_head` | Plant/BU heads (Sapikul Ali's stakeholders) | Read: plant-scoped attendance/headcount; receives daily boarding/exit email |
| `ceo_cell` | Sandeep Sharma (AGM-HR CEO Cell), CEO, CHRO (George Wehbeh) | Executive dashboard, offer approvals at CEO stage |
| `it_admin` | ERP/IT team (Sharique) | Users, roles, devices, integrations, settings — **no HR data authority** (cannot see salaries) |
| `super_admin` | 1–2 named people only | Everything `it_admin` + role grants + settings + audit access + payroll unlock authority. Not for daily use |

Roles are **additive**: a person holds several (Chaitanya = employee + manager + hr_head). Scoping: `user_roles.scope_org_unit_id` restricts hr_ops/plant_head to their entity/plant.

## 2. Permission grid (seed data)

Legend: ✓ full · S = own subtree only · O = own records only · P = scoped to org-unit/plant · R = read-only

| Permission | employee | manager | senior_mgr | hr_ops | hr_head | payroll | plant_head | ceo_cell | it_admin | super_admin |
|---|---|---|---|---|---|---|---|---|---|---|
| employee.read (directory basics) | O | S | S | P | ✓ | ✓ | P(R) | ✓(R) | ✓(R) | ✓ |
| employee.write (master edits) | — | — | — | P | ✓ | — | — | — | — | ✓ |
| employee.compensation.read | O(payslip) | — | — | — | ✓ | ✓ | — | ✓(agg only) | — | ✓ |
| employee.statutory_ids.read (unmasked) | O | — | — | — | — | ✓ | — | — | — | ✓ |
| attendance.own (view/apply AR/OD/OT) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| attendance.team.read + roster.write | — | S | S | P | ✓ | ✓(R) | P(R) | ✓(R) | — | ✓ |
| attendance.manual_override | — | — | — | P | ✓ | — | — | — | — | ✓ |
| attendance.month_lock | — | — | — | — | ✓ | ✓ | — | — | — | ✓ |
| attendance.muster.export | — | S | S | P | ✓ | ✓ | P | ✓ | — | ✓ |
| leave.approve / ar.approve / od.approve / ot.approve | — | S | S | P(step 2) | ✓ | — | — | — | — | ✓ |
| claims.approve | — | S | S | P(verify) | ✓ | ✓(pay) | — | — | — | ✓ |
| leave.admin (types, balances, adjustments) | — | — | — | P | ✓ | — | — | — | — | ✓ |
| payroll.run.* (create/compute/review) | — | — | — | — | R | ✓ | — | — | — | ✓ |
| payroll.run.finalize / reopen | — | — | — | — | ✓(co-sign) | ✓ | — | — | — | ✓(reopen) |
| payroll.reports / statutory files | — | — | — | — | ✓ | ✓ | — | — | — | ✓ |
| salary.write (structures, revisions) | — | — | — | — | ✓(approve) | ✓ | — | — | — | ✓ |
| lifecycle.onboard.convert | — | — | — | P | ✓ | — | — | — | — | ✓ |
| lifecycle.confirmation.approve | — | S(step 1) | S | — | ✓ | — | — | — | — | ✓ |
| lifecycle.separation.approve | — | S(step 1) | S | P(admin) | ✓ | — | — | — | — | ✓ |
| letters.issue | — | — | — | P | ✓ | — | — | — | — | ✓ |
| assets.manage | — | — | — | P | ✓ | — | — | — | ✓ | ✓ |
| helpdesk.agent (assigned categories) | — | — | — | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| engagement.publish (announcements/polls/surveys) | — | — | — | P | ✓ | — | — | — | — | ✓ |
| reports.hr / reports.bu / reports.ceo | — | S | S | P | ✓ | ✓(pay) | P(bu) | ✓(ceo) | — | ✓ |
| admin.users / admin.roles | — | — | — | — | — | — | — | — | ✓ / grant≤own | ✓ |
| admin.settings (policy values §04-7) | — | — | — | — | ✓(HR policies) | ✓(payroll policies) | — | — | ✓(technical) | ✓ |
| admin.devices / integrations | — | — | — | — | — | — | — | — | ✓ | ✓ |
| audit.read | — | — | — | — | P | P(payroll) | — | — | ✓ | ✓ |

Hard rules: `it_admin` never holds compensation.read (separation of duties). `payroll.run.finalize` requires payroll_admin action **plus** hr_head co-sign (two-person rule). `super_admin` actions are all audit-logged and the role list is reviewed quarterly. **Managers never hold `attendance.manual_override`** — an explicit RML instruction after greytHR let managers mark absent employees "Present" (PP-v2-18); managers act on attendance only by approving employee-initiated requests.

## 3. Per-role navigation shell & dashboard (what each person sees at login)

### employee (ESS — everyone)
Nav: **Home · My Attendance · My Leave · My Pay · My Claims · Requests · Helpdesk · Directory (basic)**
Home (05-UIUX §4.9): greeting, today's shift + swipe status, leave tiles, payslip link, pending requests, announcements, policy-ack prompts. Mobile PWA: this shell + geo check-in when `attendance_mode='mobile'`.

### manager (adds to employee)
Nav adds: **My Team** (team month-grid, roster editor) · **Approvals** (badge inbox: leave/AR/OD/OT/claims, SLA countdown pills, batch approve) · **Team Reports** (muster export S-scope).
Manager home card row: team present/absent today · pending approvals count (gold accent) · OT awaiting decision with 48h countdown · roster deadline nag.

### senior_manager (manager-of-managers)
Same shell as manager with **subtree scope**: team views/reports default to "direct reports" with a toggle "entire team (N)". Approvals include escalations from below (WF-03). This is precisely the KQ requirement: attendance/OD/AR of everyone under managers reporting to them.

### hr_ops
Nav: **HR Dashboard · People (directory + profiles + onboarding board) · Attendance Ops (muster, exceptions, device health, month-lock checklist) · Leave Admin · Claims (verify queue) · Lifecycle (probation board, separations pipeline) · Letters · Assets · Engagement · Reports · Helpdesk (agent)**
Dashboard: 05-UIUX §4.1 (joiners/exits, absence cases, OT aging, probation due, policy-ack %, unmatched swipes).

### hr_head (adds to hr_ops)
Adds: approval-of-record queues (confirmations, separations step-final, offers per LOI chain), settings (HR policy values), full-company scope, audit view (P). Same HR dashboard, company-wide.

### payroll_admin
Nav: **Payroll Console (run stepper) · Inputs · Review Grid · Outputs (bank/JV/statutory) · Salary Structures · Loans & Advances · Claims (payment batch) · Declarations Verification · Statutory Calendar · Payroll Reports**
Dashboard: current run state, exceptions (negative net, missing salaries, ESIC boundary changes), statutory due dates (ECR/ESIC/PT/TDS), parallel-run status (transition).

### plant_head
Nav: **Plant Dashboard · Plant Muster (read/export) · Absence Cases (plant) · Reports (BU)** — all P-scoped. Receives the 07:00 daily boarding/exit email (LC-03). Dashboard = BU dashboard (06 §5): headcount, absenteeism trend, OT hours, joiners/exits, absence cases by stage.

### ceo_cell / CEO
Nav: **Executive Dashboard (05-UIUX §4.8) · Offer Approvals (CEO stage of LOI chain) · Reports (read)**. No operational screens. Large-monitor layout, read-only, aggregate compensation only (averages, not individual salaries — individual visibility requires hr_head/payroll role).

### it_admin
Nav: **Users & Roles · Device Health (Kent doors, last-seen, gaps) · Integrations (sync watermarks, job queue, dead letters) · Onboarding Tasks (IT queue: email/biometric/asset) · Technical Settings · Audit Log · Helpdesk (IT category)**. No salary/statutory visibility anywhere.

### super_admin
it_admin shell + role grants + all settings + payroll unlock + full audit. Used for setup and break-glass only.

## 4. Approval-chain defaults per request type (seed for `wf.definitions`)

The workflow **catalog** below is confirmed from RML's live greytHR manager Review page (09-RECON §10.2) — these are the exact request types RML runs today, grouped as they group them:

| Request | Chain (steps) | SLA/step | On breach |
|---|---|---|---|
| **Leave** | RM → (HR ops if > N days) | 48h | escalate to RM's manager |
| **Leave Cancel** (cancel an approved leave) | RM (re-approval; reverses ledger debit) | 48h | escalate |
| **Leave Encashment** (employee-initiated) | RM → HR ops → payroll | 72h | escalate |
| **Leave Comp Off** (apply comp-off) | RM | 48h | escalate |
| **Restricted Holiday** (pick floating holiday from list) | RM | 48h | auto-approve at cutoff (config) |
| **Regularization & Permission** (AR + short Permission) | RM | 48h | escalate |
| **OD** | RM → HR ops (optional per settings) | 48h | escalate |
| **Overtime** | RM only | **48h hard** | **lapse** (Protiviti Status rule) |
| **Claim (expense/reimbursement)** | RM → HR ops verify → payroll pay-batch | 72h | escalate |
| **Loan / advance** | RM → HR head → payroll (eligibility auto-checked) | 72h | escalate |
| Travel advance (domestic) | RM → dept head | 48h | escalate |
| Travel advance (global) | RM → dept head → **CHRO (George)** | 48h | escalate |
| **Confirmation** | RM review → HR head | 7d | escalate |
| **Resignation** | RM → HR head → HR ops (admin closure) — every step gets `notified_at` receipts | 72h | escalate to next + HR alert |
| Transfer | current RM → receiving RM → HR ops | 72h | escalate |
| **Letter Signature Approval** (letters route before issue) | HR ops → HR head (signatory) | 48h | escalate |
| **Helpdesk** (ticket routing/closure) | category assignee → escalation matrix | per SLA | escalate |
| Offer/LOI (Phase 4, from LOI flowchart) | Initiator → Plant Head/GM → HR Head → CEO → issue | 48h | reminder + escalate |

All chains editable by hr_head via UI (WF-01 configurability); these are the shipped defaults matching **current live RML practice** (09-RECON §10.2). Note: chains and the reporting tree may **span entities** — a manager (e.g. an RPL DGM) can approve for reports in another company (RDL) — so `core.reporting_tree` and chain resolution are company-agnostic.
