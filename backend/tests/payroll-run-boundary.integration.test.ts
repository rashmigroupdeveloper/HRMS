/** PAY-02/04, ATT-15: real salary storage → locked days → persisted run results. */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import type { Database, SalaryComponentItem } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';
import { insertSalaryRevision } from '../src/modules/payroll-core/salaries/assignment.repository.js';
import { addDaysIso } from '../src/core/dates.js';

const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback synthetic payroll boundary fixture');
describe.skipIf(!url)('Actual payroll run input boundaries', () => {
  let db: Kysely<Database>;
  beforeAll(() => {
    db = createDatabase(url ?? '');
  });
  afterAll(async () => {
    await db.destroy();
  });

  async function fixture(joinDay: number, attendance: 'P' | 'A', expectedGross: string) {
    try {
      await db.transaction().execute(async (trx) => {
        const stamp = `RUN${String(Date.now())}`;
        const company = await trx
          .insertInto('core.companies')
          .values({
            code: stamp,
            name: 'Synthetic payroll boundary',
            ecode_prefix: 'RUN',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const employee = await trx
          .insertInto('core.employees')
          .values({
            company_id: company.id,
            ecode: stamp,
            first_name: 'Synthetic payroll employee',
            status: 'active',
            doj: `2025-07-${String(joinDay).padStart(2, '0')}`,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const actor = await trx
          .insertInto('core.users')
          .values({
            email: `${stamp}@hrms.invalid`,
            password_hash: '!disabled-test-fixture!',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const structure = await trx
          .insertInto('pay.salary_structures')
          .values({
            company_id: company.id,
            name: stamp,
            components: sql<
              SalaryComponentItem[]
            >`${JSON.stringify([{ component_code: 'BASIC' }])}::jsonb`,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await insertSalaryRevision(trx, {
          employee_id: employee.id,
          structure_id: structure.id,
          effective_from: `2025-07-${String(joinDay).padStart(2, '0')}`,
          annual_ctc: '120000.00',
          phase: 'confirmed',
          component_amounts: { BASIC: 1000000 },
          revision_reason: 'joining',
          approved_by: actor.id,
        });
        for (let day = joinDay; day <= 31; day++) {
          await trx
            .insertInto('att.day_records')
            .values({
              employee_id: employee.id,
              work_date: addDaysIso('2025-07-01', day - 1),
              status: attendance,
              is_locked: true,
            })
            .execute();
        }
        const lock = await trx
          .insertInto('att.month_locks')
          .values({
            company_id: company.id,
            month: '2025-07-01',
            locked_by: actor.id,
            locked_at: new Date(),
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        const service = new PayrollRunService(trx);
        const runId = await service.createRun({
          companyId: company.id,
          month: '2025-07-01',
          actorUserId: actor.id,
          attendanceLockId: lock.id,
        });
        await service.lockInputs(runId, actor.id);
        const result = await service.computeRun(runId, actor.id);
        expect(result.employeeCount).toBe(1);
        const item = await trx
          .selectFrom('pay.payroll_items')
          .select(['gross', 'payable_days'])
          .where('run_id', '=', runId)
          .executeTakeFirstOrThrow();
        expect(item.gross).toBe(expectedGross);
        expect(item.payable_days).toBe(attendance === 'A' ? '0.0' : `${String(32 - joinDay)}.0`);
        expect(
          await trx
            .selectFrom('core.audit_log')
            .select('id')
            .where('entity', '=', 'pay.payroll_runs')
            .where('entity_id', '=', runId)
            .where('action', '=', 'payroll_run_computed')
            .executeTakeFirst(),
        ).toBeDefined();
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }
  it('preserves a stored ₹10,000 salary instead of producing ₹10 lakh', async () => {
    await fixture(1, 'P', '10000.00');
  });
  it('includes a 15 July joiner: ₹10,000 × 17/31 = ₹5,483.87, rupee-rounded to ₹5,484 (P-21)', async () => {
    await fixture(15, 'P', '5484.00');
  });
  it('persists zero gross for a completely absent month', async () => {
    await fixture(1, 'A', '0.00');
  });
});
