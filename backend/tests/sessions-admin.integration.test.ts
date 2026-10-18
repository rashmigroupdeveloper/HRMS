/** Handover item 6: it_admin sessions view / force-logout; self-service device list. */
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

describe.skipIf(!DB_URL)('sessions view and revoke', () => {
  let db: Kysely<Database>;
  let transaction: ControlledTransaction<Database> | undefined;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  const uid: Record<string, number> = {};
  const sids: Record<string, number> = {};

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    transaction = await db.startTransaction().execute();
    const tx = transaction;
    const tag = 'ss' + randomUUID().slice(0, 6);
    for (const [key, role] of [['it', 'it_admin'], ['emp', 'employee'], ['boss', 'super_admin']] as const) {
      const u = await tx.insertInto('core.users').values({ email: `${tag}-${key}@hrms.invalid`, password_hash: '!disabled!', is_active: true }).returning(['id', 'email']).executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: u.id, role_id: r.id, scope_org_unit_id: null }).execute();
      const s = await tx.insertInto('sec.sessions').values({ user_id: u.id, expires_at: new Date(Date.now() + 600000), ip: '10.0.0.1', user_agent: 'vitest' }).returning(['sid', 'id']).executeTakeFirstOrThrow();
      uid[key] = u.id;
      sids[key] = s.id;
      t[key] = await signAccessToken(u.id, u.email, JWT_SECRET, s.sid);
    }
    // A second device for the employee.
    sids['emp2'] = (await tx.insertInto('sec.sessions').values({ user_id: uid['emp'] ?? 0, expires_at: new Date(Date.now() + 600000) }).returning('id').executeTakeFirstOrThrow()).id;
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (transaction && !transaction.isRolledBack && !transaction.isCommitted) await transaction.rollback().execute(); }
    finally { await db.destroy(); }
  });
  const tx = (): ControlledTransaction<Database> => { if (!transaction) throw new Error('no tx'); return transaction; };
  const get = async (who: string, path: string) => (await httpRequest(app)).get(path).set('Authorization', `Bearer ${t[who] ?? ''}`);
  const post = async (who: string, path: string) => (await httpRequest(app)).post(path).set('Authorization', `Bearer ${t[who] ?? ''}`).send({});

  it('it_admin lists and revokes; revoked tokens stop working; higher roles are protected', async () => {
    expect((await get('emp', '/api/auth/sessions')).status).toBe(403);
    const list = await get('it', `/api/auth/sessions?userId=${String(uid['emp'])}`);
    expect(list.status).toBe(200);
    expect((list.body as { id: number }[]).map((s) => s.id).sort()).toEqual([sids['emp'], sids['emp2']].sort());
    const mine = await get('it', '/api/auth/sessions?q=-it@');
    expect((mine.body as { current: boolean }[]).some((s) => s.current)).toBe(true);
    expect((await post('it', `/api/auth/sessions/${String(sids['boss'])}/revoke`)).status).toBe(403);
    expect((await post('it', '/api/auth/sessions/999999999/revoke')).status).toBe(404);
    expect((await post('it', `/api/auth/sessions/${String(sids['emp2'])}/revoke`)).body).toEqual({ revoked: 1 });
    expect((await post('it', `/api/auth/sessions/${String(sids['emp2'])}/revoke`)).body).toEqual({ revoked: 0 });
    expect((await get('emp', '/api/auth/sessions/mine')).status).toBe(200);
    expect((await post('it', `/api/auth/users/${String(uid['emp'])}/sessions/revoke`)).body).toEqual({ revoked: 1 });
    expect((await get('emp', '/api/auth/sessions/mine')).status).toBe(401);
    expect((await post('it', `/api/auth/users/${String(uid['boss'])}/sessions/revoke`)).status).toBe(403);
  });

  it('E2E-006: it_admin creates a login by e-code; unknown e-code is 404', async () => {
    const emp = await tx().selectFrom('core.employees').select('ecode').limit(1).executeTakeFirst();
    const send = async (body: object) => (await httpRequest(app)).post('/api/auth/users').set('Authorization', `Bearer ${t['it'] ?? ''}`).send(body);
    expect((await send({ email: `nx${randomUUID().slice(0, 6)}@hrms.invalid`, ecode: 'NOPE-XYZ' })).status).toBe(404);
    if (emp) {
      await tx().updateTable('core.users').set({ employee_id: null }).where('employee_id', 'in', (eb) => eb.selectFrom('core.employees').select('id').where('ecode', '=', emp.ecode)).execute();
      const r = await send({ email: `ok${randomUUID().slice(0, 6)}@hrms.invalid`, ecode: emp.ecode.toLowerCase() });
      expect(r.status).toBe(200);
      expect(typeof (r.body as { temporaryPassword: string }).temporaryPassword).toBe('string');
    }
  });

  it('anyone sees and ends only their own sessions', async () => {
    const mine = await get('boss', '/api/auth/sessions/mine');
    expect(mine.status).toBe(200);
    expect((mine.body as { userAgent: string | null; current: boolean }[])[0]).toMatchObject({ userAgent: 'vitest', current: true });
    expect((await post('boss', `/api/auth/sessions/mine/${String(sids['it'])}/revoke`)).status).toBe(404);
    expect((await post('boss', `/api/auth/sessions/mine/${String(sids['boss'])}/revoke`)).body).toEqual({ revoked: 1 });
    expect((await get('boss', '/api/auth/sessions/mine')).status).toBe(401);
  });
});
