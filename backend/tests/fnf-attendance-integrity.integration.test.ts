/** ATT-15/PAY-15: F&F cannot assume presence or bypass locked day facts by an override. */
import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { sql,type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database,SalaryComponentItem } from '../src/core/db/types.js';
import { SeparationService } from '../src/modules/lifecycle/separation/separation.service.js';
import { insertSalaryRevision } from '../src/modules/payroll-core/salaries/assignment.repository.js';
import { addDaysIso } from '../src/core/dates.js';
const url=process.env['DATABASE_URL'];
describe.skipIf(!url)('F&F attendance integrity',()=>{
  let db:Kysely<Database>;
  beforeAll(()=>{db=createDatabase(url ?? '');});
  afterAll(async()=>{await db.destroy();});
  it.each(['white_collar','blue_collar'] as const)('uses locked half/full-day facts and rejects guessed payable days for %s',async category=>{
    const tx=await db.startTransaction().execute();
    try {
      const tag=`FNA${randomUUID().slice(0,8)}`;
      const c=await tx.insertInto('core.companies').values({code:tag,name:tag,ecode_prefix:tag}).returning('id').executeTakeFirstOrThrow();
      const u=await tx.insertInto('core.users').values({email:`${tag}@hrms.invalid`,password_hash:'!disabled!'}).returning('id').executeTakeFirstOrThrow();
      const e=await tx.insertInto('core.employees').values({company_id:c.id,ecode:tag,first_name:tag,category,status:'on_notice',doj:'2020-01-01'}).returning('id').executeTakeFirstOrThrow();
      const st=await tx.insertInto('pay.salary_structures').values({company_id:c.id,name:tag,components:sql<SalaryComponentItem[]>`${JSON.stringify([{component_code:'BASIC'}])}::jsonb`}).returning('id').executeTakeFirstOrThrow();
      await insertSalaryRevision(tx,{employee_id:e.id,structure_id:st.id,effective_from:'2020-01-01',annual_ctc:'120000.00',phase:'confirmed',component_amounts:{BASIC:1_000_000},revision_reason:'joining',approved_by:u.id});
      const sep=await tx.insertInto('core.separations').values({employee_id:e.id,initiated_by:'hr',reason:'Synthetic exit',resignation_date:'2026-08-01',notice_period_days:30,requested_lwd:'2026-09-15',approved_lwd:'2026-09-15',status:'approved'}).returning('id').executeTakeFirstOrThrow();
      const service=new SeparationService(tx);
      const input={separationId:sep.id,userId:u.id,elBalanceDays:0};
      await expect(service.computeFnf(input)).rejects.toThrow(/attendance|locked/i);
      await expect(service.computeFnf({...input,daysPayable:15})).rejects.toThrow(/attendance|locked/i);
      await tx.insertInto('att.day_records').values(Array.from({length:15},(_,i)=>({employee_id:e.id,work_date:addDaysIso('2026-09-01',i),status:i<7?'P' as const:i===7?'HD' as const:'A' as const,is_locked:true}))).execute();
      const lock=await tx.insertInto('att.month_locks').values({company_id:c.id,month:'2026-09-01',locked_by:u.id,locked_at:new Date()}).returning('id').executeTakeFirstOrThrow();
      await expect(service.computeFnf({...input,daysPayable:15})).rejects.toThrow(/payable|attendance/i);
      const calc=await service.computeFnf(input);
      expect(calc.daysPayable).toBe(7.5);
      expect(calc.earnings.proratedSalaryPaise).toBe(250_000);
      const run=await tx.insertInto('pay.payroll_runs').values({company_id:c.id,month:'2026-09-01',status:'computed',attendance_lock_id:lock.id}).returning('id').executeTakeFirstOrThrow();
      await tx.insertInto('pay.payroll_items').values({run_id:run.id,employee_id:e.id,days_in_month:'30',payable_days:'0',lop_days:'30',gross:'0',total_deductions:'0',net_pay:'0',payment_status:'hold_process'}).execute();
      // A zero process-held item never paid the final-month salary.
      expect((await service.computeFnf(input)).earnings.proratedSalaryPaise).toBe(250_000);
    } finally {await tx.rollback().execute();}
  });
});
