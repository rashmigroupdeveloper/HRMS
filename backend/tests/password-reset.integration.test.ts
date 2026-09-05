/**
 * Phase 5 · Stage 5.8 · ESS-01 — forgot / reset password.
 *
 * Properties under test:
 *   1. Unknown identifier still returns 200 { ok: true } (no user oracle).
 *   2. Requests past the hourly unused-token cap still return 200 but do not
 *      insert extra tokens.
 *   3. A live token resets the password once; replay fails.
 *   4. An expired token is refused.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { TEST_RATE_LIMITS } from './helpers/rate-limits.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface OkBody {
  ok: true;
}

run('Stage 5.8 — ESS-01 password reset (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;

  const stamp = Date.now();
  const password = 'Kharagpur2026x';
  const email = `pwr-${String(stamp)}@hrms.test`;
  const rateEmail = `pwr-rate-${String(stamp)}@hrms.test`;
  let userId: number;
  let rateUserId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false, rateLimits: TEST_RATE_LIMITS });

    const hash = await hashPassword(password);
    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: hash, is_active: true })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = user.id;

    const rateUser = await db
      .insertInto('core.users')
      .values({ email: rateEmail, password_hash: hash, is_active: true })
      .returning('id')
      .executeTakeFirstOrThrow();
    rateUserId = rateUser.id;
  });

  afterAll(async () => {
    // Append-only audit FK — never hard-delete users with history.
    await db
      .deleteFrom('core.password_reset_tokens')
      .where('user_id', 'in', [userId, rateUserId])
      .execute();
    await db
      .deleteFrom('wf.notifications')
      .where('recipient_user_id', 'in', [userId, rateUserId])
      .execute();
    await db.deleteFrom('sec.password_history').where('user_id', '=', userId).execute();
    await db
      .updateTable('sec.sessions')
      .set({ revoked_at: new Date(), revoke_reason: 'test cleanup' })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false })
      .where('id', 'in', [userId, rateUserId])
      .execute();
    await db.destroy();
  });

  async function latestResetToken(forUserId: number): Promise<string> {
    const note = await db
      .selectFrom('wf.notifications')
      .select(['payload'])
      .where('recipient_user_id', '=', forUserId)
      .where('template_code', '=', 'password_reset')
      .where('channel', '=', 'email')
      .orderBy('id', 'desc')
      .executeTakeFirstOrThrow();
    const payload =
      typeof note.payload === 'string'
        ? (JSON.parse(note.payload) as { token?: unknown })
        : (note.payload as { token?: unknown });
    if (typeof payload.token !== 'string') {
      throw new Error('password_reset notification is missing token');
    }
    return payload.token;
  }

  it('unknown identifier still returns 200 { ok: true }', async () => {
    const res = await request(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: `nobody-${String(stamp)}@hrms.test` });
    expect(res.status).toBe(200);
    expect(res.body as OkBody).toEqual({ ok: true });
  });

  it('rate-limits unused tokens per hour without changing the 200 response', async () => {
    const before = await db
      .selectFrom('core.password_reset_tokens')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('user_id', '=', rateUserId)
      .executeTakeFirst();
    const startCount = Number(before?.count ?? 0);

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post('/api/auth/password/forgot')
        .send({ identifier: rateEmail });
      expect(res.status).toBe(200);
      expect(res.body as OkBody).toEqual({ ok: true });
    }

    const mid = await db
      .selectFrom('core.password_reset_tokens')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('user_id', '=', rateUserId)
      .where('used_at', 'is', null)
      .executeTakeFirst();
    expect(Number(mid?.count ?? 0)).toBe(startCount + 3);

    const capped = await request(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: rateEmail });
    expect(capped.status).toBe(200);
    expect(capped.body as OkBody).toEqual({ ok: true });

    const after = await db
      .selectFrom('core.password_reset_tokens')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('user_id', '=', rateUserId)
      .where('used_at', 'is', null)
      .executeTakeFirst();
    expect(Number(after?.count ?? 0)).toBe(startCount + 3);
  });

  it('a live token resets once, then refuses replay', async () => {
    const forgot = await request(app)
      .post('/api/auth/password/forgot')
      .send({ identifier: email });
    expect(forgot.status).toBe(200);

    const token = await latestResetToken(userId);
    const nextPassword = 'Durgapur2027y';

    const issued = await db
      .selectFrom('core.audit_log')
      .select(['new_value'])
      .where('entity_id', '=', userId)
      .where('action', '=', 'password_reset_requested')
      .orderBy('id', 'desc')
      .executeTakeFirst();
    expect(issued?.new_value).toBe('reset issued');
    expect(issued?.new_value ?? '').not.toContain(token);

    const reset = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, newPassword: nextPassword });
    expect(reset.status).toBe(200);
    expect(reset.body as OkBody).toEqual({ ok: true });

    const loginOk = await request(app)
      .post('/api/auth/login')
      .send({ identifier: email, password: nextPassword });
    expect(loginOk.status).toBe(200);

    const replay = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, newPassword: 'Asansol2028z1' });
    expect(replay.status).toBe(400);
  });

  it('an expired token fails', async () => {
    const raw = 'a'.repeat(64);
    const tokenHash = createHash('sha256').update(Buffer.from(raw, 'hex')).digest('hex');
    await db
      .insertInto('core.password_reset_tokens')
      .values({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() - 60_000),
        used_at: null,
      })
      .execute();

    const res = await request(app)
      .post('/api/auth/password/reset')
      .send({ token: raw, newPassword: 'Bankura2029a1' });
    expect(res.status).toBe(400);
  });
});
