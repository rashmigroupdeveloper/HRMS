/**
 * Integration tests against the LIVE local database (.env DATABASE_URL).
 * Skipped entirely when no DATABASE_URL is configured (e.g. bare CI).
 *
 * Proves the Stage-0.4 safety rails for real:
 *  - RBAC seed landed (10 roles / 38 permissions; super_admin holds all)
 *  - audit log is append-only (UPDATE/DELETE rejected BY THE DATABASE)
 *  - hash chain detects tampering (trigger-off forgery is caught)
 *  - auth: login, wrong-password lockout with backoff, refresh rotation, /me
 *  - settings: audited typed writes
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { writeAudit, verifyAuditChain } from '../src/core/audit/audit.service.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { getTypedSetting, setSetting } from '../src/modules/settings/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';

const run = describe.skipIf(!DB_URL);

run('database integration (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const email = `test-auth-${Date.now()}@hrms.test`;
  const password = 'correct-horse-battery-staple-9!';
  let userId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const inserted = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password) })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = inserted.id;
  });

  afterAll(async () => {
    // Users who have audit history can never be hard-deleted (FK from the
    // append-only audit log) — exactly the CORE-06 rule. Deactivate instead.
    await db.updateTable('core.users').set({ is_active: false }).where('id', '=', userId).execute();
    await db.destroy();
  });

  // ---------------------------------------------------------------- RBAC seed
  it('RBAC seed landed: 10 roles, 38 permissions, super_admin holds all 38', async () => {
    const roles = await db.selectFrom('core.roles').select(db.fn.countAll().as('n')).executeTakeFirstOrThrow();
    const perms = await db.selectFrom('core.permissions').select(db.fn.countAll().as('n')).executeTakeFirstOrThrow();
    expect(Number(roles.n)).toBe(10);
    expect(Number(perms.n)).toBe(38);

    const superAdmin = await db
      .selectFrom('core.role_permissions as rp')
      .innerJoin('core.roles as r', 'r.id', 'rp.role_id')
      .where('r.code', '=', 'super_admin')
      .select(db.fn.countAll().as('n'))
      .executeTakeFirstOrThrow();
    expect(Number(superAdmin.n)).toBe(38);
  });

  it('hard rule: it_admin never holds compensation.read (separation of duties)', async () => {
    const rows = await db
      .selectFrom('core.role_permissions as rp')
      .innerJoin('core.roles as r', 'r.id', 'rp.role_id')
      .innerJoin('core.permissions as p', 'p.id', 'rp.permission_id')
      .where('r.code', '=', 'it_admin')
      .where('p.code', '=', 'employee.compensation.read')
      .selectAll()
      .execute();
    expect(rows).toHaveLength(0);
  });

  // ---------------------------------------------------------- audit integrity
  it('audit log rejects UPDATE and DELETE at the database layer', async () => {
    await writeAudit(db, { action: 'create', entity: 'test.append_only', newValue: 'probe' });
    const row = await db
      .selectFrom('core.audit_log')
      .select('id')
      .where('entity', '=', 'test.append_only')
      .orderBy('id', 'desc')
      .executeTakeFirstOrThrow();

    await expect(
      db.updateTable('core.audit_log').set({ new_value: 'mutated' }).where('id', '=', row.id).execute(),
    ).rejects.toThrow(/append-only/);

    await expect(
      db.deleteFrom('core.audit_log').where('id', '=', row.id).execute(),
    ).rejects.toThrow(/append-only/);
  });

  it('hash chain is intact, and tampering is DETECTED once triggers are bypassed', async () => {
    await writeAudit(db, { action: 'create', entity: 'test.chain', newValue: 'honest row' });
    expect(await verifyAuditChain(db)).toBeNull();

    const victim = await db
      .selectFrom('core.audit_log')
      .select(['id', 'new_value'])
      .where('entity', '=', 'test.chain')
      .orderBy('id', 'desc')
      .executeTakeFirstOrThrow();

    // Simulate an attacker with table access disabling the guards and editing history.
    await sql`ALTER TABLE core.audit_log DISABLE TRIGGER audit_log_immutable`.execute(db);
    try {
      await sql`UPDATE core.audit_log SET new_value = 'FORGED' WHERE id = ${victim.id}`.execute(db);
      expect(await verifyAuditChain(db)).toBe(victim.id); // caught.
      await sql`UPDATE core.audit_log SET new_value = ${victim.new_value} WHERE id = ${victim.id}`.execute(db);
      expect(await verifyAuditChain(db)).toBeNull(); // restored.
    } finally {
      await sql`ALTER TABLE core.audit_log ENABLE TRIGGER audit_log_immutable`.execute(db);
    }
  });

  // ------------------------------------------------------------------- auth
  it('rejects a wrong password, locks after 5 failures, then correct password stays locked', async () => {
    for (let i = 1; i <= 4; i++) {
      const res = await request(app).post('/api/auth/login').send({ identifier: email, password: 'wrong!' });
      expect(res.status).toBe(401);
    }
    const fifth = await request(app).post('/api/auth/login').send({ identifier: email, password: 'wrong!' });
    expect(fifth.status).toBe(401);
    expect((fifth.body as { message?: string }).message).toMatch(/locked/i);

    // Even the CORRECT password is refused while locked.
    const locked = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(locked.status).toBe(401);

    // Backoff state is in the DB.
    const state = await db
      .selectFrom('core.users')
      .select(['failed_attempts', 'locked_until'])
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(state.failed_attempts).toBeGreaterThanOrEqual(5);
    expect(state.locked_until).not.toBeNull();

    // Unlock for the rest of the suite.
    await db
      .updateTable('core.users')
      .set({ failed_attempts: 0, locked_until: null })
      .where('id', '=', userId)
      .execute();
  });

  it('full happy path: login → me → refresh rotation → logout', async () => {
    const agent = request.agent(app); // persists the httpOnly refresh cookie

    const login = await agent.post('/api/auth/login').send({ identifier: email, password });
    expect(login.status).toBe(200);
    const { accessToken, user } = login.body as { accessToken: string; user: { id: number; email: string } };
    expect(user.email).toBe(email);
    expect(JSON.stringify(login.headers['set-cookie'] ?? '')).toContain('hrms_refresh=');

    const me = await agent.get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect((me.body as { id: number }).id).toBe(userId);

    const refreshed = await agent.post('/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    const newAccess = (refreshed.body as { accessToken: string }).accessToken;
    expect(newAccess).toBeTruthy();

    const meAgain = await agent.get('/api/auth/me').set('Authorization', `Bearer ${newAccess}`);
    expect(meAgain.status).toBe(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);
    const afterLogout = await agent.post('/api/auth/refresh');
    expect(afterLogout.status).toBe(401); // cookie gone
  });

  it('me without a token is 401; garbage token is 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status,
    ).toBe(401);
  });

  // ---------------------------------------------------------------- settings
  it('settings: audited typed write, typed read, authed HTTP read', async () => {
    const key = `test.integration_knob_${Date.now()}`;
    await setSetting(db, {
      key,
      value: 42,
      type: 'number',
      description: 'integration probe',
      actorUserId: userId,
    });

    expect(await getTypedSetting(db, key, 'number', 0)).toBe(42);
    await expect(getTypedSetting(db, key, 'boolean', false)).rejects.toThrow(/expected boolean/);

    const audit = await db
      .selectFrom('core.audit_log')
      .selectAll()
      .where('entity', '=', 'core.settings')
      .where('field', '=', key)
      .execute();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.new_value).toBe('42');

    const login = await request(app).post('/api/auth/login').send({ identifier: email, password });
    const token = (login.body as { accessToken: string }).accessToken;
    const res = await request(app).get(`/api/settings/${key}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body as { value: number }).value).toBe(42);

    await db.deleteFrom('core.settings').where('key', '=', key).execute();
  });
});
