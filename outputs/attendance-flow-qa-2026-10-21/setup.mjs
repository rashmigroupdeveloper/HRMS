// Local synthetic QA fixtures only. Never resets a database or edits real employees.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { createDatabase } from '../../backend/src/core/db/database.ts';
import { insertSalaryRevision } from '../../backend/src/modules/payroll-core/salaries/assignment.repository.ts';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
require('dotenv').config({path:new URL('../../backend/.env',import.meta.url).pathname});
const {sql}=require('kysely');
const bcrypt=require('bcryptjs');
const target=new URL(process.env.DATABASE_URL);
if(target.hostname!=='localhost'||target.pathname!=='/hrms') throw Error('Loopback QA target required');
const db=createDatabase(target.href);
const tag='QA21'+Date.now().toString().slice(-7);
const f={tag,users:{},employees:[],month:'2026-09-01'};
try {
 await db.transaction().execute(async tx=>{
  const company=await tx.insertInto('core.companies').values({code:tag,name:tag+' Synthetic QA',ecode_prefix:tag,is_india_payroll:true}).returning('id').executeTakeFirstOrThrow();f.companyId=company.id;
  const org=await tx.insertInto('core.org_units').values({company_id:company.id,name:'Synthetic QA unit'}).returning('id').executeTakeFirstOrThrow();f.orgId=org.id;
  const loc=await tx.insertInto('core.locations').values({company_id:company.id,name:'Synthetic QA location',state_code:'WB'}).returning('id').executeTakeFirstOrThrow();f.locationId=loc.id;
  for(const [key,role,doj] of [['manager','manager','2026-10-01'],['employee','employee','2026-09-01'],['hrops','hr_ops',null],['payroll','payroll_admin',null],['hrhead','hr_head',null]]){
   let employeeId=null;
   if(doj){ const e=await tx.insertInto('core.employees').values({company_id:company.id,org_unit_id:org.id,location_id:loc.id,ecode:tag+key.toUpperCase(),first_name:'QA '+key,status:'active',doj,attendance_mode:'manual',pf_applicable:false,esic_applicable:false,...(key==='employee'?{reporting_manager_id:f.managerId}:{})}).returning('id').executeTakeFirstOrThrow();employeeId=e.id;f.employees.push(e.id);f[key+'Id']=e.id; }
   const email=tag.toLowerCase()+'-'+key+'@hrms.invalid';
   const u=await tx.insertInto('core.users').values({email,password_hash:await bcrypt.hash('Synthetic-QA-Flow-2026!',10),employee_id:employeeId}).returning('id').executeTakeFirstOrThrow();
   const r=await tx.selectFrom('core.roles').select('id').where('code','=',role).executeTakeFirstOrThrow();
   await tx.insertInto('core.user_roles').values({user_id:u.id,role_id:r.id,scope_org_unit_id:['hrops','payroll'].includes(key)?org.id:null}).execute();
   f.users[key]={id:u.id,email};
  }
  const shift=await tx.selectFrom('att.shifts').select('id').where('code','=','G5').executeTakeFirstOrThrow();f.shiftId=shift.id;
  await tx.insertInto('att.employee_shifts').values({employee_id:f.employeeId,weekday_shift_id:shift.id,saturday_shift_id:shift.id}).execute();
  for(let day=1;day<=30;day++){
   const date='2026-09-'+String(day).padStart(2,'0');const absent=[24,25,26].includes(day);
   await tx.insertInto('att.rosters').values({employee_id:f.employeeId,work_date:date,shift_id:shift.id,is_week_off:false}).execute();
   await tx.insertInto('att.day_records').values({employee_id:f.employeeId,work_date:date,status:absent?'A':'P',source:'auto',session_statuses:JSON.stringify([{session:1,status:absent?'A':'P'},{session:2,status:absent?'A':'P'}])}).execute();
  }
  const leave=await tx.selectFrom('lv.leave_types').select('id').where('code','=','CL').executeTakeFirstOrThrow();f.leaveTypeId=leave.id;
  await tx.insertInto('lv.ledger').values({employee_id:f.employeeId,leave_type_id:leave.id,txn_type:'grant',delta:'5',effective_date:'2026-09-01',note:tag+' synthetic opening balance'}).execute();
  const structure=await tx.insertInto('pay.salary_structures').values({company_id:company.id,name:tag+' BASIC',components:sql`${JSON.stringify([{component_code:'BASIC',amount_rule:{type:'fixed',value:30000}}])}::jsonb`}).returning('id').executeTakeFirstOrThrow();
  await insertSalaryRevision(tx,{employee_id:f.employeeId,structure_id:structure.id,effective_from:'2026-09-01',annual_ctc:'360000.00',phase:'confirmed',component_amounts:{BASIC:3000000},revision_reason:'joining',approved_by:f.users.payroll.id});
 });
 await writeFile(new URL('./fixture.json',import.meta.url),JSON.stringify(f,null,2)+'\n');console.log(JSON.stringify(f));
} finally {await db.destroy();}
