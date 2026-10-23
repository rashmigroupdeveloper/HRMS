/** PAY-03/04/08: only settled earlier runs may supply another month's recovery. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database, SalaryComponentItem } from '../src/core/db/types.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';
import { insertSalaryRevision } from '../src/modules/payroll-core/salaries/assignment.repository.js';
import { addDaysIso } from '../src/core/dates.js';
import { addRunInputs } from '../src/modules/payroll-core/config/config.service.js';

const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('Canteen recovery run provenance', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  it('ignores draft and future recoveries, consumes earlier finalized charges exactly once on recompute', async () => {
    const tx = await db.startTransaction().execute();
    try {
      const tag = `CF${randomUUID().slice(0,8)}`;
      const c = await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow();
      const u = await tx.insertInto('core.users').values({ email: `${tag}@hrms.invalid`, password_hash: '!disabled!' }).returning('id').executeTakeFirstOrThrow();
      const e = await tx.insertInto('core.employees').values({ company_id: c.id, ecode: tag, first_name: tag, status: 'active', doj: '2020-01-01', pf_applicable: false }).returning('id').executeTakeFirstOrThrow();
      const st = await tx.insertInto('pay.salary_structures').values({ company_id: c.id, name: tag, components: sql<SalaryComponentItem[]>`${JSON.stringify([{component_code:'BASIC'}])}::jsonb` }).returning('id').executeTakeFirstOrThrow();
      await insertSalaryRevision(tx, { employee_id: e.id, structure_id: st.id, effective_from: '2020-01-01', annual_ctc: '12000.00',
        phase: 'confirmed', component_amounts: { BASIC: 100000 }, revision_reason: 'joining', approved_by: u.id });
      await tx.insertInto('att.day_records').values(Array.from({length:31},(_,i)=>({employee_id:e.id,work_date:addDaysIso('2026-07-01',i),status:'P' as const,is_locked:true}))).execute();
      await tx.insertInto('att.month_locks').values({company_id:c.id,month:'2026-07-01',locked_by:u.id,locked_at:new Date()}).execute();
      const carries: number[] = [];
      let settledSource = 0;
      for (const source of [
        {month:'2026-06-01',status:'finalized' as const,amount:'200.00'},
        {month:'2026-05-01',status:'computed' as const,amount:'300.00'},
        {month:'2026-08-01',status:'finalized' as const,amount:'400.00'},
      ]) {
        const sourceLock = await tx.insertInto('att.month_locks').values({company_id:c.id,month:source.month,locked_by:u.id,locked_at:new Date()}).returning('id').executeTakeFirstOrThrow();
        const r = await tx.insertInto('pay.payroll_runs').values({company_id:c.id,month:source.month,status:source.status,attendance_lock_id:sourceLock.id}).returning('id').executeTakeFirstOrThrow();
        if (source.month === '2026-06-01') settledSource = r.id;
        carries.push((await tx.insertInto('pay.recovery_carry_forwards').values({employee_id:e.id,component_code:'CANTEEN',amount:source.amount,from_run_id:r.id,note:'Reviewed canteen balance'}).returning('id').executeTakeFirstOrThrow()).id);
      }
      const service = new PayrollRunService(tx);
      const run = await service.createRun({companyId:c.id,month:'2026-07-01',actorUserId:u.id});
      await addRunInputs(tx,run,[{employeeId:e.id,componentCode:'CANTEEN',amountRupees:50,note:'Reviewed current-period recovery'}],u.id);
      await service.lockInputs(run,u.id);
      for (let attempt=0; attempt<2; attempt++) {
        if (attempt > 0) { await service.returnToDraft(run,u.id,'Verify unchanged recomputation'); await service.lockInputs(run,u.id); }
        expect((await service.computeRun(run,u.id)).exceptions).toEqual([]);
        const item = await tx.selectFrom('pay.payroll_items').select(['id','gross','net_pay','total_deductions']).where('run_id','=',run).executeTakeFirstOrThrow();
        expect(item).toMatchObject({gross:'1000.00',total_deductions:'250.00',net_pay:'750.00'});
        expect((await tx.selectFrom('pay.payroll_item_lines').select('amount').where('item_id','=',item.id).where('component_code','=','CANTEEN').execute()).map(l=>l.amount).sort()).toEqual(['200.00','50.00']);
        const rows = await tx.selectFrom('pay.recovery_carry_forwards').select(['id','consumed_run_id']).where('id','in',carries).orderBy('id').execute();
        expect(rows.map(r=>r.consumed_run_id)).toEqual([run,null,null]);
      }
      await expect(service.reopenRun(settledSource,'Correct previous recovery',u.id)).rejects.toThrow(/consum|later.*run/i);
      const checker = await tx.insertInto('core.users').values({email:`${tag}-checker@hrms.invalid`,password_hash:'!disabled!'}).returning('id').executeTakeFirstOrThrow();
      const role = await tx.selectFrom('core.roles').select('id').where('code','=','hr_head').executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({user_id:checker.id,role_id:role.id}).execute();
      await service.reviewRun(run,u.id);
      await service.approveRun(run,checker.id);
      await service.finalizeRun(run,u.id);
      expect((await service.getRun(run))?.status).toBe('finalized');
      await expect(addRunInputs(tx,run,[{employeeId:e.id,componentCode:'CANTEEN',amountRupees:50,note:'Must not repeat'}],u.id)).rejects.toThrow(/draft/);
      // A dependent run must release its draft claim before its origin changes.
      await service.reopenRun(run,'Review recovery origin',u.id);
      await service.returnToDraft(run,u.id,'Release stale recovery claim');
      expect((await tx.selectFrom('pay.recovery_carry_forwards').select('consumed_run_id').where('id','=',carries[0] ?? 0).executeTakeFirstOrThrow()).consumed_run_id).toBeNull();
      await service.reopenRun(settledSource,'Correct previous recovery',u.id);
      await service.lockInputs(run,u.id);
      await service.computeRun(run,u.id);
      expect((await tx.selectFrom('pay.payroll_items').select('net_pay').where('run_id','=',run).executeTakeFirstOrThrow()).net_pay).toBe('950.00');
    } finally { await tx.rollback().execute(); }
  });
});
