// QA-only seed (not part of app). Creates org masters + employees + users for every role.
import 'dotenv/config';
import { sql } from 'kysely';
import { createDatabase } from '/workspace/hrms/backend/src/core/db/database.js';
import { hashPassword } from '/workspace/hrms/backend/src/modules/auth/index.js';
import { importEmsSeed, importGreythrEnrich } from '/workspace/hrms/backend/src/modules/employees/index.js';

const PW = 'Rashmi#Test2026';
const db = createDatabase(process.env.DATABASE_URL!);
const people = [
  ['RML000001','Arun Gupta','ceo@rashmi.test','Male','CEO Cell','Chief Executive Officer',null,['ceo_cell']],
  ['RML000002','Chaitanya Paila','hrhead@rashmi.test','Male','Human Resources','DGM HR','RML000001',['hr_head']],
  ['RML000003','Rachna Das','hrops@rashmi.test','Female','Human Resources','HR Executive','RML000002',['hr_ops']],
  ['RML000004','Subhasis Panda','payroll@rashmi.test','Male','Finance','Payroll Manager','RML000002',['payroll_admin']],
  ['RML000005','Sapikul Ali','planthead@rashmi.test','Male','Production','Plant Head','RML000001',['plant_head']],
  ['RML000006','Kinjal Roy','srmanager@rashmi.test','Female','Production','Senior Manager','RML000005',[]],
  ['RML000007','Amit Kumar Singh','manager@rashmi.test','Male','Production','Deputy Manager','RML000006',[]],
  ['RML000008','Debajit Roy','employee@rashmi.test','Male','Production','Engineer','RML000007',[]],
  ['RML000009','Priya Sharma','employee2@rashmi.test','Female','Production','Junior Engineer','RML000007',[]],
  ['RML000010','Sharique Khan','itadmin@rashmi.test','Male','IT','IT Manager','RML000002',[]],
  ['RGH000001','Sushanta Nayak','rgh.employee@rashmi.test','Male','Production','Engineer',null,[]],
] as const;

async function main() {
  const hash = await hashPassword(PW);
  const rml = await db.selectFrom('core.companies').select('id').where('code','=','RML').executeTakeFirstOrThrow();
  const rgh = await db.selectFrom('core.companies').select('id').where('code','=','RGH').executeTakeFirstOrThrow();
  const loc = await db.insertInto('core.locations').values({ company_id: rml.id, name: 'Kharagpur', state_code: 'WB', timezone: 'Asia/Kolkata' } as never).returning('id').executeTakeFirstOrThrow();
  const loc2 = await db.insertInto('core.locations').values({ company_id: rgh.id, name: 'Kharagpur RGH', state_code: 'WB', timezone: 'Asia/Kolkata' } as never).returning('id').executeTakeFirstOrThrow();
  const plant = await db.insertInto('core.plants').values({ company_id: rml.id, plant_code: 'KGP1', name: 'Kharagpur Plant 1', location_id: loc.id } as never).returning('id').executeTakeFirstOrThrow();
  const ou = await db.insertInto('core.org_units').values({ company_id: rml.id, name: 'RML Kharagpur' } as never).returning('id').executeTakeFirstOrThrow();
  const ou2 = await db.insertInto('core.org_units').values({ company_id: rgh.id, name: 'RGH Unit' } as never).returning('id').executeTakeFirstOrThrow();
  const cc = await db.insertInto('core.cost_centers').values({ company_id: rml.id, code: 'CC100', name: 'Plant Ops', plant_id: plant.id } as never).returning('id').executeTakeFirstOrThrow();
  const grade = await db.insertInto('core.grades').values({ code: 'M1', name: 'Manager 1', rank: 5 } as never).returning('id').executeTakeFirstOrThrow();

  const ems = people.map(([userid, username, email, gender, department, designation, rm]) => ({
    userid, username, email, gender, phone: '98300000' + userid.slice(-2), company: userid.startsWith('RGH') ? 'Rashmi Green Hydrogen Steel Ltd' : 'Rashmi Metaliks Limited',
    department, designation, reporting_manager_userid: rm, hod_userid: rm, encrypted_password: hash,
  }));
  const r = await importEmsSeed(db, ems);
  console.log('import', JSON.stringify(r));
  const enrich = people.map(([userid], i) => ({
    userid, dob: `19${80 + i}-0${(i % 9) + 1}-15`, doj: '2024-04-01', category: 'white_collar',
    pan: `ABCPD${String(1000 + i)}K`, aadhaar: `23456789${String(1000 + i)}`, uan: `1001234567${String(10 + i)}`,
    bank_name: 'SBI', bank_account: `3012345678${String(10 + i)}`, bank_ifsc: 'SBIN0001234',
  }));
  console.log('enrich', JSON.stringify(await importGreythrEnrich(db, enrich)));
  // Importer leaves status='onboarding'; mark active and place in org/plant for testing.
  await db.updateTable('core.employees').set({ status: 'active', org_unit_id: ou.id, location_id: loc.id, plant_id: plant.id, cost_center_id: cc.id, grade_id: grade.id } as never).where('company_id','=',rml.id).execute();
  await db.updateTable('core.employees').set({ status: 'active', org_unit_id: ou2.id, location_id: loc2.id } as never).where('company_id','=',rgh.id).execute();
  await db.updateTable('core.employees').set({ esic_applicable: true } as never).where('ecode','=','RML000009').execute();

  for (const [ecode, , email, , , , , roles] of people) {
    const u = await db.selectFrom('core.users').select('id').where('email','=',email).executeTakeFirstOrThrow();
    const all = ['employee', ...roles, ...(ecode === 'RML000010' ? ['it_admin'] : [])];
    for (const code of all) {
      const role = await db.selectFrom('core.roles').select('id').where('code','=',code).executeTakeFirstOrThrow();
      const scoped = code === 'hr_ops' || code === 'plant_head' ? ou.id : null;
      await db.insertInto('core.user_roles').values({ user_id: u.id, role_id: role.id, scope_org_unit_id: scoped }).onConflict((oc) => oc.doNothing()).execute();
    }
  }
  // super admin w/o employee
  const sa = await db.insertInto('core.users').values({ email: 'admin@rashmi.test', password_hash: hash }).returning('id').executeTakeFirstOrThrow();
  const saRole = await db.selectFrom('core.roles').select('id').where('code','=','super_admin').executeTakeFirstOrThrow();
  await db.insertInto('core.user_roles').values({ user_id: sa.id, role_id: saRole.id, scope_org_unit_id: null }).execute();
  const out = await sql`select u.email, e.ecode, string_agg(r.code, ',' order by r.code) roles from core.users u left join core.employees e on e.id=u.employee_id left join core.user_roles ur on ur.user_id=u.id left join core.roles r on r.id=ur.role_id group by 1,2 order by 2`.execute(db);
  console.table(out.rows);
  await db.destroy();
}
main().catch(async (e) => { console.error(e); await db.destroy(); process.exit(1); });
