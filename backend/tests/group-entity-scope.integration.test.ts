/**
 * Group vs entity scope (MNC isolation): a role assigned with NO org unit is
 * group-wide; the same role assigned to an org unit is confined to that entity,
 * even for permissions the catalog grants at 'all'. Covers payroll runs (list,
 * read, create, act) and the permission-access resolver.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { getUserPermissionAccess } from '../src/core/rbac/permissions.service.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe.skipIf(!DB_URL)('group vs entity scope', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const uid: Record<string, number> = {};
  const co: Record<string, number> = {};
  const unit: Record<string, number> = {};
  const run: Record<string, number> = {};
  const ecode: Record<string, string> = {};

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = 'gs' + randomUUID().slice(0, 6);
    for (const k of ['A', 'B']) {
      co[k] = (await tx.insertInto('core.companies').values({ code: `${tag}${k}`, name: `${tag}${k}`, ecode_prefix: `${tag}${k}` }).returning('id').executeTakeFirstOrThrow()).id;
      unit[k] = (await tx.insertInto('core.org_units').values({ company_id: co[k] ?? 0, name: `${tag}${k} unit` }).returning('id').executeTakeFirstOrThrow()).id;
      ecode[k] = `${tag}${k}1`.toUpperCase();
      await tx.insertInto('core.employees').values({ company_id: co[k] ?? 0, org_unit_id: unit[k] ?? 0, ecode: ecode[k] ?? '', first_name: k, status: 'active', doj: '2020-01-01' }).execute();
      run[k] = (await tx.insertInto('pay.payroll_runs').values({ company_id: co[k] ?? 0, month: '2097-03-01', run_type: 'regular', status: 'draft' }).returning('id').executeTakeFirstOrThrow()).id;
    }
    const users: [string, string, number | null][] = [
      ['payA', 'payroll_admin', unit['A'] ?? 0], // entity-scoped payroll admin
      ['payGroup', 'payroll_admin', null],
      ['hrHead', 'hr_head', null],
      ['superAdmin', 'super_admin', null],
      ['opsA', 'hr_ops', unit['A'] ?? 0],
    ];
    for (const [key, role, scopeUnit] of users) {
      const u = await tx.insertInto('core.users').values({ email: `${tag}-${key}@hrms.invalid`, password_hash: '!disabled!' }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: scopeUnit }).execute();
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
  const post = async (who: string, path: string, body: unknown) =>
    (await httpRequest(app)).post(path).set('Authorization', `Bearer ${t[who] ?? ''}`).send(body as object);

  it('resolver: an entity-bound assignment confines an "all" grant to its unit', async () => {
    const bound = await getUserPermissionAccess(tx(), uid['payA'] ?? 0, 'payroll.run.manage', 'write');
    expect(bound).toMatchObject({ all: false, orgUnitIds: [unit['A']] });
    const group = await getUserPermissionAccess(tx(), uid['payGroup'] ?? 0, 'payroll.run.manage', 'write');
    expect(group?.all).toBe(true);
  });

  it('entity-scoped payroll admin sees and acts on its own entity only', async () => {
    const list = await post('payA', '/api/payroll/runs/list', {});
    expect(list.status).toBe(200);
    const ids = (list.body as { id: number }[]).map((r) => r.id);
    expect(ids).toContain(run['A']);
    expect(ids).not.toContain(run['B']);
    expect((await post('payA', '/api/payroll/runs/get', { id: run['B'] })).status).toBe(403);
    expect((await post('payA', '/api/payroll/runs/lockInputs', { id: run['B'] })).status).toBe(403);
    expect((await post('payA', '/api/payroll/runs/list', { company_id: co['B'] })).status).toBe(403);
    expect((await post('payA', '/api/payroll/runs/create', { company_id: co['B'], month: '2097-04-01' })).status).toBe(403);
    expect((await post('payA', '/api/payroll/runs/get', { id: run['A'] })).status).toBe(200);
    const inputs = await (await httpRequest(app)).get(`/api/payroll/runs/${String(run['B'])}/inputs`).set('Authorization', `Bearer ${t['payA'] ?? ''}`);
    expect(inputs.status).toBe(403);
    expect((await post('payA', '/api/payroll/runs/get', { id: 987654321 })).status).toBe(404);
  });

  it('group roles (hr_head, super_admin, unbound payroll admin) see every entity', async () => {
    for (const who of ['hrHead', 'superAdmin', 'payGroup']) {
      const list = await post(who, '/api/payroll/runs/list', {});
      expect(list.status).toBe(200);
      const ids = (list.body as { id: number }[]).map((r) => r.id);
      expect(ids).toEqual(expect.arrayContaining([run['A'], run['B']]));
    }
    expect((await post('payGroup', '/api/payroll/runs/lockInputs', { id: run['B'] })).status).toBe(200);
    // hr_head's payroll.run.view is readonly — it may read but never manage.
    expect((await post('hrHead', '/api/payroll/runs/get', { id: run['B'] })).status).toBe(200);
    expect((await post('hrHead', '/api/payroll/runs/lockInputs', { id: run['A'] })).status).toBe(403);
  });

  it('absconding by e-code: entity hr_ops confined to its unit; group hr_head acts on both entities', async () => {
    const body = (code: string) => ({ ecode: code, reason: 'Absent without intimation', lastWorkingDay: '2097-02-10' });
    expect((await post('opsA', '/api/lifecycle/separations/absconding', { reason: 'Absent without intimation', lastWorkingDay: '2097-02-10' })).status).toBe(400);
    expect((await post('opsA', '/api/lifecycle/separations/absconding', body('NOSUCHCODE1'))).status).toBe(404);
    expect((await post('opsA', '/api/lifecycle/separations/absconding', body(ecode['B'] ?? ''))).status).toBe(403);
    const ownUnit = await post('opsA', '/api/lifecycle/separations/absconding', body((ecode['A'] ?? '').toLowerCase()));
    expect(ownUnit.status).toBe(200);
    const crossEntity = await post('hrHead', '/api/lifecycle/separations/absconding', body(ecode['B'] ?? ''));
    expect(crossEntity.status).toBe(200);
  });

  it('group-wide statutory tables cannot be changed by an entity-bound payroll admin', async () => {
    expect((await post('payA', '/api/payroll/config/statutory-rates', { scheme: 'ESIC', param: 'wage_ceiling', value: 21000, effectiveFrom: '2097-04-01', sourceNote: 'entity attempt' })).status).toBe(403);
    const res = await (await httpRequest(app)).put('/api/payroll/config/pt-slabs').set('Authorization', `Bearer ${t['payA'] ?? ''}`).send({ stateCode: 'ZZ', effectiveFrom: '2097-04-01', basis: 'earned_monthly', slabs: [{ minMonthly: 0, maxMonthly: null, amount: 0 }] });
    expect(res.status).toBe(403);
    expect((await post('payGroup', '/api/payroll/config/statutory-rates', { scheme: 'ESIC', param: 'wage_ceiling', value: 21000, effectiveFrom: '2097-04-01', sourceNote: 'group change' })).status).toBe(200);
  });
});
