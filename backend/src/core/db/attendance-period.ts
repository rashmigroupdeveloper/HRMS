/** ATT-15/17 / LV-03: approval and month close share the same lock boundary. */
import { sql, type Kysely } from 'kysely';
import type { Database } from './types.js';

/** Call inside the workflow's final transaction, before any ledger/day effect.
 * A protected conflict is an explicit failed decision, never a false approval.
 */
export async function assertApprovalSpanWritable(
  db: Kysely<Database>, employeeId: number, fromDate: string, toDate: string,
): Promise<void> {
  if (!db.isTransaction) throw new Error('Attendance approval requires a transaction');
  const employee = await db.selectFrom('core.employees').select('company_id')
    .where('id', '=', employeeId).forUpdate().executeTakeFirstOrThrow();
  const lastMonth = `${toDate.slice(0, 7)}-01`;
  for (let month = `${fromDate.slice(0, 7)}-01`; month <= lastMonth;) {
    // Identical key to lockMonth(); dates span months in ascending order.
    await sql`SELECT pg_advisory_xact_lock(${employee.company_id}, hashtext(${month}))`.execute(db);
    const locked = await db.selectFrom('att.month_locks').select('id')
      .where('company_id', '=', employee.company_id).where('month', '=', sql<Date>`${month}::date`)
      .executeTakeFirst();
    if (locked) throw new Error('Attendance month is locked — contact HR for a historical correction');
    const next = new Date(`${month}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    month = next.toISOString().slice(0, 10);
  }
  const protectedDay = await db.selectFrom('att.day_records').select(['work_date', 'source', 'is_locked'])
    .where('employee_id', '=', employeeId)
    .where('work_date', '>=', sql<Date>`${fromDate}::date`).where('work_date', '<=', sql<Date>`${toDate}::date`)
    .where(eb => eb.or([eb('is_locked', '=', true), eb('source', '=', 'manual')]))
    .orderBy('work_date').forUpdate().executeTakeFirst();
  if (protectedDay) throw new Error('Attendance contains a locked day or HR override — contact HR before approval');
}
