import {createRequire} from 'node:module';
import {readFile,appendFile} from 'node:fs/promises';
import {createDatabase} from '../../backend/src/core/db/database.ts';
import {recomputeDay} from '../../backend/src/modules/attendance/index.ts';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));require('dotenv').config({path:new URL('../../backend/.env',import.meta.url).pathname});
const {sql}=require('kysely');const f=JSON.parse(await readFile(new URL('./fixture.json',import.meta.url),'utf8'));
const db=createDatabase(process.env.DATABASE_URL);const action=process.argv[2]??'snapshot';
try {
 if(action==='holiday-process'){
  await recomputeDay(db,f.employeeId,'2026-09-26');
  await db.deleteFrom('att.recompute_queue').where('employee_id','=',f.employeeId).where('work_date','=',sql`'2026-09-26'::date`).execute();
 }
 const days=await db.selectFrom('att.day_records').select(['work_date','status','source','session_statuses','is_locked','leave_type_id']).where('employee_id','=',f.employeeId).where('work_date','>=',sql`'2026-09-24'::date`).where('work_date','<=',sql`'2026-09-26'::date`).orderBy('work_date').execute();
 const totals=await sql`SELECT sum(CASE WHEN d.status IN ('P','H','OD','CO') THEN 1 WHEN d.status='HD' THEN .5 WHEN d.status='L' AND lt.is_paid THEN 1 WHEN d.status='WO' AND d.weekoff_paid THEN 1 ELSE 0 END) payable FROM att.day_records d LEFT JOIN lv.leave_types lt ON lt.id=d.leave_type_id WHERE employee_id=${f.employeeId} AND work_date >= '2026-09-01' AND work_date < '2026-10-01'`.execute(db);
 const ledger=await db.selectFrom('lv.ledger').select(['txn_type','delta','note']).where('employee_id','=',f.employeeId).execute();
 const workflows=await db.selectFrom('wf.requests as r').innerJoin('wf.request_steps as s','s.request_id','r.id').select(['r.id','r.status','s.approver_user_id','s.action','s.notified_at']).where('r.subject_employee_id','=',f.employeeId).execute();
 const result={at:new Date().toISOString(),action,days,payable:totals.rows[0].payable,ledger,workflows};console.log(JSON.stringify(result));await appendFile(new URL('./db-evidence.jsonl',import.meta.url),JSON.stringify(result)+'\n');
}finally{await db.destroy()}
