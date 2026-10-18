/** ATT-09/15, PAY-04: payroll reads the locked day facts, never detected OT. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { formatDbDate } from '../../../core/dates.js';
import { unpaidWeight, type DayFact } from './payable-days.js';

/**
 * Locked, complete and resolved day facts for [from, until). Throws when any day
 * is missing, unlocked, or still unresolved (leave without type, undecided WO).
 */
export async function readLockedDayFacts(
  db: Kysely<Database>,
  employeeId: number,
  from: string,
  until: string, // exclusive
): Promise<DayFact[]> {
  if (from >= until) return [];
  const rows = await db
    .selectFrom('att.day_records as d')
    .leftJoin('lv.leave_types as lt', 'lt.id', 'd.leave_type_id')
    .leftJoin('att.shifts as s', 's.id', 'd.shift_id')
    .where('d.employee_id', '=', employeeId)
    .where('d.work_date', '>=', sql<Date>`${from}::date`)
    .where('d.work_date', '<', sql<Date>`${until}::date`)
    .select([
      'd.work_date', 'd.status', 'd.is_locked', 'd.weekoff_paid', 'd.leave_type_id', 'lt.is_paid',
      sql<boolean>`(coalesce(d.session_statuses::jsonb @> '[{"status":"P"}]'::jsonb, false)
        OR coalesce(d.session_statuses::jsonb @> '[{"status":"OD"}]'::jsonb, false)
        OR (s.id IS NOT NULL AND d.worked_minutes >= s.min_half_day_hours * 60 AND d.worked_minutes > 0))`.as('other_half_worked'),
    ])
    .orderBy('d.work_date')
    .execute();
  const expected = Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  if (rows.length !== expected) {
    throw new Error(`Employee #${String(employeeId)} has incomplete attendance for ${from} to ${until}.`);
  }
  const unresolved = rows.some((r) => (r.status === 'L' && r.is_paid === null) || (r.status === 'WO' && r.weekoff_paid === null));
  if (rows.some((r) => !r.is_locked) || unresolved) {
    throw new Error(`Employee #${String(employeeId)} has unlocked or unresolved payroll attendance.`);
  }
  return rows.map((r) => ({
    iso: formatDbDate(r.work_date),
    status: r.status,
    leavePaid: r.leave_type_id === null ? null : r.is_paid,
    weekoffPaid: r.weekoff_paid,
    otherHalfWorked: r.status === 'HD' && r.leave_type_id !== null && r.other_half_worked,
  }));
}

/** Paid day-equivalents in [from, until) (F&F final-month days). A genuine all-absent span is zero. */
export async function readLockedPayableDays(
  db: Kysely<Database>,
  employeeId: number,
  from: string,
  until: string,
): Promise<number> {
  const facts = await readLockedDayFacts(db, employeeId, from, until);
  if (facts.length === 0) throw new Error(`Employee #${String(employeeId)} has incomplete attendance for ${from} to ${until}.`);
  return facts.reduce((s, f) => s + (1 - unpaidWeight(f)), 0);
}
