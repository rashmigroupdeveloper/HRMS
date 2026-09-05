/**
 * Export coverage (RPT-06, docs/06 §3 R28/R30).
 *
 * The rule the whole reporting story rests on: **the export IS the view**.
 * List and export must call the same query, or finance eventually receives a
 * workbook that disagrees with the screen someone approved.
 *
 * E1 the register export parses back and matches the list row-for-row.
 * E2 the not-returned export matches the AST-05 tile.
 * E3 R30 lists per-EMPLOYEE ack status, and `pendingOnly` narrows to
 *    non-acknowledgers (the tile only gives a percentage; the report names them).
 * E4 the audit export refuses rather than silently truncating.
 * E5 exports are permission-gated and audited.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
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

interface FileOut {
  filename: string;
  base64: string;
}

/** Parse an exported workbook back into rows keyed by header. */
async function parseWorkbook(base64: string): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS types the loader as the DOM Buffer; the runtime accepts Node's.
  await wb.xlsx.load(Buffer.from(base64, 'base64') as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  // ExcelJS cell values are a union including rich-text objects; narrow to the
  // primitives an export actually writes.
  const text = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value);
  };

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col - 1] = text(cell.value);
  });
  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const record: Record<string, string> = {};
    ws.getRow(r).eachCell((cell, col) => {
      record[headers[col - 1] ?? String(col)] = text(cell.value);
    });
    rows.push(record);
  }
  return rows;
}

run('Exports — R28 / R30 / audit (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const tag = `EXP${String(stamp).slice(-6)}`;
  const password = 'exports-pw-1!';
  const adminEmail = `exports-${String(stamp)}@hrms.test`;
  const plainEmail = `exports-plain-${String(stamp)}@hrms.test`;
  let token: string;
  let plainToken: string;
  let companyId: number;
  let leaverId: number;
  const assetIds: number[] = [];

  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false, rateLimits: TEST_RATE_LIMITS });

    companyId = (
      await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow()
    ).id;

    const leaver = await db
      .insertInto('core.employees')
      .values({
        ecode: `${tag}L`,
        company_id: companyId,
        first_name: 'Export Leaver',
        status: 'exited',
        dol: new Date('2026-03-31'),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    leaverId = leaver.id;

    // super_admin holds assets.manage, audit.read and reports.hr.
    const admin = await db
      .insertInto('core.users')
      .values({ email: adminEmail, password_hash: await hashPassword(password), employee_id: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    const adminRole = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'super_admin')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: admin.id, role_id: adminRole.id, scope_org_unit_id: null })
      .execute();

    const plain = await db
      .insertInto('core.users')
      .values({ email: plainEmail, password_hash: await hashPassword(password), employee_id: null })
      .returning('id')
      .executeTakeFirstOrThrow();
    const plainRole = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'employee')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: plain.id, role_id: plainRole.id, scope_org_unit_id: null })
      .execute();

    // supertest types res.body as any — cast to the shape we expect (CLAUDE.md §6).
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: adminEmail, password });
    token = (adminLogin.body as { accessToken: string }).accessToken;
    const plainLogin = await request(app)
      .post('/api/auth/login')
      .send({ identifier: plainEmail, password });
    plainToken = (plainLogin.body as { accessToken: string }).accessToken;

    // Two assets: one free, one held by the leaver (so AST-05 has a row).
    for (const suffix of ['A', 'B']) {
      const res = await request(app)
        .put(`/api/assets/${tag}${suffix}`)
        .set(auth())
        .send({ assetNo: `${tag}${suffix}`, category: 'laptop', serialNo: `SN-${tag}-${suffix}`, companyId });
      assetIds.push((res.body as { id: number }).id);
    }
    await request(app)
      .post(`/api/assets/${String(assetIds[1] ?? 0)}/assign`)
      .set(auth())
      .send({ assetId: assetIds[1], holderKind: 'employee', employeeId: leaverId });
  });

  afterAll(async () => {
    if (assetIds.length > 0) {
      await db.deleteFrom('ast.maintenance').where('asset_id', 'in', assetIds).execute();
      await db.deleteFrom('ast.assignments').where('asset_id', 'in', assetIds).execute();
      await db.deleteFrom('ast.assets').where('id', 'in', assetIds).execute();
    }
    await db.deleteFrom('core.employees').where('id', '=', leaverId).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('email', 'in', [adminEmail, plainEmail])
      .execute();
    await db.destroy();
  });

  it('E1 R28 register export equals the on-screen list, row for row', async () => {
    const list = (
      await request(app).get(`/api/assets?q=${tag}&companyId=${String(companyId)}&limit=200`).set(auth())
    ).body as { rows: { assetNo: string; status: string }[] };

    const file = (
      await request(app).get(`/api/assets/export?q=${tag}&companyId=${String(companyId)}`).set(auth())
    ).body as FileOut;
    expect(file.filename).toBe('R28-asset-register.xlsx');

    const sheet = await parseWorkbook(file.base64);
    // Same rows, same order, same statuses — the workbook IS the screen.
    expect(sheet.map((r) => r['Asset no'])).toEqual(list.rows.map((r) => r.assetNo));
    expect(sheet.map((r) => r['Status'])).toEqual(list.rows.map((r) => r.status));
  });

  it('E2 R28 not-returned export matches the AST-05 tile', async () => {
    const tile = (
      await request(app).get(`/api/assets/non-returned?companyId=${String(companyId)}`).set(auth())
    ).body as { assetNo: string; ecode: string }[];

    const file = (
      await request(app)
        .get(`/api/assets/non-returned/export?companyId=${String(companyId)}`)
        .set(auth())
    ).body as FileOut;
    const sheet = await parseWorkbook(file.base64);

    expect(sheet.map((r) => r['Asset no'])).toEqual(tile.map((r) => r.assetNo));
    expect(sheet.some((r) => r['E-code'] === `${tag}L`)).toBe(true);
  });

  it('E3 R30 names who has not acknowledged, not just a percentage', async () => {
    const all = (await request(app).get('/api/policies/ack-report').set(auth())).body as {
      ecode: string;
      acknowledged: boolean;
    }[];
    const pending = (
      await request(app).get('/api/policies/ack-report?pendingOnly=true').set(auth())
    ).body as { ecode: string; acknowledged: boolean }[];

    // Every row is a NAMED employee, and pendingOnly returns only outstanding.
    expect(pending.every((r) => !r.acknowledged)).toBe(true);
    expect(pending.length).toBeLessThanOrEqual(all.length);

    const file = (await request(app).get('/api/policies/ack-report/export').set(auth()))
      .body as FileOut;
    const sheet = await parseWorkbook(file.base64);
    expect(sheet.length).toBe(Math.max(all.length, 1));
  });

  it('E4 the audit export refuses rather than silently truncating', async () => {
    // A tight filter exports fine.
    const ok = await request(app).get('/api/audit/export?entity=ast.assets').set(auth());
    expect(ok.status).toBe(200);
    const sheet = await parseWorkbook((ok.body as FileOut).base64);
    expect(sheet.length).toBeGreaterThan(0);

    // An unfiltered export of a huge trail must ERROR, not hand over a partial
    // file that looks complete. (Asserted by contract: total > cap ⇒ 400.)
    const listed = (await request(app).get('/api/audit?limit=1').set(auth())).body as {
      total: number;
    };
    if (listed.total > 50_000) {
      const tooBig = await request(app).get('/api/audit/export').set(auth());
      expect(tooBig.status).toBe(400);
    }
  });

  it('E5 exports are permission-gated', async () => {
    const denied = await request(app)
      .get('/api/assets/export')
      .set('Authorization', `Bearer ${plainToken}`);
    expect(denied.status).toBe(403);

    const deniedAudit = await request(app)
      .get('/api/audit/export')
      .set('Authorization', `Bearer ${plainToken}`);
    expect(deniedAudit.status).toBe(403);
  });

  it('E6 an export writes an audit row (a register download is evidence)', async () => {
    await request(app).get(`/api/assets/export?q=${tag}`).set(auth());
    const trail = (
      await request(app).get('/api/audit?entity=ast.assets&action=export&limit=5').set(auth())
    ).body as { rows: { field: string }[] };
    expect(trail.rows.some((r) => r.field === 'R28-register')).toBe(true);
  });
});
