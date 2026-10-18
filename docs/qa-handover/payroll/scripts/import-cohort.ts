// QA-only: load the payroll cohort through the repo's own import tooling (importEmsSeed + importGreythrEnrich),
// then apply master fields that have no app path (status/org placement/location/statutory flags) by SQL.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { sql } from 'kysely';
import { createDatabase } from '/workspace/hrms/backend/src/core/db/database.js';
import { hashPassword } from '/workspace/hrms/backend/src/modules/auth/index.js';
import { importEmsSeed, importGreythrEnrich } from '/workspace/hrms/backend/src/modules/employees/index.js';
const db = createDatabase(process.env.DATABASE_URL!);
const C = JSON.parse(readFileSync('/workspace/hrms-test/payroll/cohort.json', 'utf8'));
async function main() {
  const hash = await hashPassword('Rashmi#Test2026');
  const rml = (await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow()).id;
  const rgh = (await db.selectFrom('core.companies').select('id').where('code', '=', 'RGH').executeTakeFirstOrThrow()).id;
  // masters without an API (direct SQL, noted in report)
  const bbs = await db.insertInto('core.locations').values({ company_id: rml, name: 'Bhubaneswar Office', state_code: 'OD', timezone: 'Asia/Kolkata' } as never).onConflict((oc) => oc.columns(['company_id', 'name']).doNothing()).returning('id').executeTakeFirst()
    ?? await db.selectFrom('core.locations').select('id').where('name', '=', 'Bhubaneswar Office').executeTakeFirstOrThrow();
  const grade = await db.insertInto('core.grades').values({ code: 'JG', name: 'Junior Grade', rank: 2 } as never).returning('id').executeTakeFirstOrThrow();
  const cc = await db.insertInto('core.cost_centers').values({ company_id: rml, code: 'ERP-CELL', name: 'ERP-CELL', plant_id: 1 } as never).returning('id').executeTakeFirstOrThrow();
  const loc: Record<string, number> = { KGP: 1, KGP_RGH: 2, BBS: Number(bbs.id) };
  const ems = C.map((e: any) => ({
    userid: e.ecode, username: e.name, email: e.email, gender: e.gender, phone: '98' + e.ecode.slice(-8).replace(/\D/g, '').padStart(8, '7'),
    company: e.co === 'RML' ? 'Rashmi Metaliks Limited' : 'Rashmi Green Hydrogen Steel Ltd',
    department: e.dept ?? (e.co === 'RML' ? 'Production' : 'Production'), designation: e.desig ?? 'Engineer',
    reporting_manager_userid: e.co === 'RML' ? 'RML000007' : 'RGH000001', hod_userid: e.co === 'RML' ? 'RML000006' : 'RGH000001', encrypted_password: hash,
  }));
  console.log('importEmsSeed', JSON.stringify(await importEmsSeed(db, ems)));
  const enrich = C.map((e: any, i: number) => ({
    userid: e.ecode, dob: `19${85 + (i % 14)}-0${(i % 9) + 1}-1${i % 10}`, doj: e.doj, category: e.cat,
    pan: e.pan, aadhaar: String(234567890000 + i * 104729).slice(0, 12), uan: e.uan, esic_ip_number: e.esi_no ?? null,
    bank_name: e.bank[0], bank_account: e.bank[1], bank_ifsc: e.bank[2],
  }));
  console.log('importGreythrEnrich', JSON.stringify(await importGreythrEnrich(db, enrich)));
  for (const e of C) {
    const co = e.co === 'RML' ? rml : rgh;
    await db.updateTable('core.employees').set({
      status: 'active', org_unit_id: e.co === 'RML' ? 1 : 2, location_id: loc[e.loc], plant_id: e.co === 'RML' ? 1 : null,
      cost_center_id: e.cc ? cc.id : (e.co === 'RML' ? 1 : null), grade_id: e.grade ? grade.id : (e.co === 'RML' ? 1 : null),
      contract_type: e.contract === 'apprentice' ? 'fixed_term' : e.contract, esic_applicable: e.esic, tax_regime: e.regime,
      probation_salary_pct: e.prob, probation_months: e.prob ? 6 : null,
    } as never).where('ecode', '=', e.ecode).where('company_id', '=', co).execute();
  }
  const out = await sql`select ecode, first_name||' '||coalesce(last_name,'') n, company_id, status, doj, location_id, reporting_manager_id, category, contract_type, esic_applicable, tax_regime from core.employees where ecode in (${sql.join(C.map((e: any) => e.ecode))}) order by ecode`.execute(db);
  console.table(out.rows);
  await db.destroy();
}
main().catch(async (e) => { console.error(e); await db.destroy(); process.exit(1); });
