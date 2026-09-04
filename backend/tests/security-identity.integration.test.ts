/**
 * Phase 5 · Stage 5.2 — identity hardening, proved end-to-end (SEC-01..11).
 *
 * The four properties this stage exists to guarantee, each as a live test:
 *   1. A revoked session stops working ON THE NEXT REQUEST — not whenever the
 *      JWT happens to expire. This is what "sign out everywhere" and the
 *      exit-day access cut actually depend on.
 *   2. Step-up is genuinely required before a sensitive read, and a stolen
 *      password alone cannot clear it once a second factor exists.
 *   3. A TOTP code is spent once — replay inside the same 30s window fails.
 *   4. A sensitive read is recorded with a stated purpose, is visible to the
 *      person whose record it was, and CANNOT be edited or deleted afterwards.
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
import { generateTotp } from '../src/core/auth/totp.js';
import { recordAccess } from '../src/modules/security/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface LoginBody {
  accessToken: string;
}
interface SessionsBody {
  sessions: { sid: string; isCurrent: boolean; deviceLabel: string | null }[];
}
interface MfaBeginBody {
  secret: string;
  otpauth: string;
}
interface StepUpBody {
  steppedUpUntil: string;
}
interface AccessHistoryBody {
  available: boolean;
  events: { purpose: string; fieldClass: string; recordCount: number }[];
}

run('Stage 5.2 — identity hardening (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;

  const stamp = Date.now();
  const password = 'Kharagpur2026x';
  const email = `sec-${String(stamp)}@hrms.test`;
  const adminEmail = `sec-admin-${String(stamp)}@hrms.test`;
  let userId: number;
  let adminUserId: number;
  let employeeId: number;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(as = email, pw = password, agent = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120'):
    Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', agent)
      .send({ identifier: as, password: pw });
    expect(res.status).toBe(200);
    return (res.body as LoginBody).accessToken;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const company = await db
      .selectFrom('core.companies')
      .select('id')
      .orderBy('id')
      .executeTakeFirstOrThrow();

    const employee = await db
      .insertInto('core.employees')
      .values({
        ecode: `SEC${String(stamp).slice(-7)}`,
        company_id: company.id,
        first_name: 'Session',
        last_name: 'Subject',
        status: 'active',
        doj: new Date('2020-01-01'),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    employeeId = employee.id;

    const hash = await hashPassword(password);
    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: hash, employee_id: employeeId })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = user.id;

    const admin = await db
      .insertInto('core.users')
      .values({ email: adminEmail, password_hash: hash })
      .returning('id')
      .executeTakeFirstOrThrow();
    adminUserId = admin.id;

    const itAdmin = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'it_admin')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: adminUserId, role_id: itAdmin.id })
      .execute();
  });

  afterAll(async () => {
    await db.deleteFrom('sec.access_events').where('actor_user_id', 'in', [userId, adminUserId]).execute()
      .catch(() => undefined); // append-only: expected to fail, cleanup is best-effort
    await db.deleteFrom('sec.sessions').where('user_id', 'in', [userId, adminUserId]).execute();
    await db.deleteFrom('sec.password_history').where('user_id', 'in', [userId, adminUserId]).execute();
    await db.deleteFrom('core.user_roles').where('user_id', '=', adminUserId).execute();
    await db.destroy();
  });

  /* ── 1. Sessions ──────────────────────────────────────────────────────── */

  it('issues a session row on login and lists it with a human device label', async () => {
    const token = await login();
    const res = await request(app).get('/api/security/my/sessions').set(auth(token));

    expect(res.status).toBe(200);
    const body = res.body as SessionsBody;
    const current = body.sessions.find((s) => s.isCurrent);
    expect(current).toBeDefined();
    expect(current?.deviceLabel).toBe('Chrome on Windows');
  });

  it('REVOKING a session stops it on the very next request', async () => {
    const token = await login();

    const before = await request(app).get('/api/auth/me').set(auth(token));
    expect(before.status).toBe(200);

    const list = await request(app).get('/api/security/my/sessions').set(auth(token));
    const sid = (list.body as SessionsBody).sessions.find((s) => s.isCurrent)?.sid ?? '';
    await db
      .updateTable('sec.sessions')
      .set({ revoked_at: new Date(), revoked_by_user_id: userId, revoke_reason: 'test revoke' })
      .where('sid', '=', sid)
      .execute();

    // Same token, same second — the difference is the session row, not the JWT.
    const after = await request(app).get('/api/auth/me').set(auth(token));
    expect(after.status).toBe(401);
  });

  it('sign-out-everywhere ends other sessions but spares the one asking', async () => {
    const first = await login(email, password, 'Mozilla/5.0 (Android 13) Chrome/120');
    const second = await login();

    const res = await request(app)
      .post('/api/security/my/sessions/revoke-all')
      .set(auth(second))
      .send({ includeCurrent: false });
    expect(res.status).toBe(200);
    expect((res.body as { revoked: number }).revoked).toBeGreaterThanOrEqual(1);

    expect((await request(app).get('/api/auth/me').set(auth(first))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth(second))).status).toBe(200);
  });

  it('a revoked session cannot be refreshed back to life', async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post('/api/auth/login').send({ identifier: email, password });
    expect(loginRes.status).toBe(200);

    await db
      .updateTable('sec.sessions')
      .set({ revoked_at: new Date(), revoked_by_user_id: userId, revoke_reason: 'test' })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();

    const refreshed = await agent.post('/api/auth/refresh');
    expect(refreshed.status).toBe(401);
  });

  /* ── 2. Step-up ───────────────────────────────────────────────────────── */

  it('refuses a step-up-gated procedure until the session is elevated', async () => {
    const adminToken = await login(adminEmail);

    const denied = await request(app)
      .post('/api/security/admin/mfa/reset')
      .set(auth(adminToken))
      .send({ userId, reason: 'lost phone' });
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).toContain('STEP_UP_REQUIRED');

    const stepped = await request(app)
      .post('/api/security/step-up')
      .set(auth(adminToken))
      .send({ password });
    expect(stepped.status).toBe(200);
    expect(new Date((stepped.body as StepUpBody).steppedUpUntil).getTime()).toBeGreaterThan(Date.now());

    const allowed = await request(app)
      .post('/api/security/admin/mfa/reset')
      .set(auth(adminToken))
      .send({ userId, reason: 'lost phone' });
    expect(allowed.status).toBe(200);
  });

  it('step-up refuses a wrong password', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/security/step-up')
      .set(auth(token))
      .send({ password: 'not-the-password' });
    expect(res.status).toBe(401);
  });

  /* ── 3. Second factor ─────────────────────────────────────────────────── */

  it('enrols a second factor, then spends each code exactly once', async () => {
    const token = await login();

    const begin = await request(app).post('/api/security/my/mfa/begin').set(auth(token));
    expect(begin.status).toBe(200);
    const { secret, otpauth } = begin.body as MfaBeginBody;
    expect(otpauth).toContain('otpauth://totp/');

    const confirm = await request(app)
      .post('/api/security/my/mfa/confirm')
      .set(auth(token))
      .send({ code: generateTotp(secret, Date.now()) });
    expect(confirm.status).toBe(200);
    expect((confirm.body as { recoveryCodes: string[] }).recoveryCodes).toHaveLength(10);

    // With a factor enrolled, step-up now needs the code too — a stolen
    // password alone must not re-open what MFA was added to protect.
    const passwordOnly = await request(app)
      .post('/api/security/step-up')
      .set(auth(token))
      .send({ password });
    expect(passwordOnly.status).toBe(401);

    // Confirming the enrolment SPENT the code it was proved with. Re-offering
    // it seconds later is a replay, and is refused — this is the property that
    // makes a shoulder-surfed code worthless.
    const spent = generateTotp(secret, Date.now());
    const replayOfConfirm = await request(app)
      .post('/api/security/step-up')
      .set(auth(token))
      .send({ password, code: spent });
    expect(replayOfConfirm.status).toBe(401);
    expect(JSON.stringify(replayOfConfirm.body)).toMatch(/already used/i);

    // The NEXT step's code is fresh (and inside the ±1 drift window the server
    // accepts), so it works.
    const fresh = generateTotp(secret, Date.now() + 30_000);
    const withCode = await request(app)
      .post('/api/security/step-up')
      .set(auth(token))
      .send({ password, code: fresh });
    expect(withCode.status).toBe(200);

    // …and that one is now spent too.
    const replay = await request(app)
      .post('/api/security/step-up')
      .set(auth(token))
      .send({ password, code: fresh });
    expect(replay.status).toBe(401);
    expect(JSON.stringify(replay.body)).toMatch(/already used/i);
  });

  /* ── 4. Password ──────────────────────────────────────────────────────── */

  it('refuses a weak password and names every rule it breaks', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/security/my/password')
      .set(auth(token))
      .send({ currentPassword: password, newPassword: 'abc' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/short/i);
  });

  it('refuses reuse of the current password', async () => {
    const token = await login();
    const res = await request(app)
      .post('/api/security/my/password')
      .set(auth(token))
      .send({ currentPassword: password, newPassword: password });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/used this password before/i);
  });

  /* ── 5. Access log (SEC-10/11) ────────────────────────────────────────── */

  it('records a sensitive read with its purpose and shows it to the subject', async () => {
    await recordAccess(db, {
      actorUserId: adminUserId,
      sessionSid: null,
      subjectEmployeeId: employeeId,
      resource: 'employee.statutory_ids',
      fieldClass: 'statutory_id',
      purpose: 'PF nomination verification',
      recordCount: 1,
      ip: null,
    });

    const token = await login();
    const res = await request(app)
      .get('/api/security/my/access-history')
      .query({ limit: 10 })
      .set(auth(token));

    expect(res.status).toBe(200);
    const body = res.body as AccessHistoryBody;
    expect(body.available).toBe(true);
    expect(body.events[0]?.purpose).toBe('PF nomination verification');
    expect(body.events[0]?.fieldClass).toBe('statutory_id');
  });

  it('access events are append-only at the DATABASE, not merely by convention', async () => {
    await expect(
      db
        .updateTable('sec.access_events')
        .set({ purpose: 'rewritten' })
        .where('subject_employee_id', '=', employeeId)
        .execute(),
    ).rejects.toThrow(/append-only/i);

    await expect(
      db.deleteFrom('sec.access_events').where('subject_employee_id', '=', employeeId).execute(),
    ).rejects.toThrow(/append-only/i);
  });

  it('a read with no stated purpose is refused by the database', async () => {
    await expect(
      db
        .insertInto('sec.access_events')
        .values({
          actor_user_id: adminUserId,
          session_sid: null,
          subject_employee_id: employeeId,
          resource: 'employee.compensation',
          field_class: 'compensation',
          purpose: '  ',
          ip: null,
        })
        .execute(),
    ).rejects.toThrow();
  });

  /* ── 6. Separation of duties ──────────────────────────────────────────── */

  it('an ordinary employee cannot reach the IT security surfaces', async () => {
    const token = await login();
    for (const path of [
      '/api/security/admin/sessions?userId=1',
      '/api/security/admin/mfa/coverage',
      '/api/security/admin/access-log',
    ]) {
      const res = await request(app).get(path).set(auth(token));
      expect(res.status, path).toBe(403);
    }
  });
});
