/** ATT-09/15, PAY-04: payroll reads the locked day facts, never detected OT. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../core/db/types.js';

export async function readLockedPayableDays(
  db: Kysely<Database>,
  employeeId: number,
  from: string,
  until: string, // exclusive employment/month boundary
): Promise<number> {
  const result = await db
    .selectFrom('att.day_records as d')
    .leftJoin('lv.leave_types as lt', 'lt.id', 'd.leave_type_id')
    .where('d.employee_id', '=', employeeId)
    .where('d.work_date', '>=', sql<Date>`${from}::date`)
    .where('d.work_date', '<', sql<Date>`${until}::date`)
    .select([
      sql<number>`count(*)::int`.as('day_count'),
      sql<number>`count(*) FILTER (WHERE NOT d.is_locked)::int`.as('unlocked_count'),
      sql<number>`count(*) FILTER (WHERE (d.status = 'L' AND lt.id IS NULL)
        OR (d.status = 'WO' AND d.weekoff_paid IS NULL))::int`.as('unresolved_count'),
      sql<number>`coalesce(sum(CASE
        WHEN d.status IN ('P', 'H', 'OD', 'CO') THEN 1
        WHEN d.status = 'HD' THEN 0.5
        WHEN d.status = 'WO' AND d.weekoff_paid THEN 1
        WHEN d.status = 'L' AND lt.is_paid THEN 1
        ELSE 0 END), 0)::float`.as('payable'),
      sql<number>`(${until}::date - ${from}::date)::int`.as('expected_days'),
    ])
    .executeTakeFirstOrThrow();
  if (result.expected_days <= 0 || result.day_count !== result.expected_days) {
    throw new Error(
      `Employee #${String(employeeId)} has incomplete attendance for ${from} to ${until}.`,
    );
  }
  if (result.unlocked_count !== 0 || result.unresolved_count !== 0) {
    throw new Error(
      `Employee #${String(employeeId)} has unlocked or unresolved payroll attendance.`,
    );
  }
  return result.payable; // A genuine all-absent month must retain zero.
}
