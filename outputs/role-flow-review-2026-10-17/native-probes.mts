/** ATT-04/05/12/15/17, CORE-10/11, PAY-03/18, LC-01/02, RPT-02. Diagnostic only; all fixture writes roll back. */
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {sql} from '../../backend/node_modules/kysely/dist/esm/index.js';
import {createDatabase} from '../../backend/src/core/db/database.js';
import {createApp} from '../../backend/src/app.js';
import {signAccessToken} from '../../backend/src/core/auth/jwt.js';
import {writeAudit} from '../../backend/src/core/audit/audit.service.js';
import {getMonthLockChecklist} from '../../backend/src/modules/attendance/month-lock.service.js';
import {reportR21Offers} from '../../backend/src/modules/reports/reports.service.js';
const target=new URL(process.env.DATABASE_URL??'');
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||target.pathname!=='/hrms')throw new Error('Authorized local hrms test database only');
const db=createDatabase(target.href), tag=`RF${Date.now()}`, secret='synthetic-role-flow-review-only';
const results:{id:string;observed:unknown}[]=[], ids:number[]=[];
const record=(id:string,observed:unknown)=>results.push({id,observed});
const rollback=new Error('Intentional role-flow diagnostic rollback');
try{
 await db.transaction().execute(async trx=>{
  await sql`SET LOCAL lock_timeout='5s'`.execute(trx);await sql`SET LOCAL statement_timeout='20s'`.execute(trx);
  const companies:number[]=[],units:number[]=[];
  for(const suffix of ['A','B']){
   const c=await trx.insertInto('core.companies').values({code:tag+suffix,name:'Synthetic role flow '+suffix,ecode_prefix:tag+suffix,is_india_payroll:false}).returning('id').executeTakeFirstOrThrow();companies.push(c.id);
   units.push((await trx.insertInto('core.org_units').values({company_id:c.id,name:tag+suffix}).returning('id').executeTakeFirstOrThrow()).id);
  }
  const actors:{id:number;employeeId:number;role:string}[]=[];
  for(const [i,role]of ['hr_ops','hr_head','payroll_admin','payroll_admin','it_admin','employee'].entries()){
   const e=await trx.insertInto('core.employees').values({ecode:tag+'U'+i,first_name:'Synthetic role '+i,company_id:companies[0]!,org_unit_id:units[0]!,status:'active',attendance_mode:'manual',doj:new Date('2026-01-01')}).returning('id').executeTakeFirstOrThrow();
   const u=await trx.insertInto('core.users').values({email:`${tag.toLowerCase()}-${i}@hrms.invalid`,password_hash:'disabled-synthetic-fixture',employee_id:e.id}).returning('id').executeTakeFirstOrThrow();ids.push(u.id);
   const r=await trx.selectFrom('core.roles').select('id').where('code','=',role).executeTakeFirstOrThrow();
   await trx.insertInto('core.user_roles').values({user_id:u.id,role_id:r.id,scope_org_unit_id:role==='hr_ops'?units[0]!:null}).execute();actors.push({id:u.id,employeeId:e.id,role});
  }
  const foreign=await trx.insertInto('core.employees').values({ecode:tag+'FOREIGN',first_name:'Synthetic outside scope',company_id:companies[1]!,org_unit_id:units[1]!,status:'active',attendance_mode:'manual',doj:new Date('2026-01-01')}).returning('id').executeTakeFirstOrThrow();
  const tokens:string[]=[];
  for(const a of actors){const session=await trx.insertInto('sec.sessions').values({user_id:a.id,expires_at:new Date(Date.now()+600000)}).returning('sid').executeTakeFirstOrThrow();tokens.push(await signAccessToken(a.id,'synthetic@hrms.invalid',secret,session.sid));}
  const server=createServer(createApp({db:trx,jwtSecret:secret,secureCookies:false}));
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const address=server.address();if(!address||typeof address==='string')throw new Error('No server port');
  const request=async(actor:number,method:string,path:string,body?:unknown)=>{
   const res=await fetch(`http://127.0.0.1:${address.port}/api${path}`,{method,headers:{Authorization:`Bearer ${tokens[actor]}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const text=await res.text();let payload:unknown;try{payload=JSON.parse(text)}catch{payload={nonJson:true,contentType:res.headers.get('content-type')}}return {status:res.status,body:payload};
  };
  const own=actors[0]!.employeeId;
  const override=(actor:number,employeeId:number,date:string,reason='Synthetic diagnostic correction')=>request(actor,'PUT','/attendance/days/override',{employeeId,date,status:'A',reason});
  try{
   record('RF01-scoped-HR-foreign-override',await override(0,foreign.id,'2026-10-01'));
   record('RF02-authorized-HR-own-override',await override(0,own,'2026-10-01'));
   record('RF03-ordinary-employee-override-denied',await override(5,own,'2026-10-01'));
   record('RF04-whitespace-reason',await override(0,own,'2026-10-02','     '));
   await trx.insertInto('att.day_records').values({employee_id:own,work_date:sql<Date>`'2026-10-03'::date`,status:'P',is_locked:true}).execute();
   const locked=await override(0,own,'2026-10-03');
   const lockedRow=await trx.selectFrom('att.day_records').select('status').where('employee_id','=',own).where('work_date','=',sql<Date>`'2026-10-03'::date`).executeTakeFirstOrThrow();
   record('RF05-locked-override-truth',{http:locked.status,actualStatus:lockedRow.status});
   await trx.insertInto('att.day_records').values({employee_id:own,work_date:sql<Date>`'2026-10-04'::date`,status:'P',ot_minutes:120,penalty_flag:true}).execute();
   await override(0,own,'2026-10-04');
   record('RF06-absent-derived-facts',await trx.selectFrom('att.day_records').select(['status','ot_minutes','penalty_flag']).where('employee_id','=',own).where('work_date','=',sql<Date>`'2026-10-04'::date`).executeTakeFirstOrThrow());
   record('RF07-scoped-HR-foreign-days',await request(0,'GET',`/attendance/days?employeeId=${foreign.id}&from=2026-10-01&to=2026-10-02`));
   record('RF08-scoped-HR-foreign-scheme',await request(0,'PUT',`/attendance/config/schemes/${foreign.id}`,{employeeId:foreign.id,weekdayShiftCode:'G5'}));
   record('RF09-own-timing-contract',await request(5,'GET','/attendance/requests/schedule?date=2026-10-15'));
   record('RF10-payroll-list-GET-contract',await request(2,'GET','/payroll/runs/list'));
   const payrollList=await request(2,'POST','/payroll/runs/list',{company_id:companies[0]});
   record('RF11-payroll-list-POST-contract',{status:payrollList.status,isArray:Array.isArray(payrollList.body)});
   const hrList=await request(1,'POST','/payroll/runs/list',{company_id:companies[0]});
   record('RF12-HR-head-readonly-review',{status:hrList.status,isArray:Array.isArray(hrList.body)});
   record('RF13-HR-head-compute-denied',await request(1,'POST','/payroll/runs/compute',{id:0}));
   const attendanceLock=await trx.insertInto('att.month_locks').values({company_id:companies[0]!,month:sql<Date>`'2026-09-01'::date`,locked_by:actors[1]!.id}).returning('id').executeTakeFirstOrThrow();
   const run=await trx.insertInto('pay.payroll_runs').values({attendance_lock_id:attendanceLock.id,company_id:companies[0]!,month:sql<Date>`'2026-09-01'::date`,run_type:'regular',status:'under_review'}).returning('id').executeTakeFirstOrThrow();
   await writeAudit(trx,{actorUserId:actors[2]!.id,entity:'pay.payroll_runs',entityId:run.id,action:'payroll_run_computed',newValue:'Synthetic maker evidence only; no computation'});
   record('RF14-maker-self-approve-denied',await request(2,'POST','/payroll/runs/approve',{id:run.id}));
   record('RF15-second-payroll-approve-without-HR-head',await request(3,'POST','/payroll/runs/approve',{id:run.id}));
   const future=await getMonthLockChecklist(trx,companies[1]!,'2027-01');
   record('RF16-future-empty-month-checklist',{canLock:future.canLock,items:future.items.map(i=>({code:i.code,ok:i.ok,detail:i.detail}))});
   record('RF17-IT-onboarding-task-access',await request(4,'GET','/lifecycle/tasks'));
   const candidate=await trx.insertInto('core.onboarding_candidates').values({full_name:'Synthetic offer no-show',personal_email:`${tag.toLowerCase()}-offer@hrms.invalid`,mobile:'0000000000',position_title:'Synthetic audit',company_id:companies[1]!,offered_ctc:'100000.00',proposed_doj:new Date('2026-11-01'),offer_date:new Date('2026-10-01'),status:'no_show'}).returning('id').executeTakeFirstOrThrow();
   const offers=await reportR21Offers(trx,{companyId:companies[1]!});
   record('RF18-no-show-inferred-rejected-LOI',offers.find(o=>o.id===candidate.id)?.loiStatus);
   record('RF19-LOI-workflow-catalog',await trx.selectFrom('wf.definitions').select('code').where('code','in',['offer','loi','offer_loi']).execute());
  }finally{await new Promise<void>((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections()})}
  throw rollback;
 });
}catch(error){if(error!==rollback)throw error;}
finally{await db.destroy()}
const checkDb=createDatabase(target.href);
try{
 const remaining=await checkDb.selectFrom('core.users').select(({fn})=>fn.countAll().as('n')).where('id','in',ids).executeTakeFirstOrThrow();
 const cleanup={fixtureUsersRemaining:Number(remaining.n),allFixtureWritesRolledBack:true,realEmployeesChanged:false};
 if(cleanup.fixtureUsersRemaining!==0)throw new Error('Fixture cleanup incomplete');
 await writeFile(new URL('./native-results.json',import.meta.url),JSON.stringify({date:'2026-10-17',diagnosticOnly:true,observations:results,cleanup},null,2)+'\n');
 process.stdout.write(JSON.stringify({observations:results.length,cleanup})+'\n');
}finally{await checkDb.destroy()}
