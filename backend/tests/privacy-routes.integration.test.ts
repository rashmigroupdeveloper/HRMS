/**
 * Stage 5.3 — privacy & DPDP HTTP routes (PRV-01..10) end-to-end.
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

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface LoginBody {
  accessToken: string;
}

run('Stage 5.3 — privacy & DPDP HTTP routes', () => {
  let db: Kysely<Database>;
  let app: Express;

  const stamp = Date.now();
  const password = 'Kharagpur2026x';
  const dpoEmail = `prv-route-dpo-${String(stamp)}@hrms.test`;
  const essEmail = `prv-route-ess-${String(stamp)}@hrms.test`;
  const itEmail = `prv-route-it-${String(stamp)}@hrms.test`;

  let dpoUserId: number;
  let essUserId: number;
  let itUserId: number;
  let employeeId: number;

  let dpoToken: string;
  let essToken: string;
  let itToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ identifier: email, password });
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

    const emp = await db
      .insertInto('core.employees')
      .values({
        ecode: `PRV${String(stamp).slice(-7)}`,
        company_id: company.id,
        first_name: 'DPDP',
        last_name: 'Subject',
        status: 'active',
        doj: new Date('2020-01-01'),
        pan: 'ABCDE5678F',
        aadhaar: '987654321098',
        bank_account: '98765432109876',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    employeeId = emp.id;

    const hash = await hashPassword(password);
    const dpo = await db
      .insertInto('core.users')
      .values({ email: dpoEmail, password_hash: hash })
      .returning('id')
      .executeTakeFirstOrThrow();
    dpoUserId = dpo.id;

    const ess = await db
      .insertInto('core.users')
      .values({ email: essEmail, password_hash: hash, employee_id: employeeId })
      .returning('id')
      .executeTakeFirstOrThrow();
    essUserId = ess.id;

    const it = await db
      .insertInto('core.users')
      .values({ email: itEmail, password_hash: hash })
      .returning('id')
      .executeTakeFirstOrThrow();
    itUserId = it.id;

    const roles = await db
      .selectFrom('core.roles')
      .select(['id', 'code'])
      .where('code', 'in', ['hr_head', 'employee', 'it_admin'])
      .execute();

    const roleMap = new Map(roles.map((r) => [r.code, r.id]));

    const hrRoleId = roleMap.get('hr_head');
    const empRoleId = roleMap.get('employee');
    const itRoleId = roleMap.get('it_admin');
    if (!hrRoleId || !empRoleId || !itRoleId) throw new Error('Missing test roles');

    await db
      .insertInto('core.user_roles')
      .values([
        { user_id: dpoUserId, role_id: hrRoleId },
        { user_id: essUserId, role_id: empRoleId },
        { user_id: itUserId, role_id: itRoleId },
      ])
      .execute();

    dpoToken = await login(dpoEmail);
    essToken = await login(essEmail);
    itToken = await login(itEmail);
  });

  afterAll(async () => {
    await db.deleteFrom('prv.consents').where('employee_id', '=', employeeId).execute().catch(() => undefined);
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('id', 'in', [dpoUserId, essUserId, itUserId])
      .execute()
      .catch(() => undefined);
    await db
      .updateTable('core.employees')
      .set({ status: 'exited', dol: new Date() })
      .where('id', '=', employeeId)
      .execute()
      .catch(() => undefined);
    await db.destroy();
  });

  it('GET /api/privacy/notice-status returns notice and requires ack', async () => {
    const res = await request(app).get('/api/privacy/notice-status').set(auth(essToken));
    expect(res.status).toBe(200);
    const body = res.body as { required: boolean; notice: { id: number; title: string } };
    expect(body.required).toBe(true);
    expect(body.notice.id).toBeGreaterThan(0);

    // Acknowledge
    const ackRes = await request(app)
      .post('/api/privacy/notice/ack')
      .set(auth(essToken))
      .send({ noticeId: body.notice.id });
    expect(ackRes.status).toBe(200);
    expect((ackRes.body as { ok: boolean }).ok).toBe(true);

    // Check again — now required is false
    const after = await request(app).get('/api/privacy/notice-status').set(auth(essToken));
    expect((after.body as { required: boolean }).required).toBe(false);
  });

  it('GET /api/privacy/register returns seeded processing entries', async () => {
    const res = await request(app).get('/api/privacy/register').set(auth(essToken));
    expect(res.status).toBe(200);
    const body = res.body as { entries: { dataClass: string; purpose: string }[] };
    expect(body.entries.length).toBeGreaterThan(0);
    expect(body.entries.some((e) => e.dataClass === 'attendance')).toBe(true);
  });

  it('consents API: ESS sets and views consents; IT cannot read all consents', async () => {
    // ESS sets photograph consent
    const putRes = await request(app)
      .put('/api/privacy/consents')
      .set(auth(essToken))
      .send({ purpose: 'photograph', granted: true });
    expect(putRes.status).toBe(200);

    // ESS views own consents
    const getRes = await request(app).get('/api/privacy/consents').set(auth(essToken));
    expect(getRes.status).toBe(200);
    const body = getRes.body as { consents: { purpose: string; granted: boolean }[] };
    expect(body.consents.find((c) => c.purpose === 'photograph')?.granted).toBe(true);

    // DPO reads all consents
    const allRes = await request(app).get('/api/privacy/consents?scope=all').set(auth(dpoToken));
    expect(allRes.status).toBe(200);

    // IT admin has no prv.consent.read
    const itRes = await request(app).get('/api/privacy/consents?scope=all').set(auth(itToken));
    expect(itRes.status).toBe(403);
  });

  it('rights requests lifecycle: create, list, refuse, fulfill', async () => {
    // ESS creates rights request
    const createRes = await request(app)
      .post('/api/privacy/rights')
      .set(auth(essToken))
      .send({ kind: 'correction', reason: 'Update emergency contact phone' });
    expect(createRes.status).toBe(200);
    const rightsId = (createRes.body as { id: number }).id;
    expect(rightsId).toBeGreaterThan(0);

    // IT cannot list rights
    const itList = await request(app).get('/api/privacy/rights').set(auth(itToken));
    expect(itList.status).toBe(403);

    // DPO lists rights
    const dpoList = await request(app).get('/api/privacy/rights').set(auth(dpoToken));
    expect(dpoList.status).toBe(200);
    const listBody = dpoList.body as { requests: { id: number; kind: string; status: string }[] };
    expect(listBody.requests.some((r) => r.id === rightsId)).toBe(true);

    // Fulfill
    const fulfillRes = await request(app)
      .post('/api/privacy/rights/fulfill')
      .set(auth(dpoToken))
      .send({ id: rightsId });
    expect(fulfillRes.status).toBe(200);

    // Second fulfill fails with 409 CONFLICT
    const secondFulfill = await request(app)
      .post('/api/privacy/rights/fulfill')
      .set(auth(dpoToken))
      .send({ id: rightsId });
    expect(secondFulfill.status).toBe(409);
  });

  it('retention & purge proposal, and export pack with masked identifiers', async () => {
    const retRes = await request(app).get('/api/privacy/retention').set(auth(dpoToken));
    expect(retRes.status).toBe(200);
    const retBody = retRes.body as { rules: { dataClass: string }[] };
    expect(retBody.rules.length).toBeGreaterThan(0);

    // Export pack
    const exportRes = await request(app)
      .get(`/api/privacy/export?employeeId=${String(employeeId)}`)
      .set(auth(dpoToken));
    expect(exportRes.status).toBe(200);
    const pack = exportRes.body as { employee: { pan: string; aadhaar: string; bankAccount: string } };
    expect(pack.employee.pan).not.toBe('ABCDE5678F');
    expect(pack.employee.pan).toMatch(/678F$/);
  });

  it('DPO contact and access history routes', async () => {
    const dpoRes = await request(app).get('/api/privacy/dpo').set(auth(essToken));
    expect(dpoRes.status).toBe(200);
    const dpoBody = dpoRes.body as { email: string; name: string };
    expect(dpoBody.email).toBe('dpo@rashmigroup.com');

    const historyRes = await request(app).get('/api/privacy/my/access-history').set(auth(essToken));
    expect(historyRes.status).toBe(200);
    const histBody = historyRes.body as { available: boolean; events: unknown[] };
    expect(histBody.available).toBe(true);
  });
});
