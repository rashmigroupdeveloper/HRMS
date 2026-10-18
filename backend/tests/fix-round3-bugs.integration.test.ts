/** E2E-028 (hr_ops holidays + month lock in scope), E2E-033 (recompute accepts {}), E2E-024 (partition race). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, type ControlledTransaction, type Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { httpRequest } from './http-client.js';
import { roleUser } from './fixtures/role-users.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe.skipIf(!DB_URL)('fix round 3 bugs', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  let companyA = 0;
  let companyB = 0;
  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    tx = await db.startTransaction().execute();
    const tag = ('R3' + randomUUID().slice(0, 5)).toUpperCase();
    companyA = (await tx.insertInto('core.companies').values({ code: `${tag}A`, name: `${tag}A`, ecode_prefix: `${tag}A` }).returning('id').executeTakeFirstOrThrow()).id;
    companyB = (await tx.insertInto('core.companies').values({ code: `${tag}B`, name: `${tag}B`, ecode_prefix: `${tag}B` }).returning('id').executeTakeFirstOrThrow()).id;
    const unitA = (await tx.insertInto('core.org_units').values({ company_id: companyA, name: `${tag} A` }).returning('id').executeTakeFirstOrThrow()).id;
    const mail = (k: string) => `${tag.toLowerCase()}-${k}@hrms.invalid`;
    t['ops'] = (await roleUser(tx, { email: mail('ops'), role: 'hr_ops', scopeOrgUnitId: unitA, jwtSecret: JWT_SECRET })).token;
    t['it'] = (await roleUser(tx, { email: mail('it'), role: 'it_admin', jwtSecret: JWT_SECRET })).token;
    t['head'] = (await roleUser(tx, { email: mail('head'), role: 'hr_head', jwtSecret: JWT_SECRET })).token;
    t['emp'] = (await roleUser(tx, { email: mail('emp'), role: 'employee', jwtSecret: JWT_SECRET })).token;
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (!tx.isRolledBack && !tx.isCommitted) await tx.rollback().execute(); } finally { await db.destroy(); }
  });
  const call = async (who: string, method: 'get' | 'post' | 'put', path: string, body?: object) => {
    const r = (await httpRequest(app))[method](path).set('Authorization', `Bearer ${t[who] ?? ''}`);
    return body ? r.send(body) : r;
  };

  it('E2E-028: hr_ops adds a holiday and opens the month-lock checklist for its own company only', async () => {
    expect((await call('ops', 'put', '/api/attendance/config/holidays', { date: '2099-08-15', name: 'Independence Day', companyId: companyA })).status).toBe(200);
    expect((await call('ops', 'put', '/api/attendance/config/holidays', { date: '2099-08-15', name: 'X', companyId: companyB })).status).toBe(403);
    expect((await call('ops', 'put', '/api/attendance/config/holidays', { date: '2099-08-15', name: 'X' })).status).toBe(403);
    expect((await call('emp', 'put', '/api/attendance/config/holidays', { date: '2099-08-15', name: 'X', companyId: companyA })).status).toBe(403);
    expect((await call('ops', 'get', `/api/attendance/month-lock/checklist?companyId=${String(companyA)}&month=2026-05`)).status).toBe(200);
    expect((await call('ops', 'get', `/api/attendance/month-lock/checklist?companyId=${String(companyB)}&month=2026-05`)).status).toBe(403);
  });

  it('E2E-004: hr_ops lists routing holds without admin.settings; employees cannot', async () => {
    expect((await call('ops', 'get', '/api/workflows/routing-holds')).status).toBe(200);
    expect((await call('emp', 'get', '/api/workflows/routing-holds')).status).toBe(403);
    expect((await call('ops', 'post', '/api/workflows/requests/999999999/retry-routing', { reason: 'fixed manager' })).status).toBeGreaterThanOrEqual(400);
  });

  it('E2E-005: hr_head reads and exports the access matrix but cannot change it', async () => {
    const m = await call('head', 'get', '/api/rbac/matrix');
    expect(m.status).toBe(200);
    const x = await call('head', 'get', '/api/rbac/matrix/export');
    expect(x.status).toBe(200);
    expect(Buffer.from((x.body as { base64: string }).base64, 'base64').subarray(0, 2).toString()).toBe('PK');
    expect((await call('head', 'post', '/api/rbac/grants', { role: 'employee', permission: 'admin.roles' })).status).toBe(403);
    expect((await call('emp', 'get', '/api/rbac/matrix')).status).toBe(403);
  });

  it('letters.issue refuses an employee outside the issuer scope with 403 (scope before merge validation)', async () => {
    const other = (await tx.insertInto('core.org_units').values({ company_id: companyB, name: 'other' }).returning('id').executeTakeFirstOrThrow()).id;
    const e = (await tx.insertInto('core.employees').values({ company_id: companyB, org_unit_id: other, ecode: `X${randomUUID().slice(0, 6).toUpperCase()}`, first_name: 'Out', status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    expect((await call('ops', 'post', '/api/letters/issue', { employeeId: e, templateCode: 'experience' })).status).toBe(403);
  });

  it('E2E-039 / E2E-013 / E2E-007: leave register, delegation by e-code, correction by e-code', async () => {
    const unit = (await tx.selectFrom('core.org_units').select('id').where('company_id', '=', companyA).executeTakeFirstOrThrow()).id;
    const ec = `RG${randomUUID().slice(0, 6).toUpperCase()}`;
    const emp = (await tx.insertInto('core.employees').values({ company_id: companyA, org_unit_id: unit, ecode: ec, first_name: 'Reg', status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    const cl = await tx.selectFrom('lv.leave_types').select(['id', 'code']).limit(1).executeTakeFirst();
    if (cl) await tx.insertInto('lv.ledger').values({ employee_id: emp, leave_type_id: cl.id, txn_type: 'accrual', delta: '2.5', effective_date: new Date('2026-01-01T00:00:00Z') }).execute();
    const reg = await call('ops', 'get', `/api/leave/register?q=${ec}`);
    expect(reg.status).toBe(200);
    const body = reg.body as { rows: { ecode: string; balances: Record<string, number>; onLeave: unknown }[] };
    expect(body.rows.map((r) => r.ecode)).toEqual([ec]);
    if (cl) expect(body.rows[0]?.balances[cl.code]).toBe(2.5);
    expect(((await call('ops', 'get', '/api/leave/register?onLeaveOnly=true')).body as { rows: unknown[] }).rows).toEqual([]);
    expect((await call('emp', 'get', '/api/leave/register')).status).toBe(403);

    const mate = await roleUser(tx, { email: `${ec.toLowerCase()}@hrms.invalid`, role: 'employee', employeeId: emp, jwtSecret: JWT_SECRET });
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect((await call('head', 'put', '/api/workflows/delegations', { to: 'nobody-x@hrms.invalid', fromDate: future, toDate: future })).status).toBe(404);
    expect((await call('head', 'put', '/api/workflows/delegations', { fromDate: future, toDate: future })).status).toBe(400);
    expect((await call('head', 'put', '/api/workflows/delegations', { to: ec.toLowerCase(), fromDate: future, toDate: future })).status).toBe(200);
    const list = (await call('head', 'get', '/api/workflows/delegations')).body as { id: number; toUserId: number }[];
    expect(list.some((d) => d.toUserId === mate.userId)).toBe(true);
    const del = await (await httpRequest(app)).delete(`/api/workflows/delegations/${String(list[0]?.id ?? 0)}`).set('Authorization', `Bearer ${t['head'] ?? ''}`);
    expect(del.status).toBe(200);

    const ov = await call('ops', 'put', '/api/attendance/days/override', { ecode: ec.toLowerCase(), date: '2026-05-04', status: 'P', reason: 'gate reader down, verified by supervisor' });
    expect([200, 409]).toContain(ov.status);
    expect((await call('ops', 'put', '/api/attendance/days/override', { ecode: 'NOPE00', date: '2026-05-04', status: 'P', reason: 'xxxxxxxx' })).status).toBe(404);
    expect((await call('ops', 'put', '/api/attendance/days/override', { date: '2026-05-04', status: 'P', reason: 'xxxxxxxx' })).status).toBe(400);
    expect((await call('it', 'post', '/api/attendance/recompute', { ecode: ec, date: '2026-05-04' })).status).toBe(200);
  });

  it('E2E-033: POST /attendance/recompute with {} drains; a partial body is still refused', async () => {
    const r = await call('it', 'post', '/api/attendance/recompute', {});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ outcome: null });
    expect((await call('it', 'post', '/api/attendance/recompute', { employeeId: 1 })).status).toBe(400);
  });

  it('E2E-024: ensure_swipe_partition is idempotent and creates a missing month', async () => {
    await sql`SELECT att.ensure_swipe_partition('2091-03-10'::date)`.execute(tx);
    await sql`SELECT att.ensure_swipe_partition('2091-03-20'::date)`.execute(tx);
    const n = await sql<{ n: number }>`SELECT count(*)::int AS n FROM pg_class WHERE relname = 'swipe_events_209103'`.execute(tx);
    expect(n.rows[0]?.n).toBe(1);
  });
});
