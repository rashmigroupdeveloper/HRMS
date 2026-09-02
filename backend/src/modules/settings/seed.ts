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
