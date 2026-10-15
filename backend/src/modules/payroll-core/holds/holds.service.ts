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
  async getActiveHold(employeeId: number, monthDate: string): Promise<{
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
        ])
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
  async placeHold(input: CreateHoldInput): Promise<number> {
    const inserted = await this.db
      .insertInto('pay.salary_holds')
      .values({
        employee_id: input.employeeId,
        hold_type: input.holdType,
        reason: input.reason,
        start_month: input.startMonth as unknown as Date,
        released_month: null,
        created_by: input.createdByUserId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return inserted.id;
  }

  /**
   * Release a previously placed salary hold.
   */
  async releaseHold(input: ReleaseHoldInput): Promise<void> {
    await this.db
      .updateTable('pay.salary_holds')
      .set({
        released_month: input.releasedMonth as unknown as Date,
      })
      .where('id', '=', input.holdId)
      .execute();
  }

  /**
   * List holds for an employee or all active holds.
   */
  async listHolds(employeeId?: number) {
    let query = this.db.selectFrom('pay.salary_holds').selectAll();
    if (employeeId) {
      query = query.where('employee_id', '=', employeeId);
    }
    return query.orderBy('created_at', 'desc').execute();
  }
}
