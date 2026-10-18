/** NFR-03 / P0-T20: concurrent login and sponsor-approved single-use sessions. */
import 'dotenv/config';
import { decodeJwt } from 'jose';
import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { createApp } from '../src/app.js';
import { hashPassword, login, refresh } from '../src/modules/auth/auth.service.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { httpRequest } from './http-client.js';

const url = process.env['DATABASE_URL'];
const secret = 'auth-safety-only-test-secret-at-least-32';
const password = 'Synthetic-auth-safety-password-123!';
describe.skipIf(!url)('NFR-03 native authentication safety', () => {
  let db: Kysely<Database>;
  let hash: string;
  beforeAll(async () => { db = createDatabase(url ?? ''); hash = await hashPassword(password); });
  afterAll(async () => { await db.destroy(); });
  async function fixture(run: (id: number, email: string) => Promise<void>) {
    const email = `auth-safety-${randomUUID()}@hrms.invalid`;
    const { id } = await db.insertInto('core.users').values({ email, password_hash: hash }).returning('id').executeTakeFirstOrThrow();
    try { await run(id, email); }
    finally {
      await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('id', '=', id).execute();
      await db.updateTable('sec.sessions').set({ revoked_at: new Date(), revoke_reason: 'synthetic test cleanup' }).where('user_id', '=', id).where('revoked_at', 'is', null).execute();
    }
  }
  it('counts simultaneous wrong passwords exactly and prevents a correct password bypassing the lock', async () => fixture(async (id, email) => {
    await Promise.all(Array.from({ length: 5 }, () => login(db, secret, email, 'wrong', null)));
    const user = await db.selectFrom('core.users').select(['failed_attempts', 'locked_until']).where('id', '=', id).executeTakeFirstOrThrow();
    expect(user.failed_attempts).toBe(5);
    expect(user.locked_until?.getTime()).toBeGreaterThan(Date.now());
    expect((await login(db, secret, email, password, null)).ok).toBe(false);
    expect((await db.selectFrom('core.audit_log').select('id').where('entity', '=', 'core.users').where('entity_id', '=', id).where('action', '=', 'login_failed').execute()).length).toBe(6);
  }));
  it('never accepts a consumed refresh token twice', async () => fixture(async (_id, email) => {
    const signed = await login(db, secret, email, password, null);
    expect(signed.ok).toBe(true); if (!signed.ok) throw new Error('Fixture login failed');
    const rotated = await refresh(db, secret, signed.refreshToken);
    expect(rotated.ok).toBe(true);
    expect((await refresh(db, secret, signed.refreshToken)).ok).toBe(false);
    if (rotated.ok) expect((await refresh(db, secret, rotated.refreshToken)).ok).toBe(true);
  }));
  it('allows exactly one winner when the same refresh token is redeemed concurrently', async () => fixture(async (_id, email) => {
    const signed = await login(db, secret, email, password, null);
    if (!signed.ok) throw new Error('Fixture login failed');
    const attempts = await Promise.all([refresh(db, secret, signed.refreshToken), refresh(db, secret, signed.refreshToken)]);
    expect(attempts.filter(result => result.ok)).toHaveLength(1);
  }));
  it('logout immediately revokes access and refresh for this session while preserving another login', async () => fixture(async (_id, email) => {
    const first = await login(db, secret, email, password, null);
    const other = await login(db, secret, email, password, null);
    if (!first.ok || !other.ok) throw new Error('Fixture login failed');
    const app = createApp({ db, jwtSecret: secret, secureCookies: false });
    const logout = await (await httpRequest(app)).post('/api/auth/logout').set('Cookie', `hrms_refresh=${first.refreshToken}`);
    expect(logout.status).toBe(200);
    expect((await (await httpRequest(app)).get('/api/auth/me').auth(first.accessToken, { type: 'bearer' })).status).toBe(401);
    expect((await refresh(db, secret, first.refreshToken)).ok).toBe(false);
    expect((await (await httpRequest(app)).get('/api/auth/me').auth(other.accessToken, { type: 'bearer' })).status).toBe(200);
  }));
  it('rejects signed access tokens that have no live session', async () => fixture(async (id, email) => {
    const token = await signAccessToken(id, email, secret);
    const response = await (await httpRequest(createApp({ db, jwtSecret: secret, secureCookies: false }))).get('/api/auth/me').auth(token, { type: 'bearer' });
    expect(response.status).toBe(401);
  }));
  it('deactivation blocks both access and refresh for an existing session', async () => fixture(async (id, email) => {
    const signed = await login(db, secret, email, password, null);
    if (!signed.ok) throw new Error('Fixture login failed');
    await db.updateTable('core.users').set({ is_active: false }).where('id', '=', id).execute();
    expect((await refresh(db, secret, signed.refreshToken)).ok).toBe(false);
    expect((await (await httpRequest(createApp({ db, jwtSecret: secret, secureCookies: false }))).get('/api/auth/me').auth(signed.accessToken, { type: 'bearer' })).status).toBe(401);
  }));
  it('advances capped backoff after expiry and resets consecutive failures on success', async () => fixture(async (id, email) => {
    await db.updateTable('core.users').set({ failed_attempts: 5, locked_until: new Date(Date.now() - 1000) }).where('id', '=', id).execute();
    const started = Date.now();
    expect((await login(db, secret, email, 'wrong', null)).ok).toBe(false);
    const state = await db.selectFrom('core.users').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    expect(state.failed_attempts).toBe(6);
    expect((state.locked_until?.getTime() ?? 0) - started).toBeGreaterThanOrEqual(30 * 60000);
    await db.updateTable('core.users').set({ failed_attempts: 32767, locked_until: new Date(Date.now() - 1000) }).where('id', '=', id).execute();
    expect((await login(db, secret, email, 'wrong', null)).ok).toBe(false);
    const capped = await db.selectFrom('core.users').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    expect(capped.failed_attempts).toBe(32767);
    expect((capped.locked_until?.getTime() ?? 0) - Date.now()).toBeLessThanOrEqual(120 * 60000);
    await db.updateTable('core.users').set({ locked_until: new Date(Date.now() - 1000) }).where('id', '=', id).execute();
    expect((await login(db, secret, email, password, null)).ok).toBe(true);
    expect((await db.selectFrom('core.users').selectAll().where('id', '=', id).executeTakeFirstOrThrow()).failed_attempts).toBe(0);
  }));
  it('rolls back counter changes when the audit cannot commit', async () => fixture(async (id, email) => {
    await expect(login(db, secret, email, 'wrong', 'not-an-ip')).rejects.toThrow();
    const state = await db.selectFrom('core.users').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    expect(state.failed_attempts).toBe(0);
    expect(state.locked_until).toBeNull();
  }));
  it('reads editable policy and preserves the absolute session expiry across rotation', async () => fixture(async (id, email) => {
    const rollback = new Error('policy fixture rollback');
    try {
      await db.transaction().execute(async tx => {
        for (const [key, value] of [['auth.failure_threshold', 2], ['auth.access_ttl_seconds', 30], ['auth.refresh_ttl_seconds', 90]] as const) {
          await tx.updateTable('core.settings').set({ value: JSON.stringify(value) }).where('key', '=', key).execute();
        }
        const signed = await login(tx, secret, email, password, null);
        if (!signed.ok) throw new Error('Fixture login failed');
        const access = decodeJwt(signed.accessToken);
        expect((access.exp ?? 0) - (access.iat ?? 0)).toBe(30);
        const first = decodeJwt(signed.refreshToken);
        expect((first.exp ?? 0) - (first.iat ?? 0)).toBe(90);
        const rotated = await refresh(tx, secret, signed.refreshToken);
        if (!rotated.ok) throw new Error('Fixture refresh failed');
        expect(decodeJwt(rotated.refreshToken).exp).toBe(first.exp);
        expect(rotated.refreshToken).not.toBe(signed.refreshToken);
        await login(tx, secret, email, 'wrong', null);
        await login(tx, secret, email, 'wrong', null);
        expect((await tx.selectFrom('core.users').selectAll().where('id', '=', id).executeTakeFirstOrThrow()).locked_until).not.toBeNull();
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  }));

});
