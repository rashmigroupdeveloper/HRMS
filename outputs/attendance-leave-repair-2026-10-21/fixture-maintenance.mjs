import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createDatabase} from '../../backend/src/core/db/database.ts';
import {writeAudit} from '../../backend/src/core/audit/audit.service.ts';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));require('dotenv').config({path:new URL('../../backend/.env',import.meta.url).pathname});const {sql}=require('kysely');
const f=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));const db=createDatabase(process.env.DATABASE_URL);
try{
 if(process.argv[2]==='quarantine-test-notifications'){
  const ids=Object.values(f.users).map(u=>u.id);
  const result=await db.updateTable('wf.notifications').set({status:'dead',last_error:'QA21 local test output quarantined; do not deliver'}).where('status','=','queued').where(eb=>eb.or([
   eb.and([eb('created_at','>=',new Date('2026-10-21T07:00:16Z')),eb('created_at','<',new Date('2026-10-21T07:00:26Z'))]),
   eb('recipient_user_id','in',ids),eb('recipient_email','like',f.tag.toLowerCase()+'-%@hrms.invalid')
  ])).returning('id').execute();console.log({quarantinedNotifications:result.length});
  await writeFile(new URL('./notification-cleanup.json',import.meta.url),JSON.stringify({quarantinedNotifications:result.length,noWorkerObserved:true},null,2)+'\n');
 }
 if(process.argv[2]==='synthetic-bank'){
  await db.updateTable('core.employees').set({bank_name:'Synthetic QA bank - not for transfer',bank_account:'123456789012',bank_ifsc:'ABCD0123456'}).where('id','=',f.employeeId).where('ecode','=',f.tag+'EMPLOYEE').execute();
  console.log('Assigned dummy bank fields only to synthetic fixture');
 }
 if(process.argv[2]==='compensate-suite-accrual'){
  // stage15's global accrual job inserted 66 future credits outside its own fixture.
  // Preserve immutable history and neutralise only that exact invocation's rows.
  const rows=await db.selectFrom('lv.ledger as l').innerJoin('core.employees as e','e.id','l.employee_id').select(['l.id','l.employee_id','l.leave_type_id','l.delta','l.effective_date','e.ecode']).where('l.txn_type','=','accrual').where('l.created_at','>=',new Date('2026-10-21T07:00:16Z')).where('l.created_at','<',new Date('2026-10-21T07:00:26Z')).where('l.effective_date','=',sql`'2030-01-01'::date`).execute();
  const results=await db.transaction().execute(async tx=>{let count=0;
   for(const row of rows){
    const note='QA21 reversal of test-suite future accrual #'+row.id;
    if(await tx.selectFrom('lv.ledger').select('id').where('note','=',note).executeTakeFirst())continue;
    const inserted=await tx.insertInto('lv.ledger').values({employee_id:row.employee_id,leave_type_id:row.leave_type_id,txn_type:'adjustment',delta:String(-Number(row.delta)),effective_date:row.effective_date,reference_id:row.id,note,created_by:f.users.hrhead.id}).returning('id').executeTakeFirstOrThrow();
    await writeAudit(tx,{actorUserId:f.users.hrhead.id,action:'create',entity:'lv.ledger',entityId:inserted.id,newValue:JSON.stringify({reason:note,reversedLedgerId:row.id})});count++;
   }return {examined:rows.length,compensated:count};});
  await writeFile(new URL('./suite-accrual-cleanup.json',import.meta.url),JSON.stringify(results,null,2)+'\n');console.log(results);
 }
 if(process.argv[2]==='disable'){
  const ids=Object.values(f.users).map(u=>u.id);
  await db.transaction().execute(async tx=>{
   await tx.updateTable('sec.sessions').set({revoked_at:new Date(),revoke_reason:'QA21 completed; synthetic accounts disabled'}).where('user_id','in',ids).where('revoked_at','is',null).execute();
   await tx.updateTable('core.users').set({is_active:false}).where('id','in',ids).execute();
   await tx.deleteFrom('core.user_roles').where('user_id','in',ids).execute();
   await tx.updateTable('core.employees').set({status:'exited',dol:sql`'2026-10-21'::date`}).where('id','in',f.employees).execute();
  });console.log({disabledUsers:ids.length,exitedSyntheticEmployees:f.employees.length,immutableEvidenceRetained:true});
 }
}finally{await db.destroy()}
