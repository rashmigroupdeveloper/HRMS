/** SEC-04/CORE-10: a password challenge augments, never replaces, RBAC. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { httpRequest } from './http-client.js';
const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('password confirmation before access changes', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  it('requires live session-specific proof, persists failures, and preserves the permission ceiling', async () => {
    const rollback = new Error('Intentional step-up fixture rollback');
    try { await db.transaction().execute(async tx => {
      const tag = 'stepup_' + randomUUID();
      const password = 'Synthetic-step-up-password!';
      const user = await tx.insertInto('core.users').values({ email: tag + '@hrms.invalid', password_hash: await hashPassword(password) }).returning('id').executeTakeFirstOrThrow();
      const admin = await tx.selectFrom('core.roles').select('id').where('code', '=', 'super_admin').executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: user.id, role_id: admin.id }).execute();
      const target = await tx.insertInto('core.roles').values({ code: tag, name: tag }).returning('id').executeTakeFirstOrThrow();
      const sessions = await tx.insertInto('sec.sessions').values([1, 2].map(() => ({ user_id: user.id, expires_at: new Date(Date.now() + 600_000) }))).returning('sid').execute();
      const sid = sessions[0]?.sid; const other = sessions[1]?.sid;
      if (!sid || !other) throw new Error('Missing fixture sessions');
      const key = 'synthetic-stepup-test-secret';
      const request = await httpRequest(createApp({ db: tx, jwtSecret: key, secureCookies: false }));
      const token = await signAccessToken(user.id, tag + '@hrms.invalid', key, sid);
      const otherToken = await signAccessToken(user.id, tag + '@hrms.invalid', key, other);
      const change = (access = token) => request.post('/api/rbac/grants').auth(access, { type: 'bearer' }).send({ role: tag, permission: 'admin.settings' });
      const challenge = (value: string) => request.post('/api/auth/step-up').auth(token, { type: 'bearer' }).send({ password: value });
      const refused = await change();
      expect(refused.status).toBe(403);
      expect(JSON.stringify(refused.body)).toContain('STEP_UP_REQUIRED');
      expect(await tx.selectFrom('core.role_permissions').select('role_id').where('role_id', '=', target.id).execute()).toHaveLength(0);
      expect((await challenge('Wrong-synthetic-password')).status).toBe(400);
      expect((await tx.selectFrom('core.users').select('failed_attempts').where('id', '=', user.id).executeTakeFirstOrThrow()).failed_attempts).toBe(1);
      expect((await change()).status).toBe(403);
      expect((await challenge(password)).status).toBe(200);
      expect((await change(otherToken)).status).toBe(403);
      expect((await change()).status).toBe(200);
      const audit = await tx.selectFrom('core.audit_log').select(['new_value', 'old_value']).where('actor_user_id', '=', user.id).execute();
      expect(JSON.stringify(audit)).not.toContain(password);
      await tx.updateTable('sec.sessions').set({ stepped_up_at: new Date(Date.now() - 120_000), stepped_up_until: new Date(Date.now() - 60_000) }).where('sid', '=', sid).execute();
      expect((await change()).status).toBe(403);
      expect((await challenge(password)).status).toBe(200);
      await tx.deleteFrom('core.user_roles').where('user_id', '=', user.id).execute();
      expect((await change()).status).toBe(403);
      await tx.updateTable('sec.sessions').set({ revoked_at: new Date(), revoke_reason: 'synthetic revoke' }).where('sid', '=', sid).execute();
      expect((await challenge(password)).status).toBe(401);
      throw rollback;
    }); } catch (error) { if (error !== rollback) throw error; }
  });
});
