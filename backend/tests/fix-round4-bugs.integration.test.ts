/** E2E-030 (plants master + GL trigger message), E2E-031 (biometric enrolment), E2E-032 (mark doors complete). */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { type ControlledTransaction, type Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { mapError } from '../src/core/errors/index.js';
import { httpRequest } from './http-client.js';
import { roleUser } from './fixtures/role-users.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = 'synthetic-jwt-test-secret-at-least-32-characters-long';

describe.skipIf(!DB_URL)('fix round 4 bugs', () => {
  let db: Kysely<Database>;
  let tx: ControlledTransaction<Database>;
  let app: ReturnType<typeof createApp>;
  const t: Record<string, string> = {};
  let companyA = 0;
  let companyB = 0;
  let unitA = 0;
  let tag = '';
  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    tx = await db.startTransaction().execute();
    tag = ('R4' + randomUUID().slice(0, 5)).toUpperCase();
    companyA = (await tx.insertInto('core.companies').values({ code: `${tag}A`, name: `${tag}A`, ecode_prefix: `${tag}A` }).returning('id').executeTakeFirstOrThrow()).id;
    companyB = (await tx.insertInto('core.companies').values({ code: `${tag}B`, name: `${tag}B`, ecode_prefix: `${tag}B` }).returning('id').executeTakeFirstOrThrow()).id;
    unitA = (await tx.insertInto('core.org_units').values({ company_id: companyA, name: `${tag} A` }).returning('id').executeTakeFirstOrThrow()).id;
    const mail = (k: string) => `${tag.toLowerCase()}-${k}@hrms.invalid`;
    t['sa'] = (await roleUser(tx, { email: mail('sa'), role: 'super_admin', jwtSecret: JWT_SECRET })).token;
    t['it'] = (await roleUser(tx, { email: mail('it'), role: 'it_admin', jwtSecret: JWT_SECRET })).token;
    t['emp'] = (await roleUser(tx, { email: mail('emp'), role: 'employee', jwtSecret: JWT_SECRET })).token;
    app = createApp({ db: tx, jwtSecret: JWT_SECRET, secureCookies: false });
  });
  afterAll(async () => {
    try { if (!tx.isRolledBack && !tx.isCommitted) await tx.rollback().execute(); } finally { await db.destroy(); }
  });
  const call = async (who: string, method: 'get' | 'post' | 'patch', path: string, body?: object) => {
    const r = (await httpRequest(app))[method](path).set('Authorization', `Bearer ${t[who] ?? ''}`);
    return body ? r.send(body) : r;
  };

  it('E2E-030: plants are an org master, cost centres link to a same-company plant', async () => {
    const created = await call('sa', 'post', '/api/core/masters/plants', { values: { company_id: companyA, plant_code: 'kgp', name: 'Kharagpur' } });
    expect(created.status).toBe(200);
    const plantId = (created.body as { id: number }).id;
    const list = await call('sa', 'get', '/api/core/masters/plants');
    expect((list.body as { rows: { plant_code: string }[] }).rows.some((r) => r.plant_code === 'KGP')).toBe(true);
    expect((await call('sa', 'post', '/api/core/masters/plants', { values: { company_id: companyA, plant_code: '!', name: 'Bad' } })).status).toBe(400);
    const cc = await call('sa', 'post', '/api/core/masters/cost_centers', { values: { company_id: companyA, code: `${tag}CC`, name: 'CC', plant_id: plantId } });
    expect(cc.status).toBe(200);
    const wrong = await call('sa', 'post', '/api/core/masters/cost_centers', { values: { company_id: companyB, code: `${tag}CB`, name: 'CB', plant_id: plantId } });
    expect(wrong.status).toBe(400);
    expect(JSON.stringify(wrong.body)).toContain('another company');
    expect((await call('emp', 'post', '/api/core/masters/plants', { values: { company_id: companyA, plant_code: 'X1', name: 'X' } })).status).toBe(403);
  });

  it('E2E-030: a trigger-raised 23503 surfaces its authored message', () => {
    const e = Object.assign(new Error('Unknown plant_code KGP for company RML'), { code: '23503', severity: 'ERROR' });
    expect(JSON.stringify(mapError(e))).toContain('Unknown plant_code KGP');
  });

  it('E2E-031: it_admin records biometric enrolment by e-code (audited); employees cannot', async () => {
    const ec = `B${randomUUID().slice(0, 6).toUpperCase()}`;
    const emp = (await tx.insertInto('core.employees').values({ company_id: companyA, org_unit_id: unitA, ecode: ec, first_name: 'Bio', status: 'active', doj: '2020-01-01' }).returning('id').executeTakeFirstOrThrow()).id;
    const r = await call('it', 'post', '/api/attendance/biometric-enrolment', { ecode: ec, registered: true, accessCardNo: 'C-77' });
    expect(r.status).toBe(200);
    const row = await tx.selectFrom('core.employees').select(['biometric_registered', 'access_card_no']).where('id', '=', emp).executeTakeFirstOrThrow();
    expect(row).toEqual({ biometric_registered: true, access_card_no: 'C-77' });
    expect((await call('it', 'post', '/api/attendance/biometric-enrolment', { ecode: 'NOPE999', registered: true })).status).toBe(404);
    expect((await call('emp', 'post', '/api/attendance/biometric-enrolment', { ecode: ec, registered: false })).status).toBe(403);
  });

  it('E2E-032: doors can be marked complete through a past date, never the future', async () => {
    const loc = (await tx.insertInto('core.locations').values({ company_id: companyA, name: `${tag} plant`, state_code: 'WB' }).returning('id').executeTakeFirstOrThrow()).id;
    const door = `${tag}-D1`;
    const dev = (await tx.insertInto('att.devices').values({ door_code: door, source: 'kent', location_id: loc }).returning('id').executeTakeFirstOrThrow()).id;
    const r = await call('it', 'post', '/api/attendance/doors/mark-complete', { through: '2026-05-31', locationId: loc, reason: 'Manual upload of May swipes' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((r.body as { doors: string[] }).doors).toEqual([door]);
    const wm = await tx.selectFrom('att.device_watermarks').select('watermark_ts').where('device_id', '=', dev).executeTakeFirstOrThrow();
    expect(wm.watermark_ts.toISOString()).toBe('2026-05-31T18:29:59.999Z');
    expect((await call('it', 'post', '/api/attendance/doors/mark-complete', { through: '2099-01-01', locationId: loc, reason: 'Manual upload of May swipes' })).status).toBe(400);
    expect((await call('it', 'post', '/api/attendance/doors/mark-complete', { through: '2026-05-31', locationId: loc, reason: 'short' })).status).toBe(400);
    expect((await call('emp', 'post', '/api/attendance/doors/mark-complete', { through: '2026-05-31', locationId: loc, reason: 'Manual upload of May swipes' })).status).toBe(403);
  });
});
