/**
 * CENTRAL ACCESS CONTROL — live proof of the sponsor's requirement:
 * "I should be able to change the access based on role; every API should be
 *  controllable [as to] who can access it."
 *
 * Demonstrated end-to-end below:
 *   1. No role            → protected API answers 403.
 *   2. Role assigned      → same API answers 200 (no restart).
 *   3. Permission REVOKED from the role via the RBAC admin API
 *                         → same API answers 403 ON THE NEXT REQUEST.
 *   4. Granted back       → 200 again. All four transitions audited.
 *
 * Plus the notifications skeleton: event fan-out by role, retry → dead-letter.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import {
  devLogTransport,
  enqueueEvent,
  processQueue,
  type NotificationTransport,
} from '../src/modules/notifications/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';

const run = describe.skipIf(!DB_URL);

run('central access control (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'test-password-for-access-control-1!';
  const adminEmail = `test-acl-admin-${stamp}@hrms.test`;
  const opsEmail = `test-acl-ops-${stamp}@hrms.test`;
  let adminId: number;
  let opsId: number;
  const settingKey = `test.acl_knob_${stamp}`;

  async function makeUser(email: string): Promise<number> {
    const row = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password) })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function giveRole(userId: number, roleCode: string): Promise<void> {
    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', roleCode)
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: userId, role_id: role.id, scope_org_unit_id: null })
      .onConflict((oc) => oc.columns(['user_id', 'role_id', 'scope_org_unit_id']).doNothing())
      .execute();
  }

  async function loginToken(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  function putSetting(token: string) {
    return request(app)
      .put(`/api/settings/${settingKey}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ key: settingKey, value: 7, valueType: 'number', description: 'acl probe' });
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    adminId = await makeUser(adminEmail);
    opsId = await makeUser(opsEmail);
    await giveRole(adminId, 'super_admin');
  });

  afterAll(async () => {
    // Restore the grid exactly (in case a test failed mid-flight).
    const token = await loginToken(adminEmail);
    await request(app)
      .post('/api/rbac/grants')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'it_admin', permission: 'admin.settings' });

    await db.deleteFrom('core.settings').where('key', '=', settingKey).execute();
    await db.deleteFrom('core.user_roles').where('user_id', 'in', [adminId, opsId]).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false })
      .where('id', 'in', [adminId, opsId])
      .execute();
    await db.destroy();
  });

  it('1. a user with NO role gets 403 from every protected API (401 without a token)', async () => {
    expect((await putSetting('')).status).toBe(401);

    const token = await loginToken(opsEmail);
    expect((await putSetting(token)).status).toBe(403);

    const matrix = await request(app).get('/api/rbac/matrix').set('Authorization', `Bearer ${token}`);
    expect(matrix.status).toBe(403);
  });

  it('2. assigning a role via the RBAC API makes the same call pass — no restart', async () => {
    const adminToken = await loginToken(adminEmail);

    const assign = await request(app)
      .post('/api/rbac/user-roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: opsId, role: 'it_admin' });
    expect(assign.status).toBe(200);

    const opsToken = await loginToken(opsEmail);
    expect((await putSetting(opsToken)).status).toBe(200); // it_admin holds admin.settings
  });

  it('3. REVOKING the permission from the role flips the same API to 403 on the next request', async () => {
    const adminToken = await loginToken(adminEmail);
    const opsToken = await loginToken(opsEmail);

    const revoke = await request(app)
      .delete('/api/rbac/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'it_admin', permission: 'admin.settings' });
    expect(revoke.status).toBe(200);
    expect((revoke.body as { changed: boolean }).changed).toBe(true);

    expect((await putSetting(opsToken)).status).toBe(403); // same token, next request: refused

    const grantBack = await request(app)
      .post('/api/rbac/grants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'it_admin', permission: 'admin.settings' });
    expect(grantBack.status).toBe(200);

    expect((await putSetting(opsToken)).status).toBe(200); // and back again
  });

  it('4. every grid change landed in the hash-chained audit log', async () => {
    const rows = await db
      .selectFrom('core.audit_log')
      .select(['action', 'field'])
      .where('entity', '=', 'core.role_permissions')
      .where('field', '=', 'it_admin→admin.settings')
      .where('actor_user_id', '=', adminId)
      .execute();
    expect(rows.some((r) => r.action === 'revoke')).toBe(true);
    expect(rows.some((r) => r.action === 'grant')).toBe(true);
  });

  it('5. the matrix endpoint exposes the live grid (the admin access matrix)', async () => {
    const adminToken = await loginToken(adminEmail);
    const res = await request(app).get('/api/rbac/matrix').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const body = res.body as { roles: unknown[]; permissions: string[]; grants: unknown[] };
    expect(body.roles).toHaveLength(10);
    expect(body.permissions).toHaveLength(38);
    expect(body.grants.length).toBeGreaterThan(150);
  });
});

run('notifications skeleton (live Postgres)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const eventCode = `test.event_${stamp}`;

  beforeAll(() => {
    db = createDatabase(DB_URL ?? '');
  });

  afterAll(async () => {
    await db.deleteFrom('wf.notifications').where('template_code', '=', `tpl_${stamp}`).execute();
    await db.deleteFrom('wf.event_subscriptions').where('event_code', '=', eventCode).execute();
    await db.destroy();
  });

  it('fans an event out to an email subscriber and delivers via the transport', async () => {
    await db
      .insertInto('wf.event_subscriptions')
      .values({ event_code: eventCode, recipient_kind: 'email', recipient_ref: 'hr@rashmi.test' })
      .execute();

    const queued = await enqueueEvent(db, eventCode, `tpl_${stamp}`, { hello: 'world' });
    expect(queued).toBe(1);

    const { sent, failed } = await processQueue(db, devLogTransport);
    expect(sent).toBeGreaterThanOrEqual(1);
    expect(failed).toBe(0);

    const row = await db
      .selectFrom('wf.notifications')
      .select(['status', 'sent_at'])
      .where('template_code', '=', `tpl_${stamp}`)
      .executeTakeFirstOrThrow();
    expect(row.status).toBe('sent');
    expect(row.sent_at).not.toBeNull();
  });

  it('a permanently failing transport retries then parks the row in dead-letter — never silently dropped', async () => {
    const failing: NotificationTransport = {
      send: () => Promise.reject(new Error('SMTP down (test)')),
    };

    await db
      .insertInto('wf.notifications')
      .values({
        recipient_email: 'dead@rashmi.test',
        channel: 'email',
        template_code: `tpl_${stamp}`,
        payload: JSON.stringify({}),
      })
      .execute();

    for (let i = 0; i < 5; i++) await processQueue(db, failing);

    const row = await db
      .selectFrom('wf.notifications')
      .select(['status', 'attempts', 'last_error'])
      .where('recipient_email', '=', 'dead@rashmi.test')
      .where('template_code', '=', `tpl_${stamp}`)
      .executeTakeFirstOrThrow();
    expect(row.status).toBe('dead');
    expect(row.attempts).toBe(5);
    expect(row.last_error).toContain('SMTP down');
  });
});
