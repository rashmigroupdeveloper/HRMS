/** C-35 / item 4: holiday calendar API by group / company / plant / location, with entity scope. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { ControlledTransaction, Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { httpRequest } from './http-client.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe.skipIf(!DB_URL)('holiday calendar API', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  let company = 0;
  let other = 0;
  let plant = 0;
  let otherLoc = 0;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = ('hc' + randomUUID().slice(0, 5)).toUpperCase();
    company = (await tx.insertInto('core.companies').values({ code: tag, name: `${tag} Ltd`, ecode_prefix: tag }).returning('id').executeTakeFirstOrThrow()).id;
    other = (await tx.insertInto('core.companies').values({ code: `${tag}O`, name: `${tag}O`, ecode_prefix: `${tag}O` }).returning('id').executeTakeFirstOrThrow()).id;
    const unit = (await tx.insertInto('core.org_units').values({ company_id: company, name: `${tag} u` }).returning('id').executeTakeFirstOrThrow()).id;
    await tx.insertInto('core.org_units').values({ company_id: other, name: `${tag} o` }).execute();
    const loc = (await tx.insertInto('core.locations').values({ company_id: company, name: `${tag} L`, state_code: 'WB' }).returning('id').executeTakeFirstOrThrow()).id;
    otherLoc = (await tx.insertInto('core.locations').values({ company_id: other, name: `${tag} OL`, state_code: 'OD' }).returning('id').executeTakeFirstOrThrow()).id;
    plant = (await tx.insertInto('core.plants').values({ company_id: company, plant_code: `${tag}P`, name: `${tag} P`, location_id: loc }).returning('id').executeTakeFirstOrThrow()).id;
    const emp = (await tx.insertInto('core.employees').values({ company_id: company, org_unit_id: unit, ecode: `${tag}E1`, first_name: 'Hol', status: 'active', doj: '2020-01-01', location_id: loc, plant_id: plant }).returning('id').executeTakeFirstOrThrow()).id;
    const users: [string, string, number | null, number | null][] = [['ess', 'employee', emp, null], ['admin', 'super_admin', null, null], ['entity', 'hr_head', null, unit]];
    for (const [key, role, employeeId, scope] of users) {
      const u = await tx.insertInto('core.users').values({ email: `${tag.toLowerCase()}-${key}@hrms.invalid`, password_hash: '!disabled!', employee_id: employeeId, is_active: true }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: scope }).execute();
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000) }).returning('sid').executeTakeFirstOrThrow();
      t[key] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    }
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });
  const call = async (method: 'get' | 'put', who: string, path: string, body?: unknown) => {
    const r = (await httpRequest(app))[method](path).set('Authorization', `Bearer ${t[who] ?? ''}`);
    return body === undefined ? r : r.send(body as object);
  };

  it('adds holidays per scope and shows the employee only those that apply', async () => {
    const put = (who: string, body: object) => call('put', who, '/api/attendance/config/holidays', body);
    expect((await put('admin', { date: '2031-01-26', name: 'Republic Day' })).body).toEqual({ ok: true, created: true });
    expect((await put('admin', { date: '2031-03-14', name: 'Plant shutdown', plantId: plant })).status).toBe(200);
    expect((await put('admin', { date: '2031-04-14', name: 'Other entity day', locationId: otherLoc })).status).toBe(200);
    expect((await put('admin', { date: '2031-04-15', name: 'Bad', companyId: other, plantId: plant })).status).toBe(400);
    // Entity-scoped HR head: own company yes, group-wide or another company no.
    expect((await put('entity', { date: '2031-10-20', name: 'Durga Puja', companyId: company })).body).toEqual({ ok: true, created: true });
    expect((await put('entity', { date: '2031-10-20', name: 'Durga Puja (Dashami)', companyId: company })).body).toEqual({ ok: true, created: false });
    expect((await put('entity', { date: '2031-11-01', name: 'Group day' })).status).toBe(403);
    expect((await put('entity', { date: '2031-11-02', name: 'Not mine', companyId: other })).status).toBe(403);

    const mine = await call('get', 'ess', '/api/attendance/config/holidays?year=2031&mine=true');
    expect(mine.status).toBe(200);
    const names = (mine.body as { name: string }[]).map((h) => h.name);
    expect(names).toEqual(expect.arrayContaining(['Republic Day', 'Plant shutdown', 'Durga Puja (Dashami)']));
    expect(names).not.toContain('Other entity day');
    const byCompany = await call('get', 'admin', `/api/attendance/config/holidays?year=2031&companyId=${String(other)}`);
    expect((byCompany.body as { name: string }[]).map((h) => h.name)).toEqual(expect.arrayContaining(['Republic Day', 'Other entity day']));
    const plantRow = (byCompany.body as { name: string }[]).find((h) => h.name === 'Plant shutdown');
    expect(plantRow).toBeUndefined();
  });
});
