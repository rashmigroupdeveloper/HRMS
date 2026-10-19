/** PAY-03/04: independent SQL checks both line classifications and header arithmetic. */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { ReconciliationService } from '../src/modules/payroll-core/reconciliation/reconciliation.service.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';

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
        const stamp = `RECON${String(Date.now())}`;
        const company = await trx.insertInto('core.companies')
          .values({ code: stamp, name: 'Synthetic reconciliation', ecode_prefix: stamp })
          .returning('id').executeTakeFirstOrThrow();
        const employee = await trx
          .insertInto('core.employees')
          .values({ company_id: company.id, ecode: stamp, first_name: 'Synthetic reconciliation', status: 'active', doj: '2090-01-01' })
          .returning(['id', 'company_id'])
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

  it('blocks finalization when an employed person is omitted despite balanced totals (PAY-03/07)', async () => {
    await fixture(async (trx, runId) => {
      const run = await trx.selectFrom('pay.payroll_runs').select('company_id').where('id', '=', runId).executeTakeFirstOrThrow();
      await trx.insertInto('core.employees').values({
        company_id: run.company_id, ecode: `MISSING${String(runId)}`, first_name: 'Synthetic omitted employee',
        status: 'active', doj: '2096-12-01',
      }).execute();
      const report = await new ReconciliationService(trx).reconcileRun(runId);
      expect(report.discrepancyPaise).toBe(0);
      expect(report.isReconciled).toBe(false);
      expect(report.anomalies).toContain('Payroll population mismatch: 1 expected employee(s) have no computed item.');
      await expect(new PayrollRunService(trx).finalizeRun(runId, 1)).rejects.toThrow('Payroll population mismatch');
      expect((await trx.selectFrom('pay.payroll_runs').select('status').where('id', '=', runId).executeTakeFirstOrThrow()).status).toBe('draft');
    });
  });

  it('detects an equal-count substitution with an employee outside the employing company (CORE-10, PAY-03)', async () => {
    await fixture(async (trx, runId, itemId) => {
      const foreignCompany = await trx.insertInto('core.companies').values({code:`OTHER${String(runId)}`,name:'Synthetic foreign company',ecode_prefix:'OTHER'}).returning('id').executeTakeFirstOrThrow();
      const foreign = await trx.insertInto('core.employees').values({company_id:foreignCompany.id,ecode:`OTHER${String(runId)}`,first_name:'Synthetic foreign employee',status:'active',doj:'2090-01-01'}).returning('id').executeTakeFirstOrThrow();
      await trx.updateTable('pay.payroll_items').set({ employee_id: foreign.id }).where('id', '=', itemId).execute();
      const report = await new ReconciliationService(trx).reconcileRun(runId);
      expect(report.employeeCount).toBe(1);
      expect(report.discrepancyPaise).toBe(0);
      expect(report.isReconciled).toBe(false);
      expect(report.anomalies).toContain('Payroll population mismatch: 1 expected employee(s) have no computed item.');
      expect(report.anomalies).toContain('Payroll population mismatch: 1 computed employee(s) are outside the expected population.');
    });
  });

  it('includes midmonth joiners and leavers and missing DOJ; ignores future joiners and earlier exits', async () => {
    await fixture(async (trx, runId) => {
      const run = await trx.selectFrom('pay.payroll_runs').select('company_id').where('id','=',runId).executeTakeFirstOrThrow();
      for (const [suffix, doj, dol, status] of [
        ['JOIN','2097-01-15',null,'active'], ['LEAVE','2090-01-01','2097-01-01','exited'],
        ['UNKNOWN',null,null,'active'], ['FUTURE','2097-02-01',null,'active'],
        ['EARLIER','2090-01-01','2096-12-31','exited'],
      ] as const) await trx.insertInto('core.employees').values({company_id:run.company_id,ecode:`${suffix}${String(runId)}`,first_name:'Synthetic population',doj,dol,status}).execute();
      const report = await new ReconciliationService(trx).reconcileRun(runId);
      expect(report.isReconciled).toBe(false);
      expect(report.anomalies).toContain('Payroll population mismatch: 3 expected employee(s) have no computed item.');
    });
  });

  it('requires a process-held employee to remain represented by a zero-valued item', async () => {
    await fixture(async (trx, runId, itemId) => {
      await trx.deleteFrom('pay.payroll_item_lines').where('item_id','=',itemId).execute();
      await trx.updateTable('pay.payroll_items').set({gross:'0',total_deductions:'0',net_pay:'0',payment_status:'hold_process'}).where('id','=',itemId).execute();
      expect((await new ReconciliationService(trx).reconcileRun(runId)).isReconciled).toBe(true);
      await trx.deleteFrom('pay.payroll_items').where('id','=',itemId).execute();
      expect((await new ReconciliationService(trx).reconcileRun(runId)).anomalies).toContain('Payroll population mismatch: 1 expected employee(s) have no computed item.');
    });
  });

  it('excludes only separate F&F settlements owning payable days in this final month', async () => {
    await fixture(async (trx, runId) => {
      const run = await trx.selectFrom('pay.payroll_runs').select('company_id').where('id','=',runId).executeTakeFirstOrThrow();
      const employee = await trx.insertInto('core.employees').values({company_id:run.company_id,ecode:`FNF${String(runId)}`,first_name:'Synthetic final settlement',status:'on_notice',doj:'2090-01-01',dol:'2097-01-15'}).returning('id').executeTakeFirstOrThrow();
      const separation = await trx.insertInto('core.separations').values({employee_id:employee.id,initiated_by:'hr',reason:'Synthetic settlement fixture',resignation_date:'2096-12-01',notice_period_days:0,requested_lwd:'2097-01-15',approved_lwd:'2097-01-15',status:'approved'}).returning('id').executeTakeFirstOrThrow();
      const settlement = await trx.insertInto('pay.fnf_settlements').values({employee_id:employee.id,separation_id:separation.id,last_working_day:'2097-01-15',days_payable:'15',status:'computed'}).returning('id').executeTakeFirstOrThrow();
      expect((await new ReconciliationService(trx).reconcileRun(runId)).isReconciled).toBe(true);
      await trx.updateTable('pay.fnf_settlements').set({run_id:runId}).where('id','=',settlement.id).execute();
      expect((await new ReconciliationService(trx).reconcileRun(runId)).isReconciled).toBe(false);
      await trx.updateTable('pay.fnf_settlements').set({run_id:null,days_payable:'0'}).where('id','=',settlement.id).execute();
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
