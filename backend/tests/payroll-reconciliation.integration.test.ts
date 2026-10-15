/** PAY-03/04: independent SQL checks both line classifications and header arithmetic. */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { ReconciliationService } from '../src/modules/payroll-core/reconciliation/reconciliation.service.js';

const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback synthetic reconciliation fixture');

describe.skipIf(!url)('Payroll reconciliation on PostgreSQL', () => {
  let db: Kysely<Database>;
  beforeAll(() => {
    db = createDatabase(url ?? '');
  });
  afterAll(async () => {
    await db.destroy();
  });

  async function fixture(
    check: (trx: Transaction<Database>, runId: number, itemId: number) => Promise<void>,
  ) {
    try {
      await db.transaction().execute(async (trx) => {
        const employee = await trx
          .selectFrom('core.employees')
          .select(['id', 'company_id'])
          .orderBy('id')
          .executeTakeFirstOrThrow();
        const run = await trx
          .insertInto('pay.payroll_runs')
          .values({
            company_id: employee.company_id,
            month: '2097-01-01' as unknown as Date,
            run_type: 'regular',
            status: 'draft',
            attendance_lock_id: null,
            notes: 'Synthetic regression only',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        for (const [code, kind, partOfGross] of [
          ['RECON_TEST_EARNING', 'earning', true],
          ['RECON_TEST_RECOVERY', 'deduction', false],
          ['RECON_TEST_EMPLOYER', 'employer_contribution', false],
        ] as const) {
          await trx
            .insertInto('pay.salary_components')
            .values({
              code,
              name: code,
              kind,
              part_of_gross: partOfGross,
              display_order: 10,
            })
            .execute();
        }
        const item = await trx
          .insertInto('pay.payroll_items')
          .values({
            run_id: run.id,
            employee_id: employee.id,
            days_in_month: '31',
            payable_days: '31',
            gross: '10000.00',
            total_deductions: '3700.00',
            net_pay: '6300.00',
            payment_status: 'payable',
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        await trx
          .insertInto('pay.payroll_item_lines')
          .values([
            {
              item_id: item.id,
              component_code: 'RECON_TEST_EARNING',
              amount: '10000.00',
              calc_note: 'Synthetic earning',
            },
            {
              item_id: item.id,
              component_code: 'RECON_TEST_RECOVERY',
              amount: '3700.00',
              calc_note: 'Synthetic recovery',
            },
            {
              item_id: item.id,
              component_code: 'RECON_TEST_EMPLOYER',
              amount: '1200.00',
              calc_note: 'Employer only',
            },
          ])
          .execute();
        await check(trx, run.id, item.id);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  it('reconciles positive deduction lines separately and excludes employer contributions', async () => {
    await fixture(async (trx, runId) => {
      const report = await new ReconciliationService(trx).reconcileRun(runId);
      expect(report.discrepancyPaise).toBe(0);
      expect(report.lineMismatchCount).toBe(0);
      expect(report.isReconciled).toBe(true);
    });
  });

  it('rejects bad lines even when all item header equations balance', async () => {
    await fixture(async (trx, runId, itemId) => {
      await trx
        .updateTable('pay.payroll_item_lines')
        .set({ amount: '3600.00' })
        .where('item_id', '=', itemId)
        .where('component_code', '=', 'RECON_TEST_RECOVERY')
        .execute();
      const report = await new ReconciliationService(trx).reconcileRun(runId);
      expect(report.discrepancyPaise).toBe(0);
      expect(report.lineMismatchCount).toBe(1);
      expect(report.isReconciled).toBe(false);
    });
  });

  it('rejects an empty payroll population', async () => {
    await fixture(async (trx, runId) => {
      await trx.deleteFrom('pay.payroll_items').where('run_id', '=', runId).execute();
      expect((await new ReconciliationService(trx).reconcileRun(runId)).isReconciled).toBe(false);
    });
  });

  it('holds negative net items for review even when headers and lines agree', async () => {
    await fixture(async (trx, runId, itemId) => {
      await trx
        .updateTable('pay.payroll_items')
        .set({ total_deductions: '11000.00', net_pay: '-1000.00' })
        .where('id', '=', itemId)
        .execute();
      await trx
        .updateTable('pay.payroll_item_lines')
        .set({ amount: '11000.00' })
        .where('item_id', '=', itemId)
        .where('component_code', '=', 'RECON_TEST_RECOVERY')
        .execute();
      const report = await new ReconciliationService(trx).reconcileRun(runId);
      expect(report.negativeNetCount).toBe(1);
      expect(report.isReconciled).toBe(false);
    });
  });
});
