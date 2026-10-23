/**
 * Run-compute edge cases against real PostgreSQL (rolled back): employees the
 * run cannot pay are reported as exceptions instead of failing the run (P-xx
 * "negative net makes finalize 500"), F&F leavers are not paid twice (P-03),
 * ESIC coverage, variable inputs + arrears, holds, apprentices, and the
 * negative-net carry-forward ledger (P-14), plus the attendance-lock guard.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import type { Database, SalaryComponentItem } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';
import { insertSalaryRevision } from '../src/modules/payroll-core/salaries/assignment.repository.js';
import { addDaysIso } from '../src/core/dates.js';

const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback synthetic compute-edges fixture');

describe.skipIf(!url)('Payroll run compute edge cases', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });

  it('reports exceptions, skips F&F leavers, carries forward short recoveries', async () => {
    try {
      await db.transaction().execute(async (trx) => {
        const stamp = `CE${String(Date.now())}`;
        const company = await trx.insertInto('core.companies').values({ code: stamp, name: 'Synthetic edges', ecode_prefix: 'CE' }).returning('id').executeTakeFirstOrThrow();
        const u = await trx.insertInto('core.users').values({ email: `${stamp}@hrms.invalid`, password_hash: '!disabled!' }).returning('id').executeTakeFirstOrThrow();
        const structure = await trx.insertInto('pay.salary_structures').values({ company_id: company.id, name: stamp, components: sql<SalaryComponentItem[]>`${JSON.stringify([{ component_code: 'BASIC' }])}::jsonb` }).returning('id').executeTakeFirstOrThrow();
        const emp = async (code: string, extra: Record<string, unknown> = {}) => (await trx.insertInto('core.employees')
          .values({ company_id: company.id, ecode: `${stamp}${code}`, first_name: code, status: 'active', doj: '2020-01-01', ...extra } as never)
          .returning('id').executeTakeFirstOrThrow()).id;
        const salary = async (employeeId: number, amounts: Record<string, number>) => insertSalaryRevision(trx, { employee_id: employeeId, structure_id: structure.id, effective_from: '2020-01-01', annual_ctc: '1.00', phase: 'confirmed', component_amounts: amounts, revision_reason: 'joining', approved_by: u.id });
        const present = async (employeeId: number, days = 31) => {
          for (let d = 0; d < days; d++) await trx.insertInto('att.day_records').values({ employee_id: employeeId, work_date: addDaysIso('2025-07-01', d), status: 'P', is_locked: true }).execute();
        };

        const noSalary = await emp('A');
        const empty = await emp('B'); await salary(empty, {});
        const leaver = await emp('C', { status: 'exited', dol: '2025-07-15' }); await salary(leaver, { BASIC: 2000000 }); await present(leaver, 15);
        const esic = await emp('D', { esic_applicable: true }); await salary(esic, { BASIC: 1500000 }); await present(esic);
        const short = await emp('E'); await salary(short, { BASIC: 300000 }); await present(short);
        const held = await emp('F'); await salary(held, { BASIC: 2000000 }); await present(held);
        const oldRegime = await emp('H', { tax_regime: 'old' }); await salary(oldRegime, { BASIC: 15000000 }); await present(oldRegime);
        await trx.insertInto('pay.investment_declarations').values([
          { employee_id: oldRegime, fy: '2025-26', section: '80c', declared_amount: '200000.00' },          // capped at ₹1.5L
          { employee_id: oldRegime, fy: '2025-26', section: '24B', declared_amount: '100000.00', verified_amount: '80000.00' }, // uncapped, verified wins
        ]).execute();
        const apprentice = await emp('G', { contract_type: 'apprentice', pf_applicable: false }); await salary(apprentice, { STIPEND: 900000 }); await present(apprentice);

        const sep = await trx.insertInto('core.separations').values({ employee_id: leaver, initiated_by: 'employee', reason: 'Personal', resignation_date: '2025-06-15' as never, notice_period_days: 30, requested_lwd: '2025-07-15' as never } as never).returning('id').executeTakeFirstOrThrow();
        await trx.insertInto('pay.fnf_settlements').values({ employee_id: leaver, separation_id: sep.id, last_working_day: '2025-07-15' as never, days_payable: '15', status: 'computed' }).execute();
        const esicSalary = await trx.selectFrom('pay.employee_salaries').select('id').where('employee_id', '=', esic).executeTakeFirstOrThrow();
        await trx.insertInto('pay.arrears').values({ employee_id: esic, source_salary_id: esicSalary.id, for_month: '2025-06-01' as never, component_code: 'ARREARS', amount: '1000.00' }).execute();
        await trx.insertInto('pay.salary_holds').values({ employee_id: held, hold_type: 'process', reason: 'Absconding', start_month: '2025-07-01' as never, created_by: u.id }).execute();
        await trx.insertInto('pay.loans').values({ employee_id: short, loan_type: 'emi_no_interest', principal: '20000.00', interest_rate: '0', emi: '5000.00', start_month: '2025-06-01' as never, tenure_months: 4, outstanding: '20000.00', status: 'active' }).execute();

        const juneLock = await trx.insertInto('att.month_locks').values({ company_id: company.id, month: '2025-06-01', locked_by: u.id, locked_at: new Date() }).returning('id').executeTakeFirstOrThrow();
        const lock = await trx.insertInto('att.month_locks').values({ company_id: company.id, month: '2025-07-01', locked_by: u.id, locked_at: new Date() }).returning('id').executeTakeFirstOrThrow();
        const june = await trx.insertInto('pay.payroll_runs').values({ company_id: company.id, month: '2025-06-01' as never, status: 'finalized', attendance_lock_id: juneLock.id }).returning('id').executeTakeFirstOrThrow();
        await trx.insertInto('pay.recovery_carry_forwards').values({ employee_id: short, component_code: 'MISC_RECOVERY', amount: '700.00', from_run_id: june.id, note: 'June canteen' }).execute();

        const service = new PayrollRunService(trx);
        await expect(service.createRun({ companyId: company.id, month: '2025-07-15', actorUserId: u.id })).rejects.toThrow(/first day/);
        const runId = await service.createRun({ companyId: company.id, month: '2025-07-01', actorUserId: u.id });   // lock resolved automatically
        expect((await trx.selectFrom('pay.payroll_runs').select('attendance_lock_id').where('id', '=', runId).executeTakeFirstOrThrow()).attendance_lock_id).toBe(lock.id);
        await trx.insertInto('pay.inputs').values({ run_id: runId, employee_id: esic, component_code: 'INCENTIVE', amount: '500.00', note: 'Target bonus', entered_by: u.id }).execute();
        await service.lockInputs(runId, u.id);

        // A lock from another month is refused.
        await trx.updateTable('pay.payroll_runs').set({ attendance_lock_id: juneLock.id }).where('id', '=', runId).execute();
        await expect(service.computeRun(runId, u.id)).rejects.toThrow(/lock must belong/);
        await trx.updateTable('pay.payroll_runs').set({ attendance_lock_id: lock.id, status: 'inputs_locked' }).where('id', '=', runId).execute();

        const result = await service.computeRun(runId, u.id);
        const reasons = new Map(result.exceptions.map((e) => [e.employeeId, e.reason]));
        expect(reasons.get(noSalary)).toMatch(/exactly one effective salary/);
        expect(reasons.get(empty)).toMatch(/no components/);
        expect(reasons.get(leaver)).toMatch(/F&F settlement/);

        const items = await trx.selectFrom('pay.payroll_items').select(['id', 'employee_id', 'payment_status', 'net_pay', 'gross']).where('run_id', '=', runId).execute();
        expect(items.map((i) => i.employee_id).sort()).toEqual([esic, short, held, apprentice, oldRegime].sort());
        const linesOf = async (employeeId: number) => {
          const item = items.find((i) => i.employee_id === employeeId);
          return trx.selectFrom('pay.payroll_item_lines').select(['component_code', 'amount', 'carry_forward_id']).where('item_id', '=', item?.id ?? 0).execute();
        };
        // Old regime: 18L − 50k SD − 2.4k PT − 1.5L (80C cap) − 80k (verified 24B) = 15,17,600 → ₹2,78,491 / 12.
        const tds = (await linesOf(oldRegime)).find((l) => l.component_code === 'TDS');
        expect(Number(tds?.amount)).toBeCloseTo(278491.2 / 12, -1);
        const esicLines = await linesOf(esic);
        expect(esicLines.find((l) => l.component_code === 'ARREARS')?.amount).toBe('1000.00');
        expect(esicLines.find((l) => l.component_code === 'INCENTIVE')?.amount).toBe('500.00');
        expect(esicLines.some((l) => l.component_code === 'ESI_EE')).toBe(true);
        expect(items.find((i) => i.employee_id === held)?.payment_status).toBe('hold_process');
        const appLines = await linesOf(apprentice);
        expect(appLines.some((l) => ['PF_EE', 'ESI_EE', 'PT', 'TDS'].includes(l.component_code))).toBe(false);

        // ₹3,000 gross cannot cover the ₹700 carried recovery + ₹5,000 EMI: net never goes negative.
        expect(Number(items.find((i) => i.employee_id === short)?.net_pay)).toBeGreaterThanOrEqual(0);
        const consumed = await trx.selectFrom('pay.recovery_carry_forwards').select(['consumed_run_id', 'from_run_id', 'component_code']).where('employee_id', '=', short).execute();
        expect(consumed.find((c) => c.from_run_id === june.id)?.consumed_run_id).toBe(runId);
        const shortLines = await linesOf(short);
        expect(shortLines.some((l) => l.carry_forward_id !== null) || consumed.some((c) => c.from_run_id === runId)).toBe(true);

        // Back to draft to correct inputs (audited), then recompute releases what the first compute consumed.
        await service.returnToDraft(runId, u.id, 'Correct incentive amount');
        await expect(service.returnToDraft(runId, u.id, 'Twice is not allowed')).rejects.toThrow(/cannot go back/);
        await service.lockInputs(runId, u.id);
        const again = await service.computeRun(runId, u.id);
        expect(again.exceptions.length).toBe(result.exceptions.length);
        expect((await trx.selectFrom('pay.recovery_carry_forwards').select('id').where('from_run_id', '=', june.id).where('consumed_run_id', '=', runId).execute()).length).toBe(1);
        // E2E-021: a reopened run can go back to draft so its inputs can be corrected.
        await trx.updateTable('pay.payroll_runs').set({ status: 'reopened' }).where('id', '=', runId).execute();
        await service.returnToDraft(runId, u.id, 'Fix after reopen');
        expect((await trx.selectFrom('pay.payroll_runs').select('status').where('id', '=', runId).executeTakeFirstOrThrow()).status).toBe('draft');
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
