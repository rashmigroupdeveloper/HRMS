/**
 * Handover item 2: employee master create/edit (minors, duplicate UAN/ESIC,
 * scope), org masters CRUD with company statutory IDs (super_admin only),
 * and ESS family changes routed to HR approval.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { act } from '../src/modules/workflows/index.js';
import { validateMaster } from '../src/modules/core/masters.service.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe('org master validation (pure)', () => {
  it('normalizes and validates company statutory IDs', () => {
    expect(validateMaster('companies', { code: 'abc', name: 'X', ecode_prefix: 'abc', pan: 'aabcr1234k', gstin: '19AABCR1234K1Z5', tan: 'CALR12345A' }, true))
      .toMatchObject({ code: 'ABC', pan: 'AABCR1234K', gstin: '19AABCR1234K1Z5' });
    expect(() => validateMaster('companies', { code: 'A', name: 'X', ecode_prefix: 'AB' }, true)).toThrow(/2–10/);
    expect(() => validateMaster('companies', { code: 'AB', name: 'X', ecode_prefix: 'AB', tan: 'bad' }, true)).toThrow(/TAN/);
    expect(() => validateMaster('companies', { code: 'AB', name: 'X', ecode_prefix: 'AB', pan: 'AABCR1234K', gstin: '19AABCX1234K1Z5' }, true)).toThrow(/GSTIN/);
    expect(() => validateMaster('companies', { esic_code: '123' }, false)).toThrow(/ESIC/);
    expect(() => validateMaster('departments', {}, true)).toThrow(/required/);
    expect(() => validateMaster('departments', { name: '  ' }, false)).toThrow(/blank/);
    expect(() => validateMaster('locations', { company_id: 1, name: 'L', state_code: 'WBX' }, true)).toThrow(/State/);
    expect(validateMaster('locations', { company_id: 1, name: 'L', state_code: 'wb', junk: 'x' }, true)).toEqual({ company_id: 1, name: 'L', state_code: 'WB' });
    expect(() => validateMaster('grades', { rank: -1 }, false)).toThrow(/Rank/);
  });
});

describe.skipIf(!DB_URL)('employee master, org masters and family (API)', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const uid: Record<string, number> = {};
  let tag = '';
  let company = 0;
  let otherCompany = 0;
  let subject = 0;
  let subjectCode = '';

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    tag = ('em' + randomUUID().slice(0, 5)).toUpperCase();
    company = (await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    otherCompany = (await tx.insertInto('core.companies').values({ code: `${tag}X`, name: `${tag}X`, ecode_prefix: `${tag}X` }).returning('id').executeTakeFirstOrThrow()).id;
    const unit = (await tx.insertInto('core.org_units').values({ company_id: company, name: `${tag} unit` }).returning('id').executeTakeFirstOrThrow()).id;
    await tx.insertInto('core.org_units').values({ company_id: otherCompany, name: `${tag}X unit` }).execute();
    subjectCode = `${tag}E1`;
    subject = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, ecode: subjectCode, first_name: 'Sub', status: 'active', doj: '2020-01-01', uan: '100200300400' }).returning('id').executeTakeFirstOrThrow()).id;
    const users: [string, string | null, number | null, number | null][] = [['ops', 'hr_ops', null, unit], ['ess', 'employee', subject, null], ['admin', 'super_admin', null, null]];
    for (const [key, role, employeeId, scopeUnit] of users) {
      const u = await tx.insertInto('core.users').values({ email: `${tag.toLowerCase()}-${key}@hrms.invalid`, password_hash: '!disabled!', employee_id: employeeId, is_active: true }).returning(['id', 'email']).executeTakeFirstOrThrow();
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
  const call = async (method: 'get' | 'post' | 'patch' | 'delete', who: string, path: string, body?: unknown) => {
    const r = (await httpRequest(app))[method](path).set('Authorization', `Bearer ${t[who] ?? ''}`);
    return body === undefined ? r : r.send(body as object);
  };

  it('hr_ops creates an employee; minors, duplicate UAN/ESIC and out-of-scope units are refused', async () => {
    const base = { companyCode: tag, firstName: 'Ananya', doj: '2026-11-02', orgUnit: `${tag} unit` };
    const minor = await call('post', 'ops', '/api/employees', { ...base, dob: '2010-01-01' });
    expect(minor.status).toBe(400);
    expect(JSON.stringify(minor.body)).toMatch(/minors/);
    const dupUan = await call('post', 'ops', '/api/employees', { ...base, uan: '100200300400' });
    expect(dupUan.status).toBe(400);
    expect(JSON.stringify(dupUan.body)).toMatch(new RegExp(`Already used by ${subjectCode}`));
    const otherUnit = await call('post', 'ops', '/api/employees', { ...base, companyCode: `${tag}X`, orgUnit: `${tag}X unit` });
    expect(otherUnit.status).toBe(400);
    expect(JSON.stringify(otherUnit.body)).toMatch(/scope/);
    const ok = await call('post', 'ops', '/api/employees', { ...base, dob: '1998-07-14', esicNo: '1234567890', pan: 'ABCPG1234K' });
    expect(ok.status).toBe(200);
    const created = ok.body as { ecode: string; employeeId: number };
    expect(created.ecode.startsWith(tag)).toBe(true);
    const dupEsic = await call('patch', 'ops', `/api/employees/${subjectCode}`, { esicNo: '1234567890' });
    expect(dupEsic.status).toBe(400);
    const edit = await call('patch', 'ops', `/api/employees/${subjectCode}`, { mobile: '9876543210', lastName: 'Kumar' });
    expect(edit.status).toBe(200);
    const row = await tx().selectFrom('core.employees').select(['mobile', 'last_name', 'uan']).where('id', '=', subject).executeTakeFirstOrThrow();
    expect(row).toEqual({ mobile: '9876543210', last_name: 'Kumar', uan: '100200300400' });
    expect((await call('patch', 'ops', '/api/employees/NOPE0000', { mobile: '9876543210' })).status).toBe(404);
    expect((await call('post', 'ess', '/api/employees', { ...base, dob: '1990-01-01' })).status).toBe(403);
  });

  it('only super_admin edits org masters; a master in use cannot be deleted', async () => {
    expect((await call('post', 'ops', '/api/core/masters/departments', { values: { name: `${tag} Dept` } })).status).toBe(403);
    const list = await call('get', 'ops', '/api/core/masters/companies');
    expect(list.status).toBe(200);
    const codes = (list.body as { rows: { code: string }[] }).rows.map((r) => r.code);
    expect(codes).toContain(tag);
    expect(codes).not.toContain(`${tag}X`); // entity-bound HR sees its own companies only
    const dept = await call('post', 'admin', '/api/core/masters/departments', { values: { name: `${tag} Dept` } });
    expect(dept.status).toBe(200);
    const deptId = (dept.body as { id: number }).id;
    expect((await call('patch', 'admin', `/api/core/masters/departments/${String(deptId)}`, { values: { name: `${tag} Dept 2` } })).status).toBe(200);
    expect((await call('patch', 'admin', `/api/core/masters/companies/${String(company)}`, { values: { tan: 'CALR12345A', pf_establishment_code: 'WBCAL0012345' } })).status).toBe(200);
    expect((await call('patch', 'admin', `/api/core/masters/companies/${String(company)}`, { values: { tan: 'X' } })).status).toBe(400);
    expect((await call('delete', 'admin', `/api/core/masters/companies/${String(company)}`)).status).toBe(400);
    await tx().updateTable('core.employees').set({ department_id: deptId }).where('id', '=', subject).execute();
    expect((await call('delete', 'admin', `/api/core/masters/departments/${String(deptId)}`)).status).toBe(400);
    await tx().updateTable('core.employees').set({ department_id: null }).where('id', '=', subject).execute();
    expect((await call('delete', 'admin', `/api/core/masters/departments/${String(deptId)}`)).status).toBe(200);
    expect((await call('delete', 'admin', `/api/core/masters/departments/${String(deptId)}`)).status).toBe(404);
    const unit = await call('post', 'admin', '/api/core/masters/org_units', { values: { company_id: company, name: `${tag} child` } });
    const unitId = (unit.body as { id: number }).id;
    const otherUnit = await tx().selectFrom('core.org_units').select('id').where('company_id', '=', otherCompany).executeTakeFirstOrThrow();
    expect((await call('patch', 'admin', `/api/core/masters/org_units/${String(unitId)}`, { values: { parent_id: otherUnit.id } })).status).toBe(400);
    expect((await call('patch', 'admin', `/api/core/masters/org_units/${String(unitId)}`, { values: { parent_id: unitId } })).status).toBe(400);
    expect((await call('patch', 'admin', `/api/core/masters/org_units/${String(unitId)}`, { values: {} })).status).toBe(400);
  });

  it('ESS family change waits for HR approval; HR edits directly with validation', async () => {
    const spouse = { action: 'add', member: { name: 'Riya', relation: 'spouse', dob: '1995-03-01', isNominee: true, nomineeSharePct: 60 } };
    const req = await call('post', 'ess', '/api/employees/me/family/requests', spouse);
    expect(req.status).toBe(200);
    expect((req.body as { status: string }).status).toBe('pending_hr_approval');
    let mine = (await call('get', 'ess', '/api/employees/me/family')).body as { members: unknown[]; pending: unknown[] };
    expect(mine.members).toHaveLength(0);
    expect(mine.pending).toHaveLength(1);
    // HR ops approves in the workflow inbox.
    const wfId = (req.body as { workflowRequestId: number }).workflowRequestId;
    const step = await tx().selectFrom('wf.request_steps').select('approver_user_id').where('request_id', '=', wfId).executeTakeFirstOrThrow();
    await act(tx(), { requestId: wfId, actorUserId: step.approver_user_id, action: 'approve' });
    mine = (await call('get', 'ess', '/api/employees/me/family')).body as { members: unknown[]; pending: unknown[] };
    expect(mine.members).toHaveLength(1);
    expect(mine.pending).toHaveLength(0);

    // Validation: minor spouse, second spouse, nominee over 100%, bad Aadhaar, future DOB, ESIC dependent sibling.
    const bad = [
      { action: 'add', member: { name: 'Kid', relation: 'spouse', dob: '2015-01-01' } },
      { action: 'add', member: { name: 'Second', relation: 'spouse' } },
      { action: 'add', member: { name: 'Mom', relation: 'mother', isNominee: true, nomineeSharePct: 50 } },
      { action: 'add', member: { name: 'Dad', relation: 'father', aadhaar: '234123412345' } },
      { action: 'add', member: { name: 'Baby', relation: 'son', dob: '2999-01-01' } },
      { action: 'add', member: { name: 'Bro', relation: 'brother', isEsicDependent: true } },
      { action: 'add', member: { name: 'N', relation: 'son', isNominee: true } },
      { action: 'update', memberId: 999999999, member: { name: 'X', relation: 'son' } },
      { action: 'add' },
    ];
    for (const b of bad) expect((await call('post', 'ops', `/api/employees/${subjectCode}/family`, b)).status, JSON.stringify(b)).toBeGreaterThanOrEqual(400);

    const son = await call('post', 'ops', `/api/employees/${subjectCode}/family`, { action: 'add', member: { name: 'Aarav', relation: 'son', dob: '2019-05-05', aadhaar: '234123412346', isEsicDependent: true, isNominee: true, nomineeSharePct: 40 } });
    expect(son.status).toBe(200);
    const sonId = (son.body as { memberId: number }).memberId;
    expect((await call('post', 'ops', `/api/employees/${subjectCode}/family`, { action: 'add', member: { name: 'Twin', relation: 'son', aadhaar: '234123412346' } })).status).toBe(400);
    expect((await call('post', 'ops', `/api/employees/${subjectCode}/family`, { action: 'update', memberId: sonId, member: { name: 'Aarav K', relation: 'son', dob: '2019-05-05' } })).status).toBe(200);
    const stored = await tx().selectFrom('core.employee_family').select(['name', 'aadhaar']).where('id', '=', sonId).executeTakeFirstOrThrow();
    expect(stored).toEqual({ name: 'Aarav K', aadhaar: '234123412346' }); // blank Aadhaar on edit keeps the stored number
    const view = (await call('get', 'ops', `/api/employees/${subjectCode}/family`)).body as { members: { aadhaarMasked: string | null }[] };
    expect(view.members.map((m) => m.aadhaarMasked)).toContain('XXXX-XXXX-2346');
    expect((await call('post', 'ops', `/api/employees/${subjectCode}/family`, { action: 'remove', memberId: sonId })).status).toBe(200);

    // A rejected ESS request never reaches the master.
    const r2 = await call('post', 'ess', '/api/employees/me/family/requests', { action: 'add', member: { name: 'Mother', relation: 'mother' } });
    const wf2 = (r2.body as { workflowRequestId: number }).workflowRequestId;
    const step2 = await tx().selectFrom('wf.request_steps').select('approver_user_id').where('request_id', '=', wf2).executeTakeFirstOrThrow();
    await act(tx(), { requestId: wf2, actorUserId: step2.approver_user_id, action: 'reject', comment: 'Need proof' });
    const after = (await call('get', 'ess', '/api/employees/me/family')).body as { members: { name: string }[]; pending: unknown[] };
    expect(after.members.map((m) => m.name)).toEqual(['Riya']);
    expect(after.pending).toHaveLength(0);
    expect((await call('get', 'ess', `/api/employees/${tag}X999/family`)).status).toBe(404);
    expect((await call('get', 'admin', '/api/employees/me/family')).status).toBe(404);
  });
});
