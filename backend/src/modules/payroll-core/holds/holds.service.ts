/**
 * Salary Holds Service (PAY-08, SOW crosswalk).
 *
 * Implements two distinct hold types:
 *   1. Payment Hold ('payment'): Normal calculation of gross, PF, ESIC, and TDS;
 *      net disbursement is withheld from the bank payout file.
 *   2. Process Hold ('process'): Employee is withheld from processing completely (e.g. absconding/disciplinary).
 */

import type { Database } from '../../../core/db/types.js';
import type { Kysely } from 'kysely';
import { inTransaction } from '../../../core/db/database.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { ConflictError, DomainError, NotFoundError } from '../../../core/errors/index.js';
import {
  assertEmployeesInScope,
  employeeScopeSql,
  type EmployeeScope,
} from '../../../core/rbac/employee-scope.js';
import type { SalaryHoldType } from '../../../core/db/types.js';

export interface CreateHoldInput {
  employeeId: number;
  holdType: SalaryHoldType;
  reason: string;
  startMonth: string; // YYYY-MM-01
  createdByUserId: number;
}

export interface ReleaseHoldInput {
  holdId: number;
  releasedMonth: string; // YYYY-MM-01
  actorUserId: number;
}

export class SalaryHoldsService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Check active salary hold status for an employee in a given month.
   */
  async getActiveHold(
    employeeId: number,
    monthDate: string,
  ): Promise<{
    hasHold: boolean;
    holdType?: SalaryHoldType;
    holdId?: number;
    reason?: string;
  }> {
    const hold = await this.db
      .selectFrom('pay.salary_holds')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .where('start_month', '<=', monthDate as unknown as Date)
      .where((eb) =>
        eb.or([
          eb('released_month', 'is', null),
          eb('released_month', '>', monthDate as unknown as Date),
        ]),
      )
      .executeTakeFirst();

    if (!hold) {
      return { hasHold: false };
    }

    return {
      hasHold: true,
      holdType: hold.hold_type,
      holdId: hold.id,
      reason: hold.reason,
    };
  }

  /**
   * Place an employee salary on hold.
   */
  async placeHold(input: CreateHoldInput, scope?: EmployeeScope): Promise<number> {
    return inTransaction(this.db, async (db) => {
      if (scope) await assertEmployeesInScope(db, scope, [input.employeeId]);
      const employee = await db
        .selectFrom('core.employees')
        .select(['id', 'company_id'])
        .where('id', '=', input.employeeId)
        .forUpdate()
        .executeTakeFirst();
      if (!employee) throw new NotFoundError('Employee not found');
      if (!input.reason.trim() || input.reason.trim().length < 3)
        throw new DomainError('A meaningful hold reason is required');
      await assertEditablePeriod(db, employee.company_id, input.startMonth);
      const overlap = await db
        .selectFrom('pay.salary_holds')
        .select('id')
        .where('employee_id', '=', input.employeeId)
        .where((eb) =>
          eb.or([
            eb('released_month', 'is', null),
            eb('released_month', '>', new Date(input.startMonth)),
          ]),
        )
        .executeTakeFirst();
      if (overlap)
        throw new ConflictError('This employee already has an overlapping hold; release it first');
      const row = await db
        .insertInto('pay.salary_holds')
        .values({
          employee_id: input.employeeId,
          hold_type: input.holdType,
          reason: input.reason.trim(),
          start_month: new Date(input.startMonth),
          released_month: null,
          created_by: input.createdByUserId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await writeAudit(db, {
        actorUserId: input.createdByUserId,
        subjectEmployeeId: input.employeeId,
        action: 'salary_hold_placed',
        entity: 'pay.salary_holds',
        entityId: row.id,
        newValue: JSON.stringify({
          holdType: input.holdType,
          startMonth: input.startMonth,
          reason: input.reason.trim(),
        }),
      });
      return row.id;
    });
  }

  async releaseHold(input: ReleaseHoldInput, scope?: EmployeeScope): Promise<void> {
    return inTransaction(this.db, async (db) => {
      const target = await db
        .selectFrom('pay.salary_holds')
        .select('employee_id')
        .where('id', '=', input.holdId)
        .executeTakeFirst();
      if (!target) throw new NotFoundError('Salary hold not found');
      if (scope) await assertEmployeesInScope(db, scope, [target.employee_id]);
      const employee = await db
        .selectFrom('core.employees')
        .select('company_id')
        .where('id', '=', target.employee_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const row = await db
        .selectFrom('pay.salary_holds')
        .selectAll()
        .where('id', '=', input.holdId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const start =
        row.start_month instanceof Date
          ? row.start_month.toISOString().slice(0, 10)
          : String(row.start_month).slice(0, 10);
      if (input.releasedMonth < start)
        throw new DomainError('Release month cannot precede the hold start');
      if (row.released_month !== null)
        throw new ConflictError('This hold has already been released');
      await assertEditablePeriod(db, employee.company_id, input.releasedMonth);
      await db
        .updateTable('pay.salary_holds')
        .set({ released_month: new Date(input.releasedMonth) })
        .where('id', '=', row.id)
        .execute();
      await writeAudit(db, {
        actorUserId: input.actorUserId,
        subjectEmployeeId: target.employee_id,
        action: 'salary_hold_released',
        entity: 'pay.salary_holds',
        entityId: row.id,
        oldValue: 'active',
        newValue: input.releasedMonth,
      });
    });
  }

  async listHolds(employeeId?: number, scope?: EmployeeScope) {
    if (employeeId !== undefined && scope)
      await assertEmployeesInScope(this.db, scope, [employeeId]);
    let query = this.db
      .selectFrom('pay.salary_holds as h')
      .innerJoin('core.employees as e', 'e.id', 'h.employee_id')
      .selectAll('h')
      .where(employeeScopeSql(scope, 'e'));
    if (employeeId !== undefined) query = query.where('h.employee_id', '=', employeeId);
    return query.orderBy('h.created_at', 'desc').execute();
  }
}

async function assertEditablePeriod(db: Kysely<Database>, companyId: number, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(month))
    throw new DomainError('Choose the first day of a valid month');
  // Lock even an inputs-locked run: a concurrent compute must finish before the
  // status check, or start after this input change has committed.
  const runs = await db
    .selectFrom('pay.payroll_runs')
    .select(['id', 'status'])
    .where('company_id', '=', companyId)
    .where('month', '>=', new Date(month))
    .orderBy('id')
    .forUpdate()
    .execute();
  if (runs.some((run) => !['draft', 'reopened', 'inputs_locked'].includes(run.status)))
    throw new ConflictError(
      'Affected payroll has already been computed or settled; return open runs to draft or use an authorized correction',
    );
}
