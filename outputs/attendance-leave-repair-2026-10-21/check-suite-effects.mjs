import {createRequire} from 'node:module';
import {createDatabase} from '../../backend/src/core/db/database.ts';
const require=createRequire(new URL('../../backend/package.json',import.meta.url));require('dotenv').config({path:new URL('../../backend/.env',import.meta.url).pathname});
const db=createDatabase(process.env.DATABASE_URL);
try {
 const rows=await db.selectFrom('lv.ledger').select(['id','employee_id','leave_type_id','txn_type','delta','effective_date']).where('created_at','>=',new Date('2026-10-21T07:44:50Z')).where('created_at','<',new Date('2026-10-21T07:48:00Z')).execute();
 console.log(JSON.stringify(rows));
}finally{await db.destroy()}
