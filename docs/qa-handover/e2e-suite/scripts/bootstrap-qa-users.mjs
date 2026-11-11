/**
 * Mac-local bootstrap: ensure USERS.md QA personas exist in hrms_e2e with password Rashmi#Test2026.
 * Does NOT touch the main `hrms` database.
 */
import pg from 'pg';
import bcrypt from '../../../../backend/node_modules/bcryptjs/index.js';

const DATABASE_URL = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || 'postgres://anooppratapsingh@localhost:5432/hrms_e2e';
const PW = process.env.E2E_PASSWORD || 'Rashmi#Test2026';

const people = [
  { ecode: 'RML000001', email: 'ceo@rashmi.test', first: 'Arun', last: 'Gupta', gender: 'Male', roles: ['employee', 'ceo_cell'], rm: null },
  { ecode: 'RML000002', email: 'hrhead@rashmi.test', first: 'Chaitanya', last: 'Paila', gender: 'Male', roles: ['employee', 'hr_head'], rm: 'RML000001' },
  { ecode: 'RML000003', email: 'hrops@rashmi.test', first: 'Rachna', last: 'Das', gender: 'Female', roles: ['employee', 'hr_ops'], rm: 'RML000002', scope: 'rml' },
  { ecode: 'RML000004', email: 'payroll@rashmi.test', first: 'Subhasis', last: 'Panda', gender: 'Male', roles: ['employee', 'payroll_admin'], rm: 'RML000002', scope: 'rml' },
  { ecode: 'RML000005', email: 'planthead@rashmi.test', first: 'Sapikul', last: 'Ali', gender: 'Male', roles: ['employee', 'plant_head'], rm: 'RML000001', scope: 'rml' },
  { ecode: 'RML000006', email: 'srmanager@rashmi.test', first: 'Kinjal', last: 'Roy', gender: 'Female', roles: ['employee', 'senior_manager', 'manager'], rm: 'RML000005' },
  { ecode: 'RML000007', email: 'manager@rashmi.test', first: 'Amit', last: 'Kumar Singh', gender: 'Male', roles: ['employee', 'manager'], rm: 'RML000006' },
  { ecode: 'RML000008', email: 'employee@rashmi.test', first: 'Debajit', last: 'Roy', gender: 'Male', roles: ['employee'], rm: 'RML000007' },
  { ecode: 'RML000009', email: 'employee2@rashmi.test', first: 'Priya', last: 'Sharma', gender: 'Female', roles: ['employee'], rm: 'RML000007', esic: true },
  { ecode: 'RML000010', email: 'itadmin@rashmi.test', first: 'Sharique', last: 'Khan', gender: 'Male', roles: ['employee', 'it_admin'], rm: 'RML000002' },
  { ecode: 'RGH000001', email: 'rgh.employee@rashmi.test', first: 'Sushanta', last: 'Nayak', gender: 'Male', roles: ['employee'], rm: null, company: 'RGH' },
];

const extras = [
  { email: 'admin@rashmi.test', roles: ['super_admin'] },
  { email: 'lockout@rashmi.test', roles: ['employee'] },
  { email: 'pwchange@rashmi.test', roles: ['employee'] },
  { email: 'pwreset@rashmi.test', roles: ['employee'] },
  { email: 'hod@rashmi.test', roles: ['employee', 'hod'], ecode: 'RML000090', first: 'Hemant', last: 'DeptHead' },
  { email: 'hrops.rgh@rashmi.test', roles: ['employee', 'hr_ops'], ecode: 'RGH000090', first: 'Sweta', last: 'RGH-HROps', company: 'RGH', scope: 'rgh' },
  { email: 'payroll.rgh@rashmi.test', roles: ['employee', 'payroll_admin'], ecode: 'RGH000091', first: 'Ritesh', last: 'RGH-Payroll', company: 'RGH', scope: 'rgh' },
  { email: 'payroll.group@rashmi.test', roles: ['payroll_admin'] },
];

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();
const hash = await bcrypt.hash(PW, 10);

async function ensureOrg() {
  const rml = await client.query(`SELECT id FROM core.companies WHERE code='RML'`);
  const rgh = await client.query(`SELECT id FROM core.companies WHERE code='RGH'`);
  if (!rml.rows[0] || !rgh.rows[0]) throw new Error('RML/RGH companies missing');
  const rmlId = rml.rows[0].id, rghId = rgh.rows[0].id;

  let loc = await client.query(`SELECT id FROM core.locations WHERE company_id=$1 AND name='Kharagpur E2E'`, [rmlId]);
  if (!loc.rows[0]) {
    loc = await client.query(`INSERT INTO core.locations (company_id, name, state_code, timezone) VALUES ($1,'Kharagpur E2E','WB','Asia/Kolkata') RETURNING id`, [rmlId]);
  }
  let loc2 = await client.query(`SELECT id FROM core.locations WHERE company_id=$1 AND name='Kharagpur RGH E2E'`, [rghId]);
  if (!loc2.rows[0]) {
    loc2 = await client.query(`INSERT INTO core.locations (company_id, name, state_code, timezone) VALUES ($1,'Kharagpur RGH E2E','WB','Asia/Kolkata') RETURNING id`, [rghId]);
  }
  let ou = await client.query(`SELECT id FROM core.org_units WHERE company_id=$1 AND name='RML Kharagpur E2E'`, [rmlId]);
  if (!ou.rows[0]) {
    ou = await client.query(`INSERT INTO core.org_units (company_id, name) VALUES ($1,'RML Kharagpur E2E') RETURNING id`, [rmlId]);
  }
  let ou2 = await client.query(`SELECT id FROM core.org_units WHERE company_id=$1 AND name='RGH Unit E2E'`, [rghId]);
  if (!ou2.rows[0]) {
    ou2 = await client.query(`INSERT INTO core.org_units (company_id, name) VALUES ($1,'RGH Unit E2E') RETURNING id`, [rghId]);
  }
  let dept = await client.query(`SELECT id FROM core.departments ORDER BY id LIMIT 1`);
  return { rmlId, rghId, locId: loc.rows[0].id, loc2Id: loc2.rows[0].id, ouId: ou.rows[0].id, ou2Id: ou2.rows[0].id, deptId: dept.rows[0]?.id ?? null };
}

async function upsertEmployee(p, org) {
  const companyId = p.company === 'RGH' ? org.rghId : org.rmlId;
  const ouId = p.company === 'RGH' ? org.ou2Id : org.ouId;
  const locId = p.company === 'RGH' ? org.loc2Id : org.locId;
  const existing = await client.query(`SELECT id FROM core.employees WHERE ecode=$1`, [p.ecode]);
  let empId;
  if (existing.rows[0]) {
    empId = existing.rows[0].id;
    await client.query(
      `UPDATE core.employees SET first_name=$2, last_name=$3, gender=$4, work_email=$5, status='active',
        org_unit_id=$6, location_id=$7, department_id=COALESCE(department_id,$8), company_id=$9,
        esic_applicable=COALESCE($10, esic_applicable), updated_at=now()
       WHERE id=$1`,
      [empId, p.first, p.last, p.gender, p.email, ouId, locId, org.deptId, companyId, p.esic ?? false]
    );
  } else {
    const ins = await client.query(
      `INSERT INTO core.employees (ecode, company_id, first_name, last_name, gender, status, doj, org_unit_id, location_id, department_id, work_email, esic_applicable)
       VALUES ($1,$2,$3,$4,$5,'active',DATE '2024-04-01',$6,$7,$8,$9,$10) RETURNING id`,
      [p.ecode, companyId, p.first, p.last, p.gender, ouId, locId, org.deptId, p.email, p.esic ?? false]
    );
    empId = ins.rows[0].id;
  }
  return empId;
}

async function upsertUser(email, empId, roles, scopeOu) {
  const existing = await client.query(`SELECT id FROM core.users WHERE email=$1`, [email]);
  let userId;
  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await client.query(
      `UPDATE core.users SET password_hash=$2, is_active=true, employee_id=COALESCE($3, employee_id), failed_attempts=0, locked_until=NULL WHERE id=$1`,
      [userId, hash, empId]
    );
  } else {
    const cols = empId != null
      ? await client.query(`INSERT INTO core.users (email, password_hash, employee_id, is_active) VALUES ($1,$2,$3,true) RETURNING id`, [email, hash, empId])
      : await client.query(`INSERT INTO core.users (email, password_hash, is_active) VALUES ($1,$2,true) RETURNING id`, [email, hash]);
    userId = cols.rows[0].id;
  }
  for (const code of roles) {
    const role = await client.query(`SELECT id FROM core.roles WHERE code=$1`, [code]);
    if (!role.rows[0]) { console.warn('missing role', code); continue; }
    const scope = (code === 'hr_ops' || code === 'plant_head' || code === 'payroll_admin') && scopeOu != null ? scopeOu : null;
    await client.query(
      `INSERT INTO core.user_roles (user_id, role_id, scope_org_unit_id)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (SELECT 1 FROM core.user_roles WHERE user_id=$1 AND role_id=$2)`,
      [userId, role.rows[0].id, scope]
    );
    if (scope != null) {
      await client.query(
        `UPDATE core.user_roles SET scope_org_unit_id=$3 WHERE user_id=$1 AND role_id=$2 AND scope_org_unit_id IS NULL`,
        [userId, role.rows[0].id, scope]
      );
    }
  }
  return userId;
}

const org = await ensureOrg();
console.log('org', org);

const idByEcode = {};
for (const p of people) {
  const empId = await upsertEmployee(p, org);
  idByEcode[p.ecode] = empId;
  const scopeOu = p.scope === 'rml' ? org.ouId : p.scope === 'rgh' ? org.ou2Id : null;
  await upsertUser(p.email, empId, p.roles, scopeOu);
  console.log('ok', p.ecode, p.email, empId);
}

// reporting managers (second pass)
for (const p of people) {
  if (!p.rm) continue;
  const rmId = idByEcode[p.rm];
  if (!rmId) continue;
  await client.query(`UPDATE core.employees SET reporting_manager_id=$2 WHERE ecode=$1`, [p.ecode, rmId]);
}

for (const x of extras) {
  let empId = null;
  if (x.ecode) {
    empId = await upsertEmployee({ ...x, gender: x.gender || 'Male' }, org);
    idByEcode[x.ecode] = empId;
  }
  const scopeOu = x.scope === 'rml' ? org.ouId : x.scope === 'rgh' ? org.ou2Id : null;
  await upsertUser(x.email, empId, x.roles, scopeOu);
  console.log('extra', x.email, empId);
}

// HOD: mark as department head if table exists
try {
  const hod = idByEcode['RML000090'];
  if (hod && org.deptId) {
    await client.query(
      `INSERT INTO core.department_heads (department_id, company_id, employee_id)
       SELECT $1, $2, $3 WHERE NOT EXISTS (
         SELECT 1 FROM core.department_heads WHERE department_id=$1 AND employee_id=$3
       )`,
      [org.deptId, org.rmlId, hod]
    );
    await client.query(
      `UPDATE core.employees SET hod_employee_id=$1, functional_manager_id=$1 WHERE ecode IN ('RML000008','RML000009')`,
      [hod]
    );
  }
} catch (e) {
  console.warn('hod setup skipped', e.message);
}

const out = await client.query(`
  SELECT u.email, e.ecode, string_agg(r.code, ',' ORDER BY r.code) roles
  FROM core.users u
  LEFT JOIN core.employees e ON e.id=u.employee_id
  LEFT JOIN core.user_roles ur ON ur.user_id=u.id
  LEFT JOIN core.roles r ON r.id=ur.role_id
  WHERE u.email LIKE '%@rashmi.test'
  GROUP BY 1,2 ORDER BY 2 NULLS LAST, 1`);
console.table(out.rows);
await client.end();
console.log('bootstrap done');
