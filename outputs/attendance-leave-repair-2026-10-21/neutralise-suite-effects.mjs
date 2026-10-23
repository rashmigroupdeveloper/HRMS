import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';
import {createDatabase} from '../../backend/src/core/db/database.ts';import {writeAudit} from '../../backend/src/core/audit/audit.service.ts';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));require('dotenv').config({path:new URL('../../backend/.env',import.meta.url).pathname});
const db=createDatabase(process.env.DATABASE_URL);const fixture=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
try{const result=await db.transaction().execute(async tx=>{
 const rows=await tx.selectFrom('lv.ledger').selectAll().where('created_at','>=',new Date('2026-10-21T07:44:50Z')).where('created_at','<',new Date('2026-10-21T07:48:00Z')).where('txn_type','=','accrual').where('effective_date','=','2030-01-01').execute();
 let compensated=0;for(const row of rows){const note=`Attendance repair test compensation of accrual #${row.id}`;if(await tx.selectFrom('lv.ledger').select('id').where('note','=',note).executeTakeFirst())continue;
 const added=await tx.insertInto('lv.ledger').values({employee_id:row.employee_id,leave_type_id:row.leave_type_id,txn_type:'adjustment',delta:String(-Number(row.delta)),effective_date:row.effective_date,reference_id:row.id,note,created_by:fixture.users.hrhead.id}).returning('id').executeTakeFirstOrThrow();await writeAudit(tx,{actorUserId:fixture.users.hrhead.id,action:'create',entity:'lv.ledger',entityId:added.id,newValue:JSON.stringify({note,reversedLedgerId:row.id})});compensated++;}
 const synthetic=await tx.selectFrom('core.employees').select('id').where('id','in',[374486,374487,374488,374489]).where('first_name','like','S15 %').execute();
 if(synthetic.length)await tx.updateTable('core.employees').set({status:'exited',dol:'2026-10-21'}).where('id','in',synthetic.map(e=>e.id)).execute();
 const notifications=await tx.updateTable('wf.notifications').set({status:'dead',last_error:'Shared-database legacy test run stopped; test delivery quarantined'}).where('created_at','>=',new Date('2026-10-21T07:44:50Z')).where('created_at','<',new Date('2026-10-21T07:48:00Z')).where('status','=','queued').returning('id').execute();
 return {compensated,syntheticEmployeesExited:synthetic.length,notificationsQuarantined:notifications.length};});await writeFile(new URL('./suite-effects-neutralised.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);
}finally{await db.destroy()}
