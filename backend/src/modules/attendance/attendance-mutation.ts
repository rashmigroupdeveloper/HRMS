/** ATT-04/15/17, CORE-10/11: shared scope/transaction boundaries for HR writes. */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { assertEmployeesInScope, type EmployeeScope } from '../../core/rbac/employee-scope.js';

export class AttendanceMutationError extends Error {
  constructor(readonly code: 'BAD_REQUEST' | 'CONFLICT' | 'NOT_FOUND' | 'FORBIDDEN', message: string) { super(message); }
}
export function attendanceTransaction<T>(db: Kysely<Database>, run: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
  return db.isTransaction ? run(db) : db.transaction().execute(run);
}
export async function lockAttendanceEmployee(db: Kysely<Database>, employeeId: number, scope?: EmployeeScope) {
  const employee = await db.selectFrom('core.employees').select(['id', 'company_id', 'reporting_manager_id'])
    .where('id', '=', employeeId).forUpdate().executeTakeFirst();
  if (scope) {
    try { await assertEmployeesInScope(db, scope, [employeeId]); }
    catch { throw new AttendanceMutationError('FORBIDDEN', 'Employee outside your permitted data scope'); }
  }
  if (!employee) throw new AttendanceMutationError('NOT_FOUND', 'Employee not found');
  return employee;
}
export async function assertAttendanceMonthOpen(db: Kysely<Database>, companyId: number, date: string) {
  const month = `${date.slice(0, 7)}-01`;
  // Coordinate with lockMonth before inspecting/writing even an absent day row.
  await sql`SELECT pg_advisory_xact_lock(${companyId}, hashtext(${month}))`.execute(db);
  const locked = await db.selectFrom('att.month_locks').select('id').where('company_id', '=', companyId)
    .where('month', '=', sql<Date>`${month}::date`).executeTakeFirst();
  if (locked) throw new AttendanceMutationError('CONFLICT', 'Attendance month is locked; use the approved reconciliation process');
}
