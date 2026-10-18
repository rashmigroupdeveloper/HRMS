/** E2E-008: probation board readable by hr_ops (org unit) / managers (subtree); only hr_head decides. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql, type ControlledTransaction, type Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { httpRequest } from './http-client.js';
import { roleUser } from './fixtures/role-users.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe.skipIf(!DB_URL)('probation board scope', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const rv: Record<string, number> = {};

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = ('pb' + randomUUID().slice(0, 5)).toUpperCase();
    const company = (await tx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    const unitA = (await tx.insertInto('core.org_units').values({ company_id: company, name: `${tag} A` }).returning('id').executeTakeFirstOrThrow()).id;
    const unitB = (await tx.insertInto('core.org_units').values({ company_id: company, name: `${tag} B` }).returning('id').executeTakeFirstOrThrow()).id;
    const mk = async (code: string, unit: number, mgr: number | null) => (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, ecode: `${tag}${code}`, first_name: code, status: 'active', doj: '2026-05-01', reporting_manager_id: mgr }).returning('id').executeTakeFirstOrThrow()).id;
    const boss = await mk('M', unitA, null);
    const a = await mk('A', unitA, boss);
    const b = await mk('B', unitB, null);
    await tx.insertInto('core.reporting_tree').values({ manager_id: boss, employee_id: a, depth: 1 }).onConflict((oc) => oc.columns(['manager_id', 'employee_id']).doNothing()).execute();
    const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    for (const [k, e] of [['a', a], ['b', b]] as const) {
      rv[k] = (await tx.insertInto('core.probation_reviews').values({ employee_id: e, due_date: sql<Date>`${due}::date`, ratings: '{}', updated_at: sql<Date>`now()` }).returning('id').executeTakeFirstOrThrow()).id;
    }
    const mail = (k: string) => `${tag.toLowerCase()}-${k}@hrms.invalid`;
    t['ops'] = (await roleUser(tx, { email: mail('ops'), role: 'hr_ops', scopeOrgUnitId: unitA, jwtSecret: JWT_SECRET })).token;
    t['mgr'] = (await roleUser(tx, { email: mail('mgr'), role: 'manager', employeeId: boss, jwtSecret: JWT_SECRET })).token;
    t['emp'] = (await roleUser(tx, { email: mail('emp'), role: 'employee', employeeId: b, jwtSecret: JWT_SECRET })).token;
    t['head'] = (await roleUser(tx, { email: mail('head'), role: 'hr_head', jwtSecret: JWT_SECRET })).token;
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });
  const call = async (method: 'get' | 'post', who: string, path: string, body?: object) => {
    const r = (await httpRequest(app))[method](path).set('Authorization', `Bearer ${t[who] ?? ''}`);
    return body === undefined ? r : r.send(body);
  };
  const ids = (body: unknown) => (body as { reviews: { id: number }[] }).reviews.map((r) => r.id);

  it('lists only in-scope reviews and alerts', async () => {
    const ops = await call('get', 'ops', '/api/lifecycle/probation/reviews');
    expect(ops.status).toBe(200);
    expect(ids(ops.body)).toContain(rv['a']);
    expect(ids(ops.body)).not.toContain(rv['b']);
    const mgr = await call('get', 'mgr', '/api/lifecycle/probation/reviews');
    expect(ids(mgr.body)).toEqual([rv['a']]);
    const head = await call('get', 'head', '/api/lifecycle/probation/reviews');
    expect(ids(head.body)).toEqual(expect.arrayContaining([rv['a'], rv['b']]));
    const alerts = (await call('get', 'mgr', '/api/lifecycle/probation/alerts')).body as { d30ReviewIds: number[] };
    expect(alerts.d30ReviewIds).toEqual([rv['a']]);
    expect((await call('get', 'emp', '/api/lifecycle/probation/reviews')).status).toBe(403);
  });

  it('manager evaluates own report only; only hr_head decides', async () => {
    const body = { managerRecommendation: 'confirm', reviewNotes: 'Good work all round' };
    expect((await call('post', 'mgr', '/api/lifecycle/probation/evaluate', { reviewId: rv['b'], ...body })).status).toBe(403);
    expect((await call('post', 'mgr', '/api/lifecycle/probation/evaluate', { reviewId: 999999999, ...body })).status).toBe(404);
    expect((await call('post', 'mgr', '/api/lifecycle/probation/evaluate', { reviewId: rv['a'], ...body })).status).toBe(200);
    expect((await call('post', 'mgr', '/api/lifecycle/probation/decide', { reviewId: rv['a'], outcome: 'extended', extensionMonths: 3 })).status).toBe(403);
    expect((await call('post', 'ops', '/api/lifecycle/probation/decide', { reviewId: rv['a'], outcome: 'extended', extensionMonths: 3 })).status).toBe(403);
    const d = await call('post', 'head', '/api/lifecycle/probation/decide', { reviewId: rv['a'], outcome: 'extended', extensionMonths: 3 });
    expect(d.status).toBe(200);
    const next = (await call('get', 'head', '/api/lifecycle/probation/reviews?status=pending')).body as { reviews: { employeeId: number; dueDate: string; id: number }[] };
    const extended = next.reviews.find((r) => r.id !== rv['a'] && r.id !== rv['b']);
    expect(extended?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('E2E-002: my notice policy comes from settings + category', async () => {
    const r = await call('get', 'emp', '/api/lifecycle/separations/my-notice');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ noticePeriodDays: 30, category: null });
    expect((await call('get', 'head', '/api/lifecycle/separations/my-notice')).status).toBe(404);
  });
});
