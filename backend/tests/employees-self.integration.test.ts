/**
 * Self-service profile — GET /employees/me returns the SIGNED-IN user's own
 * record, resolved from their account's employee link (CORE-01 / docs/05 §4.2
 * ESS). Also guards the route precedence: /employees/me must reach getOwn, not
 * be swallowed by /employees/{ecode} with ecode="me".
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { sql, type Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';

const run = describe.skipIf(!DB_URL);

run('employees self-service — GET /employees/me (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const email = `test-self-${stamp}@hrms.test`;
  const password = 'test-password-for-self-view-1!';
  let ownEcode: string | null = null;

  async function loginToken(identifier: string): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ identifier, password });
    expect(res.status).toBe(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const company = await db.selectFrom('core.companies').select('id')
      .where('code', '=', 'RML').executeTakeFirstOrThrow();
    const emp = await db.insertInto('core.employees').values({
      ecode: `SELF${String(stamp)}`, company_id: company.id,
      first_name: 'Calendar', last_name: 'Fixture', status: 'active',
      dob: sql<Date>`'1994-03-17'::date`, doj: sql<Date>`'2020-01-15'::date`,
      confirmation_date: sql<Date>`'2020-07-15'::date`,
    }).returning(['id', 'ecode']).executeTakeFirstOrThrow();
    ownEcode = emp.ecode;
    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password), employee_id: emp.id })
      .returning('id')
      .executeTakeFirstOrThrow();

    // The `employee` role grants employee.read — the self endpoint's single gate.
    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'employee')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: user.id, role_id: role.id, scope_org_unit_id: null })
      .onConflict((oc) => oc.columns(['user_id', 'role_id', 'scope_org_unit_id']).doNothing())
      .execute();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns the caller’s OWN profile (not shadowed by /employees/{ecode})', async () => {
    expect(ownEcode).not.toBeNull();
    const token = await loginToken(email);
    const res = await request(app)
      .get('/api/employees/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect((res.body as { ecode: string }).ecode).toBe(ownEcode);
    expect(res.body).toMatchObject({ dob: '1994-03-17', doj: '2020-01-15', confirmationDate: '2020-07-15' });
  });

  it('rejects an unauthenticated caller with 401', async () => {
    const res = await request(app).get('/api/employees/me');
    expect(res.status).toBe(401);
  });
});
