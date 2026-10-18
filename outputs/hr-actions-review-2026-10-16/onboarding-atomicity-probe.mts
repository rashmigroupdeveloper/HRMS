/** LC-01: prove durability after a real conversion failure, then clean owned fixtures. */
import { writeFile } from 'node:fs/promises';
import { createDatabase } from '../../backend/src/core/db/database.js';
import { OnboardingService } from '../../backend/src/modules/lifecycle/onboarding/onboarding.service.js';
const target=process.env['DATABASE_URL']; if(!target)throw new Error('Explicit local test database required');
const url=new URL(target); if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.pathname!=='/hrms')throw new Error('Only local hrms test database');
const db=createDatabase(target); const stamp=String(Date.now());
const email=`hra-atomic-collision-${stamp}@hrms.test`;
const candidateEmail=`hra-atomic-candidate-${stamp}@hrms.test`;
let companyId:number|undefined,locationId:number|undefined,departmentId:number|undefined,designationId:number|undefined,candidateId:number|undefined,userId:number|undefined;
let observation:unknown;
try {
 companyId=(await db.insertInto('core.companies').values({code:`HRAAT${stamp}`,name:'HR atomicity audit fixture',ecode_prefix:`HRAAT${stamp}`,is_india_payroll:false}).returning('id').executeTakeFirstOrThrow()).id;
 locationId=(await db.insertInto('core.locations').values({company_id:companyId,name:`HRAAT${stamp}`,state_code:'WB'}).returning('id').executeTakeFirstOrThrow()).id;
 departmentId=(await db.insertInto('core.departments').values({name:`HRAAT${stamp}`}).returning('id').executeTakeFirstOrThrow()).id;
 designationId=(await db.insertInto('core.designations').values({name:`HRAAT${stamp}`}).returning('id').executeTakeFirstOrThrow()).id;
 userId=(await db.insertInto('core.users').values({email,password_hash:'disabled-audit-collision-fixture',is_active:false}).returning('id').executeTakeFirstOrThrow()).id;
 candidateId=(await OnboardingService.ingestCandidate(db,{fullName:'Atomicity audit fixture',personalEmail:candidateEmail,mobile:`HRAAT${stamp}`,positionTitle:'Audit role',companyId,offeredCtc:1000000,proposedDoj:'2026-10-16',offerDate:'2026-10-01'})).candidateId;
 let rejected=false; let errorCode:string|undefined;
 try {
  await OnboardingService.convertCandidate(db,{candidateId,companyId,locationId,departmentId,designationId,workEmail:email,doj:'2026-10-16'});
 }catch(error){rejected=true;errorCode=(error as {code?:string}).code;}
 // Independent pool proves these rows survived the failed application call.
 const independent=createDatabase(target);
 try {
  const employees=await independent.selectFrom('core.employees').select('id').where('personal_email','=',candidateEmail).execute();
  const candidate=await independent.selectFrom('core.onboarding_candidates').select(['status','employee_id']).where('id','=',candidateId).executeTakeFirstOrThrow();
  const logins=employees.length===0?[]:await independent.selectFrom('core.users').select('id').where('employee_id','in',employees.map(e=>e.id)).execute();
  observation={conversionRejected:rejected,errorCode,committedOrphanEmployees:employees.length,createdEmployeeLogins:logins.length,candidateStatus:candidate.status,candidateLinkedEmployee:candidate.employee_id!==null};
  if(!rejected||errorCode!=='23505'||employees.length!==1||candidate.employee_id!==null)throw new Error('Expected atomicity failure was not reproduced');
 }finally{await independent.destroy();}
}finally{
 // Delete mutable owned business fixtures. Keep the login disabled/detached under the repository test convention.
 const owned=await db.selectFrom('core.employees').select('id').where('personal_email','=',candidateEmail).execute();
 if(owned.length){
  const ids=owned.map(e=>e.id);
  await db.deleteFrom('core.onboarding_tasks').where('employee_id','in',ids).execute();
  await db.deleteFrom('core.probation_reviews').where('employee_id','in',ids).execute();
  await db.updateTable('core.onboarding_candidates').set({employee_id:null}).where('employee_id','in',ids).execute();
  await db.updateTable('core.users').set({employee_id:null,is_active:false}).where('employee_id','in',ids).execute();
  await db.deleteFrom('core.employees').where('id','in',ids).execute();
 }
 if(candidateId!==undefined)await db.deleteFrom('core.onboarding_candidates').where('id','=',candidateId).execute();
 if(userId!==undefined)await db.updateTable('core.users').set({is_active:false,employee_id:null}).where('id','=',userId).execute();
 if(locationId!==undefined)await db.deleteFrom('core.locations').where('id','=',locationId).execute();
 if(departmentId!==undefined)await db.deleteFrom('core.departments').where('id','=',departmentId).execute();
 if(designationId!==undefined)await db.deleteFrom('core.designations').where('id','=',designationId).execute();
 if(companyId!==undefined)await db.deleteFrom('core.companies').where('id','=',companyId).execute();
 await db.destroy();
}
const check=createDatabase(target);
let cleanup;
try{
 const remainingEmployees=await check.selectFrom('core.employees').select('id').where('personal_email','=',candidateEmail).execute();
 const remainingCandidates=await check.selectFrom('core.onboarding_candidates').select('id').where('personal_email','=',candidateEmail).execute();
 const remainingCompanies=await check.selectFrom('core.companies').select('id').where('code','=',`HRAAT${stamp}`).execute();
 const retainedUser=await check.selectFrom('core.users').select(['is_active','employee_id']).where('email','=',email).executeTakeFirstOrThrow();
 cleanup={employees:remainingEmployees.length,candidates:remainingCandidates.length,companies:remainingCompanies.length,retainedDisabledDetachedUsers:!retainedUser.is_active&&retainedUser.employee_id===null?1:0};
 if(cleanup.employees||cleanup.candidates||cleanup.companies||cleanup.retainedDisabledDetachedUsers!==1)throw new Error('Atomicity probe fixture cleanup failed');
}finally{await check.destroy();}
const result={preparedAt:new Date().toISOString(),database:'loopback/hrms test only',mode:'Real autocommit service failure; independent connection checks durable partial data before cleanup. No payroll salary structure supplied.',applicationSourceChanged:false,observation,cleanup};
await writeFile(new URL('./onboarding-atomicity-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
process.stdout.write(JSON.stringify({observation,cleanup})+'\n');
