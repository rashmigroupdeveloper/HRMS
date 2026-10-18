/**
 * C-02 / ROLE_TASKS §4: Head of Department. HOD is a DERIVED role (designated
 * department head, or named as an employee's hod_employee_id). Its grants are
 * department-scoped: own department's people and approvals only, no attendance
 * edits, no compensation. The `department_head` approver resolves the HOD.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { getUserPermissionAccess, getUserPermissions, getUserRoleCodes } from '../src/core/rbac/permissions.service.js';
import { resolveApprover } from '../src/modules/workflows/workflow-approvers.js';
import { workflowPermissionSql } from '../src/modules/workflows/workflow-access.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe.skipIf(!DB_URL)('HOD role and department scope', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const uid: Record<string, number> = {};
  const emp: Record<string, number> = {};
  const code: Record<string, string> = {};
  let companyA = 0;
  let companyB = 0;
  let dept1 = 0;
  let dept2 = 0;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = 'hd' + randomUUID().slice(0, 6);
    companyA = (await tx.insertInto('core.companies').values({ code: `${tag}A`, name: `${tag}A`, ecode_prefix: `${tag}A` }).returning('id').executeTakeFirstOrThrow()).id;
    companyB = (await tx.insertInto('core.companies').values({ code: `${tag}B`, name: `${tag}B`, ecode_prefix: `${tag}B` }).returning('id').executeTakeFirstOrThrow()).id;
    const unitA = (await tx.insertInto('core.org_units').values({ company_id: companyA, name: `${tag} unit A` }).returning('id').executeTakeFirstOrThrow()).id;
    const unitB = (await tx.insertInto('core.org_units').values({ company_id: companyB, name: `${tag} unit B` }).returning('id').executeTakeFirstOrThrow()).id;
    dept1 = (await tx.insertInto('core.departments').values({ name: `${tag} Quality` }).returning('id').executeTakeFirstOrThrow()).id;
    dept2 = (await tx.insertInto('core.departments').values({ name: `${tag} Stores` }).returning('id').executeTakeFirstOrThrow()).id;
    const people: [string, number, number, number][] = [
      ['hod', dept1, companyA, unitA],
      ['same', dept1, companyA, unitA], // same department, same company
      ['other', dept2, companyA, unitA], // other department
      ['otherCo', dept1, companyB, unitB], // same department name, other company
      ['override', dept2, companyA, unitA], // other department, but hod_employee_id = hod
    ];
    for (const [key, dept, company, unit] of people) {
      code[key] = `${tag}${key}`.toUpperCase();
      emp[key] = (await tx.insertInto('core.employees').values({
        company_id: company, org_unit_id: unit, department_id: dept, ecode: `${tag}${key}`.toUpperCase(),
        first_name: key, status: 'active', doj: '2020-01-01',
      }).returning('id').executeTakeFirstOrThrow()).id;
    }
    const users: [string, string | null, number | null, number | null][] = [
      ['hod', null, null, emp['hod'] ?? 0], // no role row: HOD is derived
      ['opsA', 'hr_ops', unitA, null],
      ['hrHead', 'hr_head', null, null],
    ];
    for (const [key, role, scopeUnit, employeeId] of users) {
      const u = await tx.insertInto('core.users').values({ email: `${tag}-${key}@hrms.invalid`, password_hash: '!disabled!', employee_id: employeeId, is_active: true }).returning(['id', 'email']).executeTakeFirstOrThrow();
      if (role !== null) {
        const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
        await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: scopeUnit }).execute();
      }
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      uid[key] = u.id;
      t[key] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    }
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });
  const tx = () => { if (!transaction) throw new Error('no transaction'); return transaction; };
  const req = async () => httpRequest(app);
  const auth = (who: string) => ({ Authorization: `Bearer ${t[who] ?? ''}` });
  const directory = async (who: string) => {
    const res = await (await req()).get('/api/employees?pageSize=200').set(auth(who));
    expect(res.status).toBe(200);
    return (res.body as { items: { ecode: string }[] }).items.map((i) => i.ecode);
  };

  it('an undesignated employee is not an HOD', async () => {
    expect((await getUserRoleCodes(tx(), uid['hod'] ?? 0)).has('hod')).toBe(false);
  });

  it('designation: entity hr_ops may designate in its own company only; group-wide needs group scope', async () => {
    const body = { departmentId: dept1, companyId: companyA, employeeId: emp['hod'] };
    const ok = await (await req()).post('/api/core/department-heads').set(auth('opsA')).send(body);
    expect(ok.status).toBe(200);
    expect((await (await req()).post('/api/core/department-heads').set(auth('opsA')).send(body)).status).toBe(400); // duplicate
    expect((await (await req()).post('/api/core/department-heads').set(auth('opsA')).send({ ...body, companyId: companyB })).status).toBe(403);
    expect((await (await req()).post('/api/core/department-heads').set(auth('opsA')).send({ ...body, companyId: null })).status).toBe(403);
    expect((await (await req()).post('/api/core/department-heads').set(auth('opsA')).send({ ...body, departmentId: 999999999 })).status).toBe(404);
    expect((await (await req()).post('/api/core/department-heads').set(auth('hod')).send(body)).status).toBe(403);
    expect((await (await req()).post('/api/core/department-heads').set(auth('opsA')).send({ departmentId: dept1, companyId: companyA, employeeCode: 'NOPE-404' })).status).toBe(404);
    expect((await (await req()).post('/api/core/department-heads').set(auth('opsA')).send({ departmentId: dept1, companyId: companyA })).status).toBe(400);
    // By e-code (case-insensitive), as the admin screen sends it: other company's employee is out of scope.
    expect((await (await req()).post('/api/core/department-heads').set(auth('opsA')).send({ departmentId: dept1, companyId: companyA, employeeCode: (code['otherCo'] ?? '').toLowerCase() })).status).toBe(403);
    const list = await (await req()).get(`/api/core/department-heads?departmentId=${String(dept1)}`).set(auth('opsA'));
    expect(list.status).toBe(200);
    expect((list.body as { heads: { employeeId: number; companyId: number }[] }).heads).toEqual([
      expect.objectContaining({ employeeId: emp['hod'], companyId: companyA }),
    ]);
  });

  it('the designated head derives the hod role with department-scoped, least-privilege grants', async () => {
    expect((await getUserRoleCodes(tx(), uid['hod'] ?? 0)).has('hod')).toBe(true);
    const access = await getUserPermissionAccess(tx(), uid['hod'] ?? 0, 'employee.read');
    expect(access).toMatchObject({ all: false, department: true });
    const held = await getUserPermissions(tx(), uid['hod'] ?? 0, 'write');
    expect(held.has('leave.approve')).toBe(true);
    for (const forbidden of ['attendance.manual_override', 'employee.compensation.read', 'employee.write', 'payroll.run.view']) {
      expect(held.has(forbidden)).toBe(false);
    }
  });

  it('department scope: own department in own company, plus explicit hod_employee_id overrides', async () => {
    let ids = await directory('hod');
    expect(ids).toEqual(expect.arrayContaining([code['hod'], code['same']]));
    expect(ids).not.toContain(code['other']);
    expect(ids).not.toContain(code['otherCo']);
    expect(ids).not.toContain(code['override']);
    await tx().updateTable('core.employees').set({ hod_employee_id: emp['hod'] ?? 0 }).where('id', '=', emp['override'] ?? 0).execute();
    ids = await directory('hod');
    expect(ids).toContain(code['override']);
  });

  it('approvals: department_head resolves the HOD, and leave authority stops at the department', async () => {
    const approver = async (subject: string) => resolveApprover(tx(), 'department_head', emp[subject] ?? 0, 'travel_advance_domestic');
    expect((await approver('same'))?.userId).toBe(uid['hod']);
    expect((await approver('override'))?.userId).toBe(uid['hod']);
    expect(await approver('other')).toBeNull(); // vacancy → routing hold
    expect(await approver('otherCo')).toBeNull();
    expect(await approver('hod')).toBeNull(); // never their own approver
    const canApproveLeave = async (subject: string) => {
      const row = await tx().selectFrom('core.users').select('id').where('id', '=', uid['hod'] ?? 0)
        .where(workflowPermissionSql(uid['hod'] ?? 0, 'leave', emp[subject] ?? 0)).executeTakeFirst();
      return row !== undefined;
    };
    expect(await canApproveLeave('same')).toBe(true);
    expect(await canApproveLeave('override')).toBe(true);
    expect(await canApproveLeave('other')).toBe(false);
    expect(await canApproveLeave('otherCo')).toBe(false);
  });

  it('removal is scoped and audited; a group head covers every company', async () => {
    const heads = await (await req()).get('/api/core/department-heads').set(auth('hrHead'));
    const mine = (heads.body as { heads: { id: number; employeeId: number }[] }).heads.find((h) => h.employeeId === emp['hod']);
    expect(mine).toBeDefined();
    expect((await (await req()).post(`/api/core/department-heads/${String(mine?.id ?? 0)}/remove`).set(auth('hod')).send({})).status).toBe(403);
    expect((await (await req()).post(`/api/core/department-heads/${String(mine?.id ?? 0)}/remove`).set(auth('opsA')).send({})).status).toBe(200);
    expect((await (await req()).post(`/api/core/department-heads/${String(mine?.id ?? 0)}/remove`).set(auth('opsA')).send({})).status).toBe(404);
    const audit = await tx().selectFrom('core.audit_log').select('action').where('entity', '=', 'core.department_heads').where('entity_id', '=', mine?.id ?? 0).execute();
    expect(audit.map((a) => a.action).sort()).toEqual(['department_head_added', 'department_head_removed']);
    // Group-wide designation (company null) by the group HR head reaches the other company too.
    const group = await (await req()).post('/api/core/department-heads').set(auth('hrHead')).send({ departmentId: dept1, companyId: null, employeeId: emp['hod'] });
    expect(group.status).toBe(200);
    expect((await resolveApprover(tx(), 'department_head', emp['otherCo'] ?? 0, 'travel_advance_domestic'))?.userId).toBe(uid['hod']);
    expect((await (await req()).post(`/api/core/department-heads/${String((group.body as { id: number }).id)}/remove`).set(auth('opsA')).send({})).status).toBe(403);
  });
});
