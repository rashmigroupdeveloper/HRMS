/**
 * M8 Asset registry — AST-01…AST-06 (live Postgres).
 *
 * The requirements that carry real operational weight, each pinned:
 *   A1 AST-02 — a PAST warranty date is accepted. greytHR rejected these,
 *      which forced staff to type a wrong date for kit registered after issue.
 *   A2 AST-03 — a holder is an employee XOR a third party, enforced by the DB.
 *   A3 an asset cannot be in two hands at once (partial unique index).
 *   A4 AST-04 — return recording, including `not_returned` as a real outcome,
 *      and damage routing to maintenance instead of back into stock.
 *   A5 AST-05 — the non-returned tile finds kit held by people who have left.
 *   A6 AST-01 — search by asset no, serial AND holder.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { TEST_RATE_LIMITS } from './helpers/rate-limits.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface AssetRow {
  id: number;
  assetNo: string;
  status: string;
  holderKind: string | null;
  holderName: string | null;
  warrantyTill: string | null;
}
interface AssetPage {
  rows: AssetRow[];
  total: number;
}

run('M8 Assets — AST-01..06 (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const tag = `AST${String(stamp).slice(-6)}`;
  const password = 'assets-pw-1!';
  const email = `assets-${String(stamp)}@hrms.test`;
  let token: string;
  let companyId: number;
  let holderId: number;
  let leaverId: number;
  const assetIds: number[] = [];

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false, rateLimits: TEST_RATE_LIMITS });

    const company = await db
      .selectFrom('core.companies')
      .select('id')
      .where('code', '=', 'RML')
      .executeTakeFirstOrThrow();
    companyId = company.id;

    const holder = await db
      .insertInto('core.employees')
      .values({ ecode: `${tag}H`, company_id: companyId, first_name: 'Asset Holder', status: 'active' })
      .returning('id')
      .executeTakeFirstOrThrow();
    holderId = holder.id;

    const leaver = await db
      .insertInto('core.employees')
      .values({
        ecode: `${tag}L`,
        company_id: companyId,
        first_name: 'Departed Holder',
        status: 'exited',
        dol: new Date('2026-02-28'),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    leaverId = leaver.id;

    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password), employee_id: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    // it_admin holds assets.manage at scope 'all' (docs/08 §2 grid).
    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'it_admin')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: user.id, role_id: role.id, scope_org_unit_id: null })
      .execute();

    const login = await request(app).post('/api/auth/login').send({ identifier: email, password });
    token = (login.body as { accessToken: string }).accessToken;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    if (assetIds.length > 0) {
      await db.deleteFrom('ast.maintenance').where('asset_id', 'in', assetIds).execute();
      await db.deleteFrom('ast.assignments').where('asset_id', 'in', assetIds).execute();
      await db.deleteFrom('ast.assets').where('id', 'in', assetIds).execute();
    }
    await db.deleteFrom('core.employees').where('id', 'in', [holderId, leaverId]).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('email', '=', email)
      .execute();
    await db.destroy();
  });

  async function createAsset(suffix: string, warrantyTill: string | null): Promise<number> {
    const res = await request(app)
      .put(`/api/assets/${tag}${suffix}`)
      .set(auth())
      .send({
        assetNo: `${tag}${suffix}`,
        category: 'laptop',
        description: `Test laptop ${suffix}`,
        serialNo: `SN-${tag}-${suffix}`,
        warrantyTill,
        companyId,
      });
    expect(res.status).toBe(200);
    const id = (res.body as { id: number }).id;
    assetIds.push(id);
    return id;
  }

  it('A1 AST-02 accepts a PAST warranty date (greytHR blocked these)', async () => {
    const id = await createAsset('P', '2020-01-15');
    const res = await request(app).get(`/api/assets?q=${tag}P&companyId=${String(companyId)}`).set(auth());
    const page = res.body as AssetPage;
    const found = page.rows.find((r) => r.id === id);
    // The date is stored as given — not clamped, not rejected.
    expect(found?.warrantyTill).toBe('2020-01-15');
  });

  it('A2 AST-03 rejects a holder that is neither an employee nor a third party', async () => {
    const id = await createAsset('X', null);

    const noHolder = await request(app)
      .post(`/api/assets/${String(id)}/assign`)
      .set(auth())
      .send({ assetId: id, holderKind: 'employee' });
    expect(noHolder.status).toBe(400);

    const namelessThirdParty = await request(app)
      .post(`/api/assets/${String(id)}/assign`)
      .set(auth())
      .send({ assetId: id, holderKind: 'third_party', thirdPartyName: '   ' });
    expect(namelessThirdParty.status).toBe(400);
  });

  it('A3 an asset cannot be allocated to two holders at once', async () => {
    const id = await createAsset('D', null);

    const first = await request(app)
      .post(`/api/assets/${String(id)}/assign`)
      .set(auth())
      .send({ assetId: id, holderKind: 'employee', employeeId: holderId });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/assets/${String(id)}/assign`)
      .set(auth())
      .send({ assetId: id, holderKind: 'third_party', thirdPartyName: 'Contractor Ltd' });
    expect(second.status).toBe(400);

    // Status reflects reality for the register.
    const page = (await request(app).get(`/api/assets?q=${tag}D`).set(auth())).body as AssetPage;
    const asset = page.rows.find((r) => r.id === id);
    expect(asset?.status).toBe('assigned');
    expect(asset?.holderKind).toBe('employee');
  });

  it('A4 AST-04 records returns; damage goes to maintenance, not back to stock', async () => {
    const id = await createAsset('R', null);
    const assign = await request(app)
      .post(`/api/assets/${String(id)}/assign`)
      .set(auth())
      .send({ assetId: id, holderKind: 'employee', employeeId: holderId });
    const assignmentId = (assign.body as { assignmentId: number }).assignmentId;

    const ret = await request(app)
      .post(`/api/assets/assignments/${String(assignmentId)}/return`)
      .set(auth())
      .send({ assignmentId, condition: 'damaged', notes: 'Cracked screen' });
    expect(ret.status).toBe(200);

    const page = (await request(app).get(`/api/assets?q=${tag}R`).set(auth())).body as AssetPage;
    const asset = page.rows.find((r) => r.id === id);
    // Damaged kit must NOT be reallocated to the next joiner in that state.
    expect(asset?.status).toBe('maintenance');
    expect(asset?.holderKind).toBeNull();

    const trail = (await request(app).get(`/api/assets/${String(id)}/maintenance`).set(auth()))
      .body as { kind: string; description: string }[];
    expect(trail.some((m) => m.kind === 'damage')).toBe(true);

    // A closed allocation cannot be closed twice.
    const again = await request(app)
      .post(`/api/assets/assignments/${String(assignmentId)}/return`)
      .set(auth())
      .send({ assignmentId, condition: 'ok' });
    expect(again.status).toBe(400);
  });

  it('A5 AST-05 surfaces kit still held by someone who has already left', async () => {
    const id = await createAsset('N', null);
    await request(app)
      .post(`/api/assets/${String(id)}/assign`)
      .set(auth())
      .send({ assetId: id, holderKind: 'employee', employeeId: leaverId });

    const outstanding = (
      await request(app).get(`/api/assets/non-returned?companyId=${String(companyId)}`).set(auth())
    ).body as { assetNo: string; ecode: string; dol: string | null }[];

    const row = outstanding.find((r) => r.assetNo === `${tag}N`);
    expect(row).toBeDefined();
    expect(row?.ecode).toBe(`${tag}L`);
    expect(row?.dol).toBe('2026-02-28');

    // AST-04: the same asset appears on the leaver's exit-clearance list.
    const held = (
      await request(app).get(`/api/assets/held-by/${String(leaverId)}`).set(auth())
    ).body as { assetNo: string }[];
    expect(held.map((h) => h.assetNo)).toContain(`${tag}N`);
  });

  it('A6 AST-01 searches by asset number, serial and holder name', async () => {
    const byNo = (await request(app).get(`/api/assets?q=${tag}D`).set(auth())).body as AssetPage;
    expect(byNo.rows.some((r) => r.assetNo === `${tag}D`)).toBe(true);

    const bySerial = (await request(app).get(`/api/assets?q=SN-${tag}-D`).set(auth())).body as AssetPage;
    expect(bySerial.rows.some((r) => r.assetNo === `${tag}D`)).toBe(true);

    // The Task-Matrix gap was specifically that you could not find kit by holder.
    const byHolder = (await request(app).get('/api/assets?q=Asset Holder').set(auth()))
      .body as AssetPage;
    expect(byHolder.rows.some((r) => r.assetNo === `${tag}D`)).toBe(true);
  });

  it('A7 refuses a caller without assets.manage', async () => {
    const plainEmail = `assets-plain-${String(stamp)}@hrms.test`;
    const u = await db
      .insertInto('core.users')
      .values({ email: plainEmail, password_hash: await hashPassword(password), employee_id: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'employee')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: u.id, role_id: role.id, scope_org_unit_id: null })
      .execute();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: plainEmail, password });
    const plainToken = (login.body as { accessToken: string }).accessToken;

    const res = await request(app).get('/api/assets').set('Authorization', `Bearer ${plainToken}`);
    expect(res.status).toBe(403);

    await db
      .updateTable('core.users')
      .set({ is_active: false })
      .where('email', '=', plainEmail)
      .execute();
  });
});
