/** HH3/P9/P16/E13: a balanced subset cannot pay; fixing the omitted salary unblocks the whole cascade. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database, SalaryComponentItem } from '../src/core/db/types.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';
import { insertSalaryRevision } from '../src/modules/payroll-core/salaries/assignment.repository.js';
import { PayslipGeneratorService } from '../src/modules/payroll-outputs/payslip/payslip-generator.js';
import { BankFileService } from '../src/modules/payroll-outputs/bank/bank-file.service.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { httpRequest } from './http-client.js';
import { addDaysIso } from '../src/core/dates.js';

const url=process.env['DATABASE_URL'];
describe.skipIf(!url)('HH3 missing-population recovery',()=>{
  let db:Kysely<Database>;
  beforeAll(()=>{db=createDatabase(url ?? '');});
  afterAll(async()=>{await db.destroy();});
  it('preserves ₹59,124 for the valid employee and requires the missing item before payslip and paid state',async()=>{
    const tx=await db.startTransaction().execute();
    try {
      const tag=`HH${randomUUID().slice(0,8)}`;
      const company=await tx.insertInto('core.companies').values({code:tag,name:tag,ecode_prefix:tag}).returning('id').executeTakeFirstOrThrow();
      const user=async(role:string)=>{
        const u=await tx.insertInto('core.users').values({email:`${tag}-${role}@hrms.invalid`,password_hash:'!disabled!'}).returning('id').executeTakeFirstOrThrow();
        const r=await tx.selectFrom('core.roles').select('id').where('code','=',role).executeTakeFirstOrThrow();
        await tx.insertInto('core.user_roles').values({user_id:u.id,role_id:r.id}).execute(); return u.id;
      };
      const maker=await user('payroll_admin'), checker=await user('hr_head'), admin=await user('super_admin');
      const employees=[];
      for(const suffix of ['valid','missing']){
        const e=await tx.insertInto('core.employees').values({company_id:company.id,ecode:`${tag}${suffix}`,first_name:suffix,status:'active',doj:'2020-01-01',pf_applicable:false,esic_applicable:false,bank_name:'Synthetic bank',bank_account:'000000000000',bank_ifsc:'TEST0000001',payment_mode:'bank'}).returning('id').executeTakeFirstOrThrow();
        employees.push(e.id);
        await tx.insertInto('att.day_records').values(Array.from({length:30},(_,i)=>({employee_id:e.id,work_date:addDaysIso('2026-09-01',i),status:'P' as const,is_locked:true}))).execute();
      }
      const [valid=0,missing=0]=employees;
      const st=await tx.insertInto('pay.salary_structures').values({company_id:company.id,name:tag,components:sql<SalaryComponentItem[]>`${JSON.stringify([{component_code:'BASIC'},{component_code:'HRA'}])}::jsonb`}).returning('id').executeTakeFirstOrThrow();
      const salary=async(employeeId:number,amounts:Record<string,number>)=>insertSalaryRevision(tx,{employee_id:employeeId,structure_id:st.id,effective_from:'2020-01-01',annual_ctc:employeeId===valid?'711888.00':'120000.00',phase:'confirmed',component_amounts:amounts,revision_reason:'joining',approved_by:maker});
      await salary(valid,{BASIC:3_000_000,HRA:2_932_400}); // ₹59,324 gross − ₹200 PT, no PF/ESIC/TDS = ₹59,124
      await tx.insertInto('att.month_locks').values({company_id:company.id,month:'2026-09-01',locked_by:maker,locked_at:new Date()}).execute();
      const service=new PayrollRunService(tx);
      const run=await service.createRun({companyId:company.id,month:'2026-09-01',actorUserId:maker});
      await service.lockInputs(run,maker);
      const partial=await service.computeRun(run,maker);
      expect(partial.exceptions).toHaveLength(1);
      expect(partial.exceptions[0]?.employeeId).toBe(missing);
      expect(partial.exceptions[0]?.reason).toContain('salary');
      const secret='synthetic-hh3-jwt-secret-at-least-32-characters';
      const session=await tx.insertInto('sec.sessions').values({user_id:checker,expires_at:new Date(Date.now()+600000)}).returning('sid').executeTakeFirstOrThrow();
      const token=await signAccessToken(checker,`${tag}-hr_head@hrms.invalid`,secret,session.sid);
      const app=createApp({db:tx,jwtSecret:secret,secureCookies:false});
      const issues=await (await httpRequest(app)).get(`/api/payroll/runs/${run}/compute-issues`).set('Authorization',`Bearer ${token}`);
      expect(issues.status).toBe(200);
      expect((issues.body as {exceptions:unknown[]}).exceptions).toEqual(partial.exceptions);
      expect((await tx.selectFrom('pay.payroll_items').select('net_pay').where('run_id','=',run).where('employee_id','=',valid).executeTakeFirstOrThrow()).net_pay).toBe('59124.00');
      await service.reviewRun(run,maker); await service.approveRun(run,checker);
      await expect(service.finalizeRun(run,checker)).rejects.toThrow(/1 expected employee/);
      await service.reopenRun(run,'Repair omitted employee salary',admin);
      await salary(missing,{BASIC:1_000_000});
      expect((await service.computeRun(run,maker)).exceptions).toEqual([]);
      await service.reviewRun(run,maker); await service.approveRun(run,checker); await service.finalizeRun(run,checker);
      expect(await new PayslipGeneratorService(tx).generateRunPayslips(run,maker)).toMatchObject({generatedCount:2});
      expect((await new BankFileService(tx).generateBankBatch(run,maker)).recordCount).toBe(2);
      await service.markPaid(run,checker,'SYNTHETIC-HH3-PAYMENT');
      expect((await service.getRun(run))?.status).toBe('paid');
      const item=await tx.selectFrom('pay.payroll_items').select(['net_pay','payslip_document_id']).where('run_id','=',run).where('employee_id','=',valid).executeTakeFirstOrThrow();
      expect(item.net_pay).toBe('59124.00'); expect(item.payslip_document_id).not.toBeNull();
      const employeeUser=await user('employee');
      await tx.updateTable('core.users').set({employee_id:valid}).where('id','=',employeeUser).execute();
      const ownSession=await tx.insertInto('sec.sessions').values({user_id:employeeUser,expires_at:new Date(Date.now()+600000)}).returning('sid').executeTakeFirstOrThrow();
      const ownToken=await signAccessToken(employeeUser,`${tag}-employee@hrms.invalid`,secret,ownSession.sid);
      const own=await (await httpRequest(app)).post('/api/payroll/outputs/getMyPayslip').set('Authorization',`Bearer ${ownToken}`).send({month:'2026-09'});
      expect(own.status).toBe(200);
      expect((own.body as {payslip:{netPayRupees:number}}).payslip.netPayRupees).toBe(59124);
      for (const runType of ['off_cycle','bonus','arrears','fnf'] as const) {
        const other=await service.createRun({companyId:company.id,month:'2026-09-01',actorUserId:maker,runType});
        await service.lockInputs(other,maker);
        await expect(service.computeRun(other,maker)).rejects.toThrow(/regular|dedicated|off.cycle/i);
        expect(await tx.selectFrom('pay.payroll_items').select('id').where('run_id','=',other).execute()).toHaveLength(0);
      }
    } finally {await tx.rollback().execute();}
  });
});
