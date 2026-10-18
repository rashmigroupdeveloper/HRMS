/**
 * Day materialisation (owner bar #2: Kent feed → muster → payroll). A swipe dirties
 * its own day (DB trigger), but a day with NO swipe — an absence, a Sunday, a
 * holiday — was never queued, so a month fed only by Kent could never pass the
 * month-lock "attendance_complete" check. This queues every employment day in a
 * range that still has no day record (and is not in a locked period) so the normal
 * recompute decides it: WO/H from the calendar, A only once every door of the
 * employee's location is complete through shift end (otherwise it stays held).
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { addDaysIso, istDateString } from '../../core/dates.js';
import { getTypedSetting } from '../settings/index.js';

export interface MissingDaysRange {
  /** Inclusive start date (ISO). */
  from: string;
  /** Exclusive end date (ISO). */
  until: string;
  companyId?: number | undefined;
}

export async function queueMissingDays(db: Kysely<Database>, range: MissingDaysRange): Promise<number> {
  if (range.from >= range.until) return 0;
  const companyId = range.companyId ?? null;
  const result = await sql<{ employee_id: number }>`
    INSERT INTO att.recompute_queue (employee_id, work_date)
    SELECT e.id, g.d::date
    FROM core.employees e
    CROSS JOIN LATERAL generate_series(
      greatest(e.doj, ${range.from}::date),
      least(coalesce(e.dol, ${range.until}::date - 1), ${range.until}::date - 1),
      interval '1 day') AS g(d)
    WHERE e.status IN ('active', 'on_notice', 'exited') AND e.doj IS NOT NULL
      AND (${companyId}::bigint IS NULL OR e.company_id = ${companyId}::bigint)
      AND NOT EXISTS (SELECT 1 FROM att.day_records r WHERE r.employee_id = e.id AND r.work_date = g.d::date)
      AND NOT EXISTS (
        SELECT 1 FROM att.month_locks m
        WHERE m.company_id = e.company_id
          AND (CASE WHEN m.period_from IS NOT NULL THEN g.d >= m.period_from AND g.d < m.period_until
                    ELSE date_trunc('month', g.d)::date = m.month END))
    ON CONFLICT (employee_id, work_date) DO NOTHING
    RETURNING employee_id
  `.execute(db);
  return result.rows.length;
}

/** Scheduled sweep: the last `att.materialize_lookback_days` days up to yesterday (IST). */
export async function queueRecentMissingDays(db: Kysely<Database>, todayIso = istDateString()): Promise<number> {
  const lookback = await getTypedSetting(db, 'att.materialize_lookback_days', 'number', 45);
  if (!Number.isInteger(lookback) || lookback < 1 || lookback > 400) throw new Error('att.materialize_lookback_days must be an integer between 1 and 400');
  return queueMissingDays(db, { from: addDaysIso(todayIso, -lookback), until: todayIso });
}
