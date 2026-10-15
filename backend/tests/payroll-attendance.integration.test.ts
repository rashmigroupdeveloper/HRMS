/** ATT-09/15, PAY-04: exercise actual enum/date columns and half-day SUM. */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely, Transaction } from 'kysely';
import type { Database, DayStatus } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { readLockedPayableDays } from '../src/modules/payroll-core/runs/attendance.repository.js';
import { addDaysIso } from '../src/core/dates.js';

const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback synthetic attendance fixture');
describe.skipIf(!url)('Locked attendance-to-payroll contract', () => {
  let db: Kysely<Database>;
  beforeAll(() => {
    db = createDatabase(url ?? '');
  });
  afterAll(async () => {
    await db.destroy();
  });
  async function fixture(
    check: (
      trx: Transaction<Database>,
      employeeId: number,
      paidLeave: number,
      unpaidLeave: number,
    ) => Promise<void>,
  ) {
    try {
      await db.transaction().execute(async (trx) => {
        const employee = await trx
          .selectFrom('core.employees')
          .select('id')
          .orderBy('id')
          .executeTakeFirstOrThrow();
        const paid = await trx
          .insertInto('lv.leave_types')
          .values({ code: 'PAY_TEST_PAID', name: 'Synthetic paid leave', is_paid: true })
          .returning('id')
          .executeTakeFirstOrThrow();
        const unpaid = await trx
          .insertInto('lv.leave_types')
          .values({ code: 'PAY_TEST_UNPAID', name: 'Synthetic unpaid leave', is_paid: false })
          .returning('id')
          .executeTakeFirstOrThrow();
        await check(trx, employee.id, paid.id, unpaid.id);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  async function day(
    trx: Transaction<Database>,
    employeeId: number,
    offset: number,
    status: DayStatus,
    paid = false,
    leaveId: number | null = null,
    locked = true,
  ) {
    await trx
      .insertInto('att.day_records')
      .values({
        employee_id: employeeId,
        work_date: addDaysIso('2097-04-01', offset),
        status,
        is_locked: locked,
        weekoff_paid: status === 'WO' ? paid : null,
        leave_type_id: leaveId,
      })
      .execute();
  }
  it('counts P + HD + paid WO + paid L as 3.5 days and excludes unpaid WO/L and A', async () => {
    await fixture(async (trx, emp, paid, unpaid) => {
      await day(trx, emp, 0, 'P');
      await day(trx, emp, 1, 'HD');
      await day(trx, emp, 2, 'WO', true);
      await day(trx, emp, 3, 'WO', false);
      await day(trx, emp, 4, 'L', false, paid);
      await day(trx, emp, 5, 'L', false, unpaid);
      await day(trx, emp, 6, 'A');
      expect(await readLockedPayableDays(trx, emp, '2097-04-01', '2097-04-08')).toBe(3.5);
    });
  });
  it('retains zero for an entirely absent covered period', async () => {
    await fixture(async (trx, emp) => {
      await day(trx, emp, 0, 'A');
      expect(await readLockedPayableDays(trx, emp, '2097-04-01', '2097-04-02')).toBe(0);
    });
  });
  it('rejects missing attendance instead of paying a full month', async () => {
    await fixture(async (trx, emp) => {
      await expect(readLockedPayableDays(trx, emp, '2097-04-01', '2097-04-02')).rejects.toThrow(
        'incomplete attendance',
      );
    });
  });
  it('rejects unlocked day records', async () => {
    await fixture(async (trx, emp) => {
      await day(trx, emp, 0, 'P', false, null, false);
      await expect(readLockedPayableDays(trx, emp, '2097-04-01', '2097-04-02')).rejects.toThrow(
        'unlocked or unresolved',
      );
    });
  });
});
