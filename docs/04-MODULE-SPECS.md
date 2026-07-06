# 04 — Module Specifications (exact behavior)

This document defines *how* each module behaves — precise enough to implement without further interpretation. Requirement IDs from 01-REQUIREMENTS-PRD; tables from 03-DATABASE-SCHEMA.

---

## 1. Attendance processing (M2)

### 1.1 Day-status algorithm (ATT-03/05)

Runs per (employee, date) whenever: new swipes arrive for that date, a regularization/leave/OD is approved, the roster changes, or a recompute is requested. Skips if `day_records.is_locked`.

```
resolve_shift(emp, date):
  roster row for (emp,date) → its shift / week-off flag
  else employee's default shift pattern
  night shifts (crosses_midnight): a swipe belongs to the date whose shift window [start−4h, end+8h] contains it

compute(emp, date):
  1. If holiday (emp.location)                → status H   (unless swipes show work → comp-off/OT candidate)
  2. If roster week-off                       → status WO  (swipes present → week-off work → OT/comp-off candidate, §1.4)
  3. Collect swipes in shift window.
     first_in = earliest IN (or earliest swipe if direction unknown)
     last_out = latest OUT (or latest swipe)
     worked_minutes = (last_out − first_in) − shift.break_minutes   -- single-span policy; multi-span optional later
  4. Approved leave covering the date         → status L (leave_type recorded); half-day leave + presence → HD logic
  5. Approved OD covering the date            → status OD (counts as present for pay & leave accrual)
  6. No swipes, no leave/OD                   → status A; and if no approved absence exists → UAB (feeds §1.5)
  7. Swipes present:
     worked ≥ shift.min_full_day_hours        → P
     ≥ min_half_day_hours                     → HD
     < min_half_day_hours                     → A (with swipes recorded — visible to manager for AR)
  8. late_minutes  = max(0, first_in − (shift.start + grace_in))
     early_exit    = max(0, (shift.end − grace_out) − last_out)
     ot_minutes    = max(0, last_out − shift.end) if ≥ policy threshold (e.g. 30 min), rounded per policy (e.g. 30-min blocks)
  9. Upsert att.day_records (source='auto' unless a regularization applied).
```

Unmatched swipes (`employee_id IS NULL`) land in an HR exception queue — never silently dropped (the PP-9 lesson).

Cross-plant swipes (ATT-16): any door counts toward attendance — an employee mapped to cost center 1701 who punches at DIP-6 is still Present. The door's location is recorded on the day (first/last door in drill-down); a weekly reconciliation flag lists employees whose majority swipe location ≠ their mapped location, for HR to correct mappings — the *mapping* gets fixed, never the attendance.

Manual override (ATT-17): `day_records.source='manual'` writes require the `attendance.manual_override` permission (HR ops+, never managers), a mandatory reason, and an audit row. Managers influence attendance only by approving employee-initiated requests.

### 1.2 Week-off eligibility (ATT-09 — PI-PAY-1/2, exactly as RML stated)

At each week close (per employee, Mon–Sun or roster week):
- Count days with status in (P, HD, L-paid, OD, CO, H) in that week.
- If **zero** such days (entire week absent/UAB) → each WO day in that week gets `weekoff_paid=false` → adds to `lop_days` at payroll.
- Month rule: employee absent the entire month → **all** week-offs unpaid.
- Config flag `weekoff_min_worked_days` (default 1) implements "must work at least one day in that week" (RT).

### 1.3 Regularization (AR) & On-Duty (OD) (ATT-06/07)

- **AR:** past dates only, within `ar_window_days` (default 7) of the date; reason mandatory; approval chain `ar` (RM → HR optional). On approval → day recomputed with `requested_status`, `source='regularized'`.
- **OD:** past **or future** dates (KQ fix); optional partial-day times; approval chain `od`. Future OD pre-marks the day so the absentee scanner ignores it.
- Caps: `max_ar_per_month` configurable; breaches flagged to HR rather than hard-blocked (policy decision surfaced, not hidden).
- Both fully Excel-exportable with filters (PP-16): the export is the same query as the list view.

### 1.4 Overtime (ATT-08 — the 48-hour rule)

1. Detection: `ot_minutes` from §1.1, or full worked time on WO/H days.
2. Daily 18:00 job: create/refresh `overtime_entries` (status `pending`, `deadline_at = detection_email_time + 48h`) and email each manager one summary of their team's pending OT.
3. Manager approves (full/partial minutes), rejects, or converts to comp-off (WO/H work only — Agreement 5.1.6: "either comp off or OT, one").
4. `deadline_at` passes → status `lapsed` (not valid OT — Protiviti Status doc rule), listed on HR exception report.
5. Approved OT: `payroll_item_id` set at run time; rate = per policy (`ot_rate_multiplier`, default 2× of Basic-per-hour for workers under Factories Act; configurable per category).
6. Integrity: DB CHECK ensures OT is never both paid and comp-off credited.

### 1.5 Absenteeism engine (ATT-10/11)

Daily 06:00 scan of yesterday's records:
- UAB day → alert to employee + RM (+ configurable hierarchy + HR per `wf.event_subscriptions`).
- Consecutive UAB ≥ 4 → open `absence_cases` (stage `watch`).
- ≥ 7 (config `show_cause_days`) → stage `show_cause`: HR queue item; HR issues show-cause letter from template (CORE-09) — sent "through official HR email" (PP-9 instruction); letter linked on case.
- Case closes on return (`returned`), retro-approval (`regularized`), or separation (`exited` → absconder F&F path, salary `hold_process` per SOW-5.7.2).

### 1.6 Month lock (ATT-15)

Pre-lock checklist (all must pass, shown as a checklist UI): pending AR/OD/OT older than X days = 0 or explicitly carried; unmatched-swipe queue empty; managers' attendance approval complete (ATT-12). Locking writes `att.month_locks`, freezes `day_records` (trigger), and enables payroll run creation.

## 2. Leave (M3)

- **Accrual job (LV-02):** 1st of month 00:05. For each active employee × leave type with `accrual_per_month > 0` and service ≥ `accrual_requires_service_months`: insert ledger `accrual`. Never blocked by unapproved attendance (the greytHR failure); instead, employees with unapproved prior-month attendance are listed on an HR exception tile.
- **Application (LV-03):** balance check = `SUM(ledger.delta)` minus pending applications; sandwich rule per type; approval chain `leave`; approval inserts ledger debit; cancellation before start reverses it.
- **Comp-off (LV-04):** earn via OT conversion (§1.4) with `expiry_date = earn + comp_off_validity_days` (default 90); expiry job lapses unused credits; applying comp-off = normal application against CO balance.
- **Encashment (LV-06):** F&F encashes EL balance at `(Basic [+DA]) / 30 × days` (policy-configurable base); annual encashment window optional.
- **Year-end job:** carry-forward up to `max_carry_forward`, lapse the rest — every movement a ledger row.

## 3. Payroll engine (M4) — calculation order

**Preconditions:** attendance month locked; all runs keyed to it. Pipeline states per `pay.payroll_runs.status`.

```
For each active-or-exiting employee of company × month:

A. Effective salary  = pay.employee_salaries row where effective_from ≤ month-end, latest.
                       (probation phase rows come from PAY-02 automation)
B. Days:
   days_in_month     = policy base (calendar days | fixed 30) per SOW-5.4
   payable_days      = P + HD×0.5 + paid-WO + H + paid-L + OD + CO   (from locked day_records)
   lop_days          = days_in_month − payable_days  (incl. unpaid week-offs §1.2, LWP, UAB)
C. Earnings          = per component: amount × (payable_days / days_in_month) if prorate_on_lop
   + OT pay          = approved OT hours × hourly rate (Basic/26/8 default) × multiplier
   + arrears rows scheduled for this run
   + monthly inputs (pay.inputs)
D. Gross             = Σ earnings (part_of_gross flags govern ESIC base)
E. Statutory deductions in this order:
   1. PF   (§6.1) — on PF wages (BASIC[+DA]), ceiling per statutory_rates
   2. ESIC (§6.2) — if esic_applicable for the contribution period
   3. PT   (§6.3) — WB slab on gross
   4. LWF  (§6.4) — periodicity per state
   5. TDS  (§6.5) — projected annual tax / remaining months
F. Other deductions: loan EMIs (pay.loans active), salary advance recovery, other inputs
G. Net = Gross − ΣDeductions.  Negative net → item flagged 'review' (never auto-clamped silently)
H. Persist payroll_items + payroll_item_lines with calc_note per line (explainability)
```

**Draft → review:** variance report vs previous month auto-generated (Δ > threshold highlighted with reason drill-down). **Finalize:** immutable; renders payslips (PDF, RML fixed template — PAY-06), bank batch (excluding `hold_payment`), JV per GL mapping, statutory registers. **Reopen** requires permission + reason; all downstream artifacts regenerate and are re-versioned.

### 6.1 PF (PAY-09)

> **Statutory rates, RML policy flags, and golden tests:** see **10-INDIA-PAYROLL-STATUTORY-REFERENCE.md §2**.

- EE 12% of PF wages. ER 12% split: EPS = 8.33% of min(PF wages, ₹15,000); EPF = remainder. EDLI 0.5% (ceiling), admin 0.5%. All rates/ceilings from `statutory_rates` (effective-dated).
- Rounding: each contribution to nearest rupee. Output: ECR text file per EPFO spec + PF register (ecode, UAN, name, PF wages, EE/EPS/EPF amounts, NCP days = LOP).

### 6.2 ESIC (PAY-10)
- Applicability tested at contribution-period start (Apr–Sep / Oct–Mar): gross ≤ ₹21,000 (`statutory_rates`). Once in, stays in for the full period even if gross rises (statutory rule).
- EE 0.75%, ER 3.25% of gross paid; round up to next rupee. Output: ESIC return excel (IP number, days, wages, contributions).

### 6.3 PT (West Bengal) & 6.4 LWF
- PT: monthly slab lookup `pt_slabs (state='WB')` on gross; register per company. Other states via same table.
- LWF: WB rates + periodicity (semi-annual) from `statutory_rates`; register export.

### 6.5 TDS (PAY-13)
Monthly projection (Frappe HR model):
```
annual_taxable = YTD actual taxable earnings + projected remaining months
               − exemptions (regime-dependent: HRA §10(13A) min-of-three, standard deduction)
               − chapter VI-A verified/declared deductions (old regime; declared until proof window closes, verified after)
tax = slab(annual_taxable, regime) → apply 87A rebate (with marginal relief) → surcharge (with marginal relief) → +4% cess
monthly_tds = (tax − TDS already deducted YTD) / remaining months
```
Regime election per employee per FY (default new). Mid-year joiners: previous-employer income via declaration (Form 12B fields) added to projection. Outputs: monthly TDS register, quarterly 24Q data, annual Form 16 (Part B generated; Part A from TRACES).

### 6.6 Payslip (PAY-06)
One fixed template. Header: company + logo, month; employee block: ecode, name, designation, department, cost center, DOJ, bank a/c (masked), **PAN, UAN, PF no, ESIC no** (PP-3/4); attendance block: payable days, LOP, OT hours; earnings/deductions in `display_order`; net in words; leave balance footer. Rendered to PDF at finalize, stored in `core.documents`, visible in ESS. Template changes require a versioned config change — never ad-hoc (the May/June/July inconsistency complaint).

### 6.7 F&F (PAY-15)
Trigger: separation approved + clearances complete (or absconder path). Compute = regular month logic for final partial month, plus: EL encashment (§2), notice recovery `(Basic/30 × shortfall days)`, gratuity (service ≥ 4y240d): `(Basic+DA) × 15/26 × completed years` (≥6-month fraction rounds up; cap per Gratuity Act from `statutory_rates`), held salary release, other dues (asset damage from clearances). TDS finalized with proofs on file. TAT clock (3 working days) from clearance completion; letters (relieving, experience) unlock at status `paid` (PP-14: through the system, gated properly).

### 6.8 Parallel run (transition)
For 1–2 months: import Protiviti final register (Excel) → comparison report per employee per component (Δ table). Cut-over gate: 100% of differences explained (rounding class allowed) and signed off by HR Head + Finance.

### 6.9 Testing rule (non-negotiable)
Every statutory formula ships with golden-file tests: fixture employees (probation 70/80/90, mid-month join/leave, ESIC boundary ₹20,999/21,001, PF ceiling crossers, OT-heavy worker, new/old regime, F&F with gratuity). Tests assert to-the-rupee outputs. Rate changes = new `statutory_rates` rows + new goldens. 80% coverage floor per user's global testing rule; payroll services target 100% branch coverage.

## 4. Lifecycle (M5)

- **Onboarding (LC-01/02):** ATS joined candidate → `onboarding_candidates` (nightly sync). HR clicks Convert on/before DOJ → employee created (e-code generated, salary row created from LOI CTC + probation %, tasks fanned out to IT/Admin/HR with due dates and escalation at +2 days). Pre-join link: tokenized form on personal email; send + completion tracked; resend + WhatsApp-able link fallback (greytHR delivery failure fix).
- **Daily boarding/exit email (LC-03):** 07:00 job; per plant: yesterday's joins (name, ecode, designation, dept, RM, cost center) and exits (… + reason, DOL); recipients from `wf.event_subscriptions('daily.boarding_report')`; sent even when empty ("no changes") so silence ≠ failure.
- **Probation (LC-04):** reminders to RM at due−30/−14/−7; review form → confirmation chain (RM → HR Head); outcomes: confirm (sets `confirmation_date`, creates confirmed-phase salary row — PAY-02 — and confirmation letter), extend (new due date), or separate.
- **Transfers (LC-05):** request → chain → on approval, `employee_history` rows + master update effective-dated; entity transfer additionally: old-entity F&F-lite or continuity per policy (SOW-5.3 deliverables), new e-code per target entity series.
- **Separation (LC-06):** resignation in ESS → chain from `wf.definitions('resignation')` (RM → HR Head → HR admin); **every step gets notified_at recorded**; approved → LWD fixed, clearances fan out; employee sees a status timeline. HR-initiated path for absconding (from absence case) skips employee consent, follows disciplinary chain.
- **Exit day (LC-07):** status `exited`, DOL set (CHECK-enforced), user kept active in alumni mode (payslips/Form 16 only), removed from all active lists/rosters/approvals (open items reassigned), asset auto-check into clearances.

## 5. Workflow engine (M6)

- Chains resolved at request creation: `reporting_manager` / `functional_manager` / role / named user per step; missing approver (vacant manager) → auto-skip-to-next with audit note, never a dead end.
- SLA per step; hourly escalation job: breach → action per definition (`escalate` re-notifies + adds escalatee; `auto_reject`; `lapse` for OT).
- Delegation window applies at resolution time; `delegated_from` preserved.
- Every notification writes `notified_at` — the system can *prove* who was told what when (PP-14 test case: "Chaitanya Sir has not received a single notification" must be impossible to repeat silently).
- Approver UX: one "Approvals" inbox across all types, batch approve where policy allows, ≤ 2 clicks per decision (adoption rule from DESIGN_RESEARCH §4.2).

## 6. Assets (M8), Helpdesk (M9), Engagement (M10)

Behaviors are direct implementations of AR-1..5, SOW-8/9/7 as specified in the PRD; notable rules:
- Asset search across asset_no/serial/holder incl. third-party names (AR-1/3).
- Exit clearance auto-lists holder's open assignments; `not_returned` marks feed the dashboard tile (AR-4/5).
- Helpdesk auto-assignment by category routing table; escalation matrix mirrors WF SLA machinery; monthly performance report = tickets by category/assignee/SLA-hit.
- Policy acknowledgment: publishing a policy fans out ESS acknowledgment tasks; weekly nag; HR tile shows % acknowledged with drill-down (CORE-13).

## 7. Claims & Reimbursements (M12)

- **Submission (CLM-02):** ESS form shows live entitlement balance = entitlement(grade, type, period) − approved/paid claims in the bucket; over-entitlement submits blocked with clear message (or flagged-to-HR mode per settings).
- **Chain (CLM-03, seeded in 08-ROLES §4):** RM approves business validity → HR ops verifies bills (per-bill `verified` flags; partial approval sets `approved_amount`) → lands in payroll pay-batch queue.
- **Payout (CLM-04):** payroll_admin includes approved claims in the next regular run (as the mapped `payout_component_code` line, taxability per type) **or** creates an off-cycle reimbursement batch (own bank file + reimbursement payslip per SOW-6). DB CHECK: a claim is paid by exactly one of run/batch.
- **Travel-advance settlement (CLM-07):** claim with `advance_loan_id` first offsets the advance outstanding; excess is paid; shortfall auto-creates a payroll recovery posting.
- **Year-end (CLM-05):** job computes unclaimed/unsubstantiated entitlement per employee per taxable type → adds taxable component in the final FY run (SOW-6 TDS rule); balances lapse or carry per type config.

## 8. Configuration philosophy

Every policy number referenced above lives in a `core.settings` key-value store (typed, audited): grace minutes, OT threshold/rounding/multiplier/deadline hours, week-off eligibility, AR window/caps, comp-off validity, show-cause day count, notice periods by grade, proration base, payslip template version. **Nothing policy-like is hardcoded** (user's global rule: no hardcoded values). Defaults ship per this spec; HR can tune without deploys.
