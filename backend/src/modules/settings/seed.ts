/**
 * Policy-settings seed — materialises every policy number the product reads
 * as an actual `core.settings` row.
 *
 * Why this exists: services read policy via `getTypedSetting(db, key, type,
 * fallback)`. The fallback keeps the code safe if a row is missing, but a key
 * that never gets a row is invisible to HR — it cannot be seen in the settings
 * console or changed without a deploy, which is exactly what CLAUDE.md §1.2
 * ("config over code — zero hardcoded policy values") forbids.
 *
 * Every value below is IDENTICAL to the in-code fallback, so seeding changes
 * no behaviour — it only makes the policy visible and editable.
 *
 * Idempotent: existing rows are never overwritten, so a re-seed can never undo
 * an HR change. Usage: npm run seed:settings
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from '../../core/config/env.js';
import { createDatabase } from '../../core/db/database.js';
import { logger } from '../../core/logger.js';

interface PolicySeed {
  key: string;
  value: number | string | boolean | readonly number[];
  valueType: 'number' | 'string' | 'boolean' | 'json';
  description: string;
}

/** Keys + defaults mirrored from the `getTypedSetting` call sites (docs/04 §8). */
export const POLICY_SETTINGS: readonly PolicySeed[] = [
  { key: 'doc.max_upload_bytes', value: 8_000_000, valueType: 'number', description: 'DOC-02: maximum PDF/image document upload size within the API body limit' },
  { key: 'doc.compensation_types', value: 'payslip', valueType: 'string', description: 'CORE-08: catalog document types requiring compensation field authority for non-owner downloads' },
  { key: 'doc.identity_types', value: 'pan,aadhaar,uan,esic,bank', valueType: 'string', description: 'CORE-08: document types whose contents need statutory identity field authority beyond vault scope' },
  { key: 'cmp.calendar_lookahead_days', value: 60, valueType: 'number', description: 'CMP-17: default forward calendar window in days; matches the existing service fallback' },
  { key: 'cmp.licence_alert_stages', value: '90,30,15,7', valueType: 'string', description: 'DOC-03/CMP-16: expiry alert thresholds in calendar days; recovered branch policy' },
  { key: 'prv.rights_sla_days', value: 15, valueType: 'number', description: 'PRV-04: statutory SLA in days for DPDP data principal rights requests' },
  { key: 'auth.sso_code_ttl_seconds', value: 120, valueType: 'number', description: 'NFR-03: one-use linked sign-in code lifetime; mirrors migration 1752340000100' },
  { key: 'integration.ats.assertion_max_seconds', value: 120, valueType: 'number', description: 'NFR-03: maximum signed ATS assertion lifetime; mirrors migration 1752340000000' },
  { key: 'integration.ats.service_user_id', value: 0, valueType: 'number', description: 'NFR-03: explicitly assigned active integration account; zero is unconfigured and refuses imports' },
  { key: 'integration.ats.company_ids', value: [], valueType: 'json', description: 'LC-01: authorized ATS target company IDs; empty is unconfigured and refuses imports' },
  { key: 'sec.stepup_window_minutes', value: 10, valueType: 'number', description: 'SEC-04: minutes of password verification before access changes, bounded by session expiry' },
  { key: 'lifecycle.prejoin_token_hours', value: 72, valueType: 'number', description: 'LC-01: prejoin link validity in hours; retains the previous implementation lifetime, subject to HR policy acceptance' },
  { key: 'probation.default_months', value: 6, valueType: 'number', description: 'LC-01: default probation period in months for newly onboarded employees' },
  { key: 'auth.failure_threshold', value: 5, valueType: 'number', description: 'NFR-03: consecutive failures before lockout' },
  { key: 'auth.lock_base_minutes', value: 15, valueType: 'number', description: 'NFR-03: initial lockout duration' },
  { key: 'auth.lock_max_minutes', value: 120, valueType: 'number', description: 'NFR-03: maximum lockout duration' },
  { key: 'auth.access_ttl_seconds', value: 900, valueType: 'number', description: 'NFR-03: access token lifetime, bounded by session expiry' },
  { key: 'auth.refresh_ttl_seconds', value: 604800, valueType: 'number', description: 'NFR-03: absolute session lifetime from login' },
  { key: 'auth.password_min_length', value: 10, valueType: 'number', description: 'NFR-03: minimum password length for set/change/reset' },
  { key: 'auth.password_history_depth', value: 5, valueType: 'number', description: 'NFR-03: recent passwords that cannot be reused' },
  { key: 'auth.reset_token_minutes', value: 30, valueType: 'number', description: 'NFR-03: password-reset link validity in minutes' },
  { key: 'wf.delegation_max_days', value: 90, valueType: 'number', description: 'WF-05: longest allowed approval delegation window' },
  { key: 'lifecycle.notice_days_white_collar', value: 90, valueType: 'number', description: 'LC-07: notice period (days) for white-collar staff' },
  { key: 'lifecycle.notice_days_default', value: 30, valueType: 'number', description: 'LC-07: notice period (days) for everyone else' },
  { key: 'pay.pf_wage_base', value: 'ACTUAL', valueType: 'string', description: 'P-01: default PF wage basis (ACTUAL or CEILING_15000); company and employee pf_wage_basis override it' },
  { key: 'pay.lwf_deduct_in_payroll', value: false, valueType: 'boolean', description: 'LWF deducted through monthly payroll (off: the client remits LWF outside the salary register)' },
  { key: 'pay.lop_divisor', value: 'CALENDAR', valueType: 'string', description: 'C-16 / item 4: LOP divisor — CALENDAR (days in month), FIXED_30, FIXED_26 (working days, WO/H excluded) or WORKING_DAYS (working days of the month)' },
  { key: 'att.cycle_start_day', value: 1, valueType: 'number', description: 'C-17 / item 4: attendance cycle start day (1 = calendar month; 26 = 26th to 25th, days after the cut-off paid as present and trued up next month). Change only between payroll months' },
  { key: 'att.sandwich_rule', value: false, valueType: 'boolean', description: 'Item 4: week-offs/holidays between two full-day unpaid absences become LOP (calendar-type divisors only)' },
  { key: 'att.materialize_lookback_days', value: 45, valueType: 'number', description: 'Owner bar #2: hourly sweep queues days with no swipe (absence/WO/holiday) for this many past days so a Kent-fed month can close' },
  { key: 'att.day_finalize_after_time', value: '04:00', valueType: 'string', description: 'ATT-03/18 sponsor 23 Oct 2026: earliest next-morning IST finalization time for automatic KENT days; later-ending shifts and incomplete devices remain pending' },
  { key: 'pay.negative_net_policy', value: 'carry_forward', valueType: 'string', description: 'P-14: carry_forward trims recoveries so net is never negative and recovers the rest next run; flag blocks finalize for review' },
  { key: 'loans.interest_rate_pct', value: 0, valueType: 'number', description: 'LN-02: policy annual interest % on interest-bearing staff loans (interest-free types always 0)' },
  { key: 'loans.max_emi_pct_of_gross', value: 30, valueType: 'number', description: 'LN-01: EMI cap as % of monthly gross for eligibility' },
  // ── Attendance: swipe ingestion + quarantine (ATT-01/02) ──────────────────
  {
    key: 'att.swipe_window_early_hours',
    value: 4,
    valueType: 'number',
    description: 'ATT-02: hours before shift start a swipe still belongs to that shift',
  },
  // ── Travel & Expense (TE-01..12, Live EMS Routing) ────────────────────────
  {
    key: 'te.admin_employee_id',
    value: '',
    valueType: 'string',
    description: 'TE-01/10: Ecode or numeric ID of the primary Travel/Org Admin approver (legacy RML000435); empty falls back to hr_head / super_admin',
  },
  {
    key: 'te.sea_manager_employee_id',
    value: '',
    valueType: 'string',
    description: 'TE-02: Ecode or numeric ID of the South-East Asia regional manager for international travel budgets/claims in SEA region',
  },
  {
    key: 'te.africa_reviewer_employee_id',
    value: '',
    valueType: 'string',
    description: 'TE-02: Ecode or numeric ID of the Africa regional reviewer for international travel budgets/claims in Africa region',
  },
  {
    key: 'te.closed_travel_month',
    value: '2026-06',
    valueType: 'string',
    description: 'TE-10: Closed travel month (YYYY-MM); travel dates on or before this month cannot be claimed as drafts',
  },
  {
    key: 'att.swipe_window_late_hours',
    value: 8,
    valueType: 'number',
    description: 'ATT-02: hours after shift end a swipe still belongs to that shift',
  },
  {
    key: 'att.quarantine_future_minutes',
    value: 10,
    valueType: 'number',
    description: 'ATT-01: a swipe stamped more than this far in the future is quarantined',
  },
  {
    key: 'att.quarantine_past_days',
    value: 45,
    valueType: 'number',
    description: 'ATT-01: a swipe older than this many days is quarantined for review',
  },
  {
    key: 'att.device_silent_minutes',
    value: 15,
    valueType: 'number',
    description: 'ATT-16: a reader with no swipe for this long is flagged silent (the PP-9 guard)',
  },

  // ── Attendance: day status (ATT-03/09) ────────────────────────────────────
  {
    key: 'att.default_shift_code',
    value: 'GEN',
    valueType: 'string',
    description: 'ATT-03: shift assumed when an employee has no scheme or roster entry',
  },
  {
    key: 'att.session_present_fraction',
    value: 0.5,
    valueType: 'number',
    description: 'ATT-03: fraction of a session that must be worked to count present',
  },
  {
    key: 'att.weekoff_min_worked_days',
    value: 1,
    valueType: 'number',
    description: 'ATT-09: days worked in the week required to earn a paid week-off',
  },

  // ── Attendance: requests + overtime (ATT-06/07/08) ────────────────────────
  {
    key: 'att.ar_max_past_days',
    value: 30,
    valueType: 'number',
    description: 'ATT-06: how far back an attendance regularisation may be raised',
  },
  {
    key: 'att.permission_max_hours',
    value: 2,
    valueType: 'number',
    description: 'ATT-07: maximum length of a single-day permission slice',
  },
  {
    key: 'att.ot_min_minutes',
    value: 30,
    valueType: 'number',
    description: 'ATT-08: minimum extra minutes before overtime is detected at all',
  },
  {
    key: 'att.ot_decision_hours',
    value: 48,
    valueType: 'number',
    description: 'ATT-08: the hard 48-hour overtime decision window — unapproved OT lapses',
  },

  // ── Attendance: absence escalation (ATT-14) ───────────────────────────────
  {
    key: 'att.absence_watch_days',
    value: 4,
    valueType: 'number',
    description: 'ATT-14: consecutive absent days that open a watch case',
  },
  {
    key: 'att.absence_show_cause_days',
    value: 7,
    valueType: 'number',
    description: 'ATT-14: consecutive absent days that escalate a case to show-cause',
  },
  {
    key: 'att.show_cause_response_days',
    value: 7,
    valueType: 'number',
    description: 'ATT-14: days an employee has to respond to a show-cause letter',
  },

  // ── Attendance: month lock (ATT-12/15) ────────────────────────────────────
  {
    key: 'att.month_lock_pending_max_age_days',
    value: 7,
    valueType: 'number',
    description: 'ATT-15: pending AR/OD/OT older than this block month lock unless carried',
  },
  {
    key: 'att.manager_approval_required_for_lock',
    value: true,
    valueType: 'boolean',
    description: 'ATT-12: managers must approve team attendance before month lock',
  },

  // ── Attendance: shift micro / scheduling (Stage 1.11 · SHF-01..08) ──────
  {
    key: 'att.weekly_hours_cap',
    value: 48,
    valueType: 'number',
    description: 'SHF-03 / CMP-06: weekly planned-hours cap at roster save (until Labour Codes sign-off)',
  },
  {
    key: 'att.quarterly_hours_cap',
    value: 624,
    valueType: 'number',
    description: 'SHF-03 / CMP-06: quarterly planned-hours cap at roster save (48h × 13 weeks)',
  },
  {
    key: 'att.roster_refuse_over_cap',
    value: true,
    valueType: 'boolean',
    description: 'SHF-03: refuse a roster save that would breach weekly/quarterly hours',
  },
  {
    key: 'att.min_rest_hours',
    value: 11,
    valueType: 'number',
    description: 'SHF-03 / FAT-01 lite: minimum rest hours between consecutive rostered shifts',
  },
  {
    key: 'att.coverage_min_headcount',
    value: 1,
    valueType: 'number',
    description: 'SHF-06: default sanctioned headcount per shift when no coverage target row exists',
  },
  {
    key: 'att.leave_coverage_hard_block',
    value: false,
    valueType: 'boolean',
    description: 'SHF-08: when true, leave that would create a coverage shortfall is refused (warning-only when false)',
  },

  // ── Reporting / CEO dashboard (RPT-03, docs/06 §4) ────────────────────────
  {
    key: 'reporting.leadership_rank_cutoff',
    value: 8,
    valueType: 'number',
    description: 'RPT-03: grade rank at or above which an employee counts as leadership',
  },
  {
    key: 'reporting.monthly_output_units',
    value: 0,
    valueType: 'number',
    description: 'RPT-03: production output for the month — manual entry until the ERP feed exists (0 = not supplied)',
  },

  // ── Leave (LV-04/06) ──────────────────────────────────────────────────────
  {
    key: 'lv.comp_off_half_day_minutes',
    value: 240,
    valueType: 'number',
    description: 'LV-06: minutes worked on a non-working day that earn a half-day comp-off',
  },
  {
    key: 'lv.comp_off_full_day_minutes',
    value: 480,
    valueType: 'number',
    description: 'LV-06: minutes worked on a non-working day that earn a full-day comp-off',
  },
  {
    key: 'lv.comp_off_validity_days',
    value: 90,
    valueType: 'number',
    description: 'LV-06: days a comp-off credit stays usable before it expires',
  },
  {
    key: 'lv.rh_max_per_year',
    value: 2,
    valueType: 'number',
    description: 'LV-04: restricted holidays an employee may take per calendar year',
  },
  { key: 'tax.declaration_open', value: '04-01', valueType: 'string', description: 'TDS: investment declaration / regime window opens (MM-DD within the FY)' },
  { key: 'tax.declaration_close', value: '01-15', valueType: 'string', description: 'TDS: investment declaration / regime window closes (MM-DD within the FY)' },
  { key: 'tax.proof_open', value: '01-01', valueType: 'string', description: 'TDS: investment proof submission window opens (MM-DD within the FY)' },
  { key: 'tax.proof_close', value: '02-28', valueType: 'string', description: 'TDS: investment proof submission window closes (MM-DD within the FY)' },
];

export async function seedPolicySettings(): Promise<{ total: number; inserted: number }> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);
  try {
    let inserted = 0;
    for (const policy of POLICY_SETTINGS) {
      const result = await db
        .insertInto('core.settings')
        .values({
          key: policy.key,
          value: JSON.stringify(policy.value),
          value_type: policy.valueType,
          description: policy.description,
        })
        // An HR change must survive a re-seed — never clobber an existing row.
        .onConflict((oc) => oc.column('key').doNothing())
        .executeTakeFirst();
      inserted += Number(result.numInsertedOrUpdatedRows ?? 0n);
    }
    return { total: POLICY_SETTINGS.length, inserted };
  } finally {
    await db.destroy();
  }
}

async function main(): Promise<void> {
  await import('dotenv/config');
  const { total, inserted } = await seedPolicySettings();
  logger.info({ total, inserted }, 'policy settings seeded (idempotent)');
}

// CORE-13 / NFR-04: importing definitions must never seed the database.
const entry = process.argv[1];
if (entry !== undefined && pathToFileURL(resolve(entry)).href === import.meta.url) {
  main().catch((err: unknown) => {
    logger.error(err, 'settings seed failed');
    process.exitCode = 1;
  });
}
