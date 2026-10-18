/** ATT-15/17 / LV-03: approval and month close share the same lock boundary. */
import { sql, type Kysely } from 'kysely';
import type { Database } from './types.js';
import { loadCycleStartDay, periodMonthsOfSpan } from './attendance-cycle.js';

/** Call inside the workflow's final transaction, before any ledger/day effect.
 * A protected conflict is an explicit failed decision, never a false approval.
 */
export async function assertApprovalSpanWritable(
  db: Kysely<Database>, employeeId: number, fromDate: string, toDate: string,
): Promise<void> {
  if (!db.isTransaction) throw new Error('Attendance approval requires a transaction');
  const employee = await db.selectFrom('core.employees').select('company_id')
    .where('id', '=', employeeId).forUpdate().executeTakeFirstOrThrow();
  // C-17: months are payroll months of the configured attendance cycle.
  for (const month of periodMonthsOfSpan(fromDate, toDate, await loadCycleStartDay(db))) {
    // Identical key to lockMonth(); dates span months in ascending order.
    await sql`SELECT pg_advisory_xact_lock(${employee.company_id}, hashtext(${month}))`.execute(db);
    const locked = await db.selectFrom('att.month_locks').select('id')
      .where('company_id', '=', employee.company_id).where('month', '=', sql<Date>`${month}::date`)
      .executeTakeFirst();
    if (locked) throw new Error('Attendance month is locked — contact HR for a historical correction');
  }
  const protectedDay = await db.selectFrom('att.day_records').select(['work_date', 'source', 'is_locked'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '>=', sql<Date>`${fromDate}::date`).where('work_date', '<=', sql<Date>`${toDate}::date`)
    .where(eb => eb.or([eb('is_locked', '=', true), eb('source', '=', 'manual')]))
    .orderBy('work_date').forUpdate().executeTakeFirst();
  if (protectedDay) throw new Error('Attendance contains a locked day or HR override — contact HR before approval');
}

/** Statuses that count as presence for week-off eligibility (docs/04 §1.2; H keeps a holiday week paid). */
const WEEKOFF_PRESENT_STATUSES = ['P', 'HD', 'OD', 'CO', 'H'] as const;

/**
 * Week-off eligibility for one week (ATT-09): a WO is paid when the employee
 * was present (or on paid leave) on at least `minWorked` days that week.
 * Optionally for one employee — used when a leave decision lands after the
 * week was already closed, so its week-offs follow the new facts.
 */
export async function closeWeekOffs(
  db: Kysely<Database>, weekStartIso: string, minWorked: number, employeeId?: number,
): Promise<number> {
  const presentList = WEEKOFF_PRESENT_STATUSES.join(',');
  const result = await sql<{ id: number }>`
    UPDATE att.day_records d
    SET weekoff_paid = (w.present >= ${minWorked})
    FROM (
      SELECT dr.employee_id,
             COUNT(*) FILTER (
               WHERE dr.status = ANY (string_to_array(${presentList}, ',')::att.day_status[])
                  OR (dr.status = 'L' AND EXISTS (
                        SELECT 1 FROM lv.leave_types lt
                        WHERE lt.id = dr.leave_type_id AND lt.is_paid = true
                      ))
             ) AS present
      FROM att.day_records dr
      WHERE dr.work_date >= ${weekStartIso}::date AND dr.work_date < ${weekStartIso}::date + 7
        AND dr.is_locked = false
        AND (${employeeId ?? null}::bigint IS NULL OR dr.employee_id = ${employeeId ?? null}::bigint)
      GROUP BY dr.employee_id
    ) w
    WHERE d.employee_id = w.employee_id
      AND d.status = 'WO'
      AND d.work_date >= ${weekStartIso}::date AND d.work_date < ${weekStartIso}::date + 7
      AND d.is_locked = false
    RETURNING d.id
  `.execute(db);
  return result.rows.length;
}

/** Monday of the IST week containing an ISO date. */
export function weekStartOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
