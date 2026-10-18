/**
 * P-06/P-08/P-09/P-14/P-20 + 'paid' state: a real run computes approved OT
 * and loan EMIs from data, finalizes with ledger postings, archives payslips
 * after finalize without orphans, refuses 'paid' until a bank file exists, and
 * a reopen reverses the loan posting. Everything rolls back.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import type { Database, SalaryComponentItem } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';
import { insertSalaryRevision } from '../src/modules/payroll-core/salaries/assignment.repository.js';
import { PayslipGeneratorService } from '../src/modules/payroll-outputs/payslip/payslip-generator.js';
import { addDaysIso } from '../src/core/dates.js';

const url = process.env['DATABASE_URL'];
const rollback = new Error('rollback synthetic payroll lifecycle fixture');

describe.skipIf(!url)('Payroll run lifecycle with OT, loans, payslips and paid state', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });

  it('computes OT + EMI, posts on finalize, archives payslips, gates paid, reverses on reopen', async () => {
    try {
      await db.transaction().execute(async (trx) => {
        const stamp = `LC${String(Date.now())}`;
        const company = await trx.insertInto('core.companies').values({ code: stamp, name: 'Synthetic lifecycle', ecode_prefix: 'LC' }).returning('id').executeTakeFirstOrThrow();
        const employee = await trx.insertInto('core.employees').values({ company_id: company.id, ecode: stamp, first_name: 'Synthetic', status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow();
        const mk = async (suffix: string, role: string) => {
          const u = await trx.insertInto('core.users').values({ email: `${stamp}-${suffix}@hrms.invalid`, password_hash: '!disabled!' }).returning('id').executeTakeFirstOrThrow();
          const r = await trx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
          await trx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id }).execute();
          return u.id;
        };
        const maker = await mk('pay', 'payroll_admin');
        const checker = await mk('head', 'hr_head');
        const admin = await mk('admin', 'super_admin');
        const structure = await trx.insertInto('pay.salary_structures').values({ company_id: company.id, name: stamp, components: sql<SalaryComponentItem[]>`${JSON.stringify([{ component_code: 'BASIC' }])}::jsonb` }).returning('id').executeTakeFirstOrThrow();
        await insertSalaryRevision(trx, { employee_id: employee.id, structure_id: structure.id, effective_from: '2020-01-01', annual_ctc: '624000.00', phase: 'confirmed', component_amounts: { BASIC: 2600000, HRA: 2600000 }, revision_reason: 'joining', approved_by: maker });
        for (let day = 1; day <= 31; day++) {
          await trx.insertInto('att.day_records').values({ employee_id: employee.id, work_date: addDaysIso('2025-07-01', day - 1), status: 'P', is_locked: true }).execute();
        }
        await trx.insertInto('att.overtime_entries').values({ employee_id: employee.id, work_date: '2025-07-05' as never, detected_minutes: 180, claimed_minutes: 180, approved_minutes: 120, status: 'approved', deadline_at: new Date() }).execute();
        const loan = await trx.insertInto('pay.loans').values({ employee_id: employee.id, loan_type: 'emi_no_interest', principal: '12000.00', interest_rate: '0', emi: '5000.00', start_month: '2025-07-01' as never, tenure_months: 3, outstanding: '12000.00', status: 'active' }).returning('id').executeTakeFirstOrThrow();
        const lock = await trx.insertInto('att.month_locks').values({ company_id: company.id, month: '2025-07-01', locked_by: maker, locked_at: new Date() }).returning('id').executeTakeFirstOrThrow();

        const service = new PayrollRunService(trx);
        const runId = await service.createRun({ companyId: company.id, month: '2025-07-01', actorUserId: maker, attendanceLockId: lock.id });
        await expect(service.createRun({ companyId: company.id, month: '2025-07-01', actorUserId: maker })).rejects.toThrow(/already exists/);
        await service.lockInputs(runId, maker);
        const computed = await service.computeRun(runId, maker);
        expect(computed.exceptions).toEqual([]);
        const lines = await trx.selectFrom('pay.payroll_item_lines as l').innerJoin('pay.payroll_items as i', 'i.id', 'l.item_id')
          .select(['l.component_code', 'l.amount', 'l.loan_id']).where('i.run_id', '=', runId).execute();
        const amount = (code: string) => lines.find((l) => l.component_code === code)?.amount;
        expect(amount('OT')).toBe('500.00');                 // 26,000 / 208 × 2 × 2 h
        expect(amount('LOAN_EMI')).toBe('5000.00');
        expect(lines.find((l) => l.component_code === 'LOAN_EMI')?.loan_id).toBe(loan.id);
        expect(amount('PF_EE')).toBe('3120.00');             // 12% of actual 26,000
        expect(amount('EPS_ER')).toBe('1250.00');
        const ot = await trx.selectFrom('att.overtime_entries').select('payroll_item_id').where('employee_id', '=', employee.id).executeTakeFirstOrThrow();
        expect(ot.payroll_item_id).not.toBeNull();

        // Recompute is idempotent (OT released and re-consumed, one item).
        await trx.updateTable('pay.payroll_runs').set({ status: 'inputs_locked' }).where('id', '=', runId).execute();
        await service.computeRun(runId, maker);
        expect((await trx.selectFrom('pay.payroll_items').select('id').where('run_id', '=', runId).execute()).length).toBe(1);

        await expect(service.approveRun(runId, checker)).rejects.toThrow();   // review first
        await service.reviewRun(runId, maker);
        await expect(service.approveRun(runId, maker)).rejects.toThrow();     // maker ≠ checker
        await service.approveRun(runId, checker);
        await service.finalizeRun(runId, checker);
        const afterPost = await trx.selectFrom('pay.loans').select(['outstanding', 'status']).where('id', '=', loan.id).executeTakeFirstOrThrow();
        expect(afterPost).toEqual({ outstanding: '7000.00', status: 'active' });

        const slips = new PayslipGeneratorService(trx);
        expect(await slips.generateRunPayslips(runId, maker)).toEqual({ totalItems: 1, generatedCount: 1 });
        expect(await slips.generateRunPayslips(runId, maker)).toEqual({ totalItems: 0, generatedCount: 0 });  // idempotent

        await expect(service.markPaid(runId, checker, 'UTR-1')).rejects.toThrow(/bank file/);
        const doc = await trx.selectFrom('core.documents').select('id').orderBy('id', 'desc').executeTakeFirstOrThrow();
        await trx.insertInto('pay.bank_batches').values({ run_id: runId, file_document_id: doc.id, total_amount: '1.00', record_count: 1, generated_by: maker, created_at: sql<Date>`clock_timestamp()` }).execute();
        // Reopen (super_admin) reverses the posting; finalize again re-posts.
        await service.reopenRun(runId, 'Correction needed after review', admin);
        expect((await trx.selectFrom('pay.loans').select('outstanding').where('id', '=', loan.id).executeTakeFirstOrThrow()).outstanding).toBe('12000.00');
        await service.computeRun(runId, maker);
        await service.reviewRun(runId, maker);
        await service.approveRun(runId, checker);
        await service.finalizeRun(runId, checker);
        await expect(service.markPaid(runId, checker, 'UTR-1')).rejects.toThrow(/bank file/);   // the old file is stale
        await trx.insertInto('pay.bank_batches').values({ run_id: runId, file_document_id: doc.id, total_amount: '1.00', record_count: 1, generated_by: maker, created_at: sql<Date>`clock_timestamp()` }).execute();
        await service.markPaid(runId, checker, 'UTR-2');
        expect((await trx.selectFrom('pay.payroll_runs').select('status').where('id', '=', runId).executeTakeFirstOrThrow()).status).toBe('paid');
        await expect(service.reopenRun(runId, 'Too late to reopen this', admin)).rejects.toThrow();
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
