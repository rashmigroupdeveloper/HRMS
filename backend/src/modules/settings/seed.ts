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
import 'dotenv/config';
import { loadEnv } from '../../core/config/env.js';
import { createDatabase } from '../../core/db/database.js';
import { logger } from '../../core/logger.js';

interface PolicySeed {
  key: string;
  value: number | string | boolean;
  valueType: 'number' | 'string' | 'boolean';
  description: string;
}

/** Keys + defaults mirrored from the `getTypedSetting` call sites (docs/04 §8). */
export const POLICY_SETTINGS: readonly PolicySeed[] = [
  // ── Attendance: swipe ingestion + quarantine (ATT-01/02) ──────────────────
  {
    key: 'att.swipe_window_early_hours',
    value: 4,
    valueType: 'number',
    description: 'ATT-02: hours before shift start a swipe still belongs to that shift',
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
    value: false,
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
  // ── Security: identity hardening (Phase 5 Stage 5.2 · SEC-01..11) ─────────
  {
    key: 'sec.password_min_length',
    value: 10,
    valueType: 'number',
    description: 'SEC-01: minimum password length',
  },
  {
    key: 'sec.password_require_upper',
    value: true,
    valueType: 'boolean',
    description: 'SEC-01: a capital letter is required',
  },
  {
    key: 'sec.password_require_lower',
    value: true,
    valueType: 'boolean',
    description: 'SEC-01: a small letter is required',
  },
  {
    key: 'sec.password_require_digit',
    value: true,
    valueType: 'boolean',
    description: 'SEC-01: a number is required',
  },
  {
    key: 'sec.password_require_symbol',
    value: false,
    valueType: 'boolean',
    description: 'SEC-01: a symbol is required (off by default — length beats symbols)',
  },
  {
    key: 'sec.password_max_repeat_run',
    value: 3,
    valueType: 'number',
    description: 'SEC-01: longest run of one repeated character still allowed',
  },
  {
    key: 'sec.password_history_depth',
    value: 5,
    valueType: 'number',
    description: 'SEC-01: how many previous passwords are refused on reuse',
  },
  {
    key: 'sec.password_block_common',
    value: true,
    valueType: 'boolean',
    description: 'SEC-01: refuse guessable base words (password, welcome, qwerty…)',
  },
  {
    key: 'sec.session_idle_minutes',
    value: 720,
    valueType: 'number',
    description: 'SEC-05: no request for this long ends the session (0 disables idle timeout)',
  },
  {
    key: 'sec.session_absolute_hours',
    value: 168,
    valueType: 'number',
    description: 'SEC-05: hard session lifetime regardless of activity',
  },
  {
    key: 'sec.stepup_window_minutes',
    value: 10,
    valueType: 'number',
    description: 'SEC-04: how long a proven step-up keeps a session elevated',
  },
  {
    key: 'sec.mfa_enforcement',
    value: 'grace',
    valueType: 'string',
    description: 'SEC-03: off | grace | required — the product escalates, it does not ambush',
  },
  {
    key: 'sec.mfa_required_roles',
    value: 'payroll_admin,hr_head,super_admin,it_admin,dpo,compliance_officer',
    valueType: 'string',
    description: 'SEC-03: comma-separated roles that must hold a second factor',
  },
  {
    key: 'sec.mfa_grace_days',
    value: 14,
    valueType: 'number',
    description: 'SEC-03: days a required role may work before enrolment blocks',
  },
  // ── Compliance: registrations, licences, calendar (Stage 5.7 · CMP-16/17) ─
  {
    key: 'cmp.licence_alert_stages',
    value: '90,30,15,7',
    valueType: 'string',
    description:
      'CMP-16: days-before-expiry ladder for licence alerts, tightest stage wins',
  },
  {
    key: 'cmp.calendar_lookahead_days',
    value: 60,
    valueType: 'number',
    description: 'CMP-17: how far ahead the compliance calendar looks by default (overdue items always show)',
  },
  {
    key: 'prv.rights_sla_days',
    value: 15,
    valueType: 'number',
    description: 'PRV-04: statutory response clock for access/correction/erasure requests',
  },
  {
    key: 'wages.basic_da_min_pct',
    value: 50,
    valueType: 'number',
    description: 'CMP-01: Basic+DA must be at least this % of CTC (Labour Codes default until P0-T06 signs)',
  },
  {
    key: 'wages.excluded_components',
    value: '',
    valueType: 'string',
    description: 'CMP-01: comma-separated component codes excluded from the CTC denominator',
  },
  {
    key: 'fnf.tat_working_days',
    value: 3,
    valueType: 'number',
    description: 'CMP-03: F&F working-day TAT (doc 10 default 3 until payroll admin confirms the Code clock)',
  },
  {
    key: 'sec.password_reset_ttl_minutes',
    value: 30,
    valueType: 'number',
    description: 'ESS-01: password-reset token lifetime',
  },
  {
    key: 'sec.password_reset_rate_per_hour',
    value: 3,
    valueType: 'number',
    description: 'ESS-01: max reset emails per account per hour',
  },
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
  const { total, inserted } = await seedPolicySettings();
  logger.info({ total, inserted }, 'policy settings seeded (idempotent)');
}

main().catch((err: unknown) => {
  logger.error(err, 'settings seed failed');
  process.exitCode = 1;
});
