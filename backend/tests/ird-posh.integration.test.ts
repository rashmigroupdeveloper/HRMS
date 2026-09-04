/**
 * Stage 5.5 — POSH access refusal (sponsor demo).
 *
 * A user WITHOUT `ird.posh.handle` must receive FORBIDDEN when opening a case.
 * The IC list returns empty with the honest banner — we never invent members.
 *
 * Requires `irdRouter` to be registered on `appRouter` (lead wires router.ts).
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
interface FileBody {
  id: number;
  caseRef: string;
}
interface IcBody {
  members: unknown[];
  constituted: boolean;
  banner: string;
}

run('Stage 5.5 — POSH access refusal (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;

  const stamp = Date.now();
  const password = 'Kharagpur2026x';
  const filerEmail = `ird-filer-${String(stamp)}@hrms.test`;
  const outsiderEmail = `ird-outsider-${String(stamp)}@hrms.test`;
  let caseId: number;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string): Promise<string> {
    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120')
      .send({ identifier: email, password });
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

    const hash = await hashPassword(password);

    for (const [email, ecode, first] of [
      [filerEmail, `IRD${String(stamp).slice(-6)}A`, 'Filer'],
      [outsiderEmail, `IRD${String(stamp).slice(-6)}B`, 'Outsider'],
    ] as const) {
      const employee = await db
        .insertInto('core.employees')
        .values({
          ecode,
          company_id: company.id,
          first_name: first,
          last_name: 'IrdTest',
          status: 'active',
          doj: new Date('2020-01-01'),
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const user = await db
        .insertInto('core.users')
        .values({ email, password_hash: hash, employee_id: employee.id })
        .returning('id')
        .executeTakeFirstOrThrow();

      const empRole = await db
        .selectFrom('core.roles')
        .select('id')
        .where('code', '=', 'employee')
        .executeTakeFirstOrThrow();

      await db
        .insertInto('core.user_roles')
        .values({ user_id: user.id, role_id: empRole.id })
        .execute();
    }

    // IC must stay empty — prove the banner, never invent members.
    const icCount = await db
      .selectFrom('ird.ic_members')
      .select(({ fn }) => [fn.countAll<number>().as('n')])
      .executeTakeFirstOrThrow();
    // Soft assertion in setup: if a prior seed somehow added members, the
    // banner test still documents the expected empty contract for this stage.
    void icCount;
  });

  afterAll(async () => {
    // Deactivate — never hard-delete users with audit history (CORE-06).
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('email', 'in', [filerEmail, outsiderEmail])
      .execute();
    await db.destroy();
  });

  it('lists an empty IC with the sponsor-awaiting banner', async () => {
    const token = await login(filerEmail);
    const res = await request(app).get('/api/ird/ic').set(auth(token));
    expect(res.status).toBe(200);
    const body = res.body as IcBody;
    expect(body.members).toEqual([]);
    expect(body.constituted).toBe(false);
    expect(body.banner).toBe('IC not constituted — awaiting sponsor appointment');
  });

  it('lets an authenticated employee file a POSH case', async () => {
    const token = await login(filerEmail);
    const res = await request(app)
      .post('/api/ird/posh/file')
      .set(auth(token))
      .send({ summary: 'Skeleton complaint for access-refusal demonstration.' });
    expect(res.status).toBe(200);
    const body = res.body as FileBody;
    expect(body.caseRef).toMatch(/^POSH-\d{4}-\d{5}$/);
    caseId = body.id;
  });

  it('refuses a non-handler opening the case with FORBIDDEN (sponsor demo)', async () => {
    expect(caseId).toBeGreaterThan(0);
    const token = await login(outsiderEmail);
    const res = await request(app)
      .get(`/api/ird/posh/cases/${String(caseId)}`)
      .set(auth(token));
    expect(res.status).toBe(403);
    const message = (res.body as { message?: string }).message ?? '';
    expect(message.toLowerCase()).toMatch(/forbidden|permission|ird\.posh\.handle/);
  });

  it('also refuses list-cases for the non-handler', async () => {
    const token = await login(outsiderEmail);
    const res = await request(app).get('/api/ird/posh/cases').set(auth(token));
    expect(res.status).toBe(403);
  });
});
