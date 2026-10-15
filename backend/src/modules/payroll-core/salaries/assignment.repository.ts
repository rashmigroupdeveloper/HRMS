/**
 * Employee Salary Assignment Repository (PAY-02, PAY-16, docs/03 §6).
 * Handles effective-dated queries and atomic temporal range management.
 */
import type { Kysely, Selectable, Transaction } from 'kysely';
import type { Database, EmployeeSalariesTable, SalaryPhase, SalaryRevisionReason } from '../../../core/db/types.js';

export type EmployeeSalaryRow = Selectable<EmployeeSalariesTable>;

export interface SalaryAssignmentParams {
  employee_id: number;
  structure_id: number;
  effective_from: string; // YYYY-MM-DD
  effective_to?: string | undefined; // YYYY-MM-DD, defaults to 9999-12-31
  annual_ctc: string; // numeric string e.g. "600000.00"
  phase: SalaryPhase;
  component_amounts: Record<string, number>;
  probation_percent?: string | null | undefined;
  revision_reason: SalaryRevisionReason;
  approved_by: number | null;
}

/**
 * Find active salary for an employee as of a specific date (defaults to today).
 */
export async function findEffectiveSalary(
  db: Kysely<Database> | Transaction<Database>,
  employeeId: number,
  asOfDate: string = new Date().toISOString().slice(0, 10),
): Promise<EmployeeSalaryRow | undefined> {
  const d = new Date(asOfDate);
  return db
    .selectFrom('pay.employee_salaries')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .where('effective_from', '<=', d)
    .where('effective_to', '>', d)
    .orderBy('effective_from', 'desc')
    .executeTakeFirst();
}

/**
 * List all historical revisions for an employee, newest first.
 */
export async function listSalaryHistory(
  db: Kysely<Database> | Transaction<Database>,
  employeeId: number,
): Promise<EmployeeSalaryRow[]> {
  return db
    .selectFrom('pay.employee_salaries')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .orderBy('effective_from', 'desc')
    .execute();
}

/**
 * Assign a new salary row atomically:
 * 1. Closes any open-ended previous revision at `effective_from`.
 * 2. Inserts new row with temporal bounds.
 */
export async function insertSalaryRevision(
  db: Kysely<Database> | Transaction<Database>,
  params: SalaryAssignmentParams,
): Promise<EmployeeSalaryRow> {
  const effFrom = new Date(params.effective_from);

  // Find current open-ended revision (effective_to = '9999-12-31' or > effective_from)
  const currentOpen = await db
    .selectFrom('pay.employee_salaries')
    .selectAll()
    .where('employee_id', '=', params.employee_id)
    .where('effective_from', '<', effFrom)
    .where('effective_to', '>', effFrom)
    .executeTakeFirst();

  if (currentOpen) {
    // Update effective_to of the previous revision to effective_from
    await db
      .updateTable('pay.employee_salaries')
      .set({ effective_to: effFrom })
      .where('id', '=', currentOpen.id)
      .execute();
  }

  const effectiveTo = params.effective_to ? new Date(params.effective_to) : new Date('9999-12-31');

  const [inserted] = await db
    .insertInto('pay.employee_salaries')
    .values({
      employee_id: params.employee_id,
      structure_id: params.structure_id,
      effective_from: effFrom,
      effective_to: effectiveTo,
      annual_ctc: params.annual_ctc,
      phase: params.phase,
      component_amounts: JSON.stringify(params.component_amounts) as unknown as Record<string, number>,
      probation_percent: params.probation_percent ?? null,
      revision_reason: params.revision_reason,
      approved_by: params.approved_by,
      approved_at: new Date(),
    })
    .returningAll()
    .execute();

  if (!inserted) {
    throw new Error('Failed to insert employee salary revision');
  }

  return inserted;
}
