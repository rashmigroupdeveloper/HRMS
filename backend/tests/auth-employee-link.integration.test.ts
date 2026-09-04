/**
 * Login accounts created by email can miss `core.users.employee_id` even when a
 * matching `core.employees.work_email` already exists (CORE-01). ESS then 400s
 * every self-service call with "No employee profile linked".
 *
 * The heal: attach the unused employee on the next authenticated request, then
 * leave/attendance resolve as themselves. Pure-admin accounts with no matching
 * work_email stay unlinked (doc 03: NULL is legal for service accounts).
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

interface MeBody {
  id: number;
  email: string;
  employeeId: number | null;
}

run('auth attaches an employee by matching work_email (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'link-heal-pw-1!';
  const emails: string[] = [];
  let companyId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    companyId = (
      await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow()
    ).id;
  });

  afterAll(async () => {
    if (emails.length > 0) {
      await db.updateTable('core.users').set({ is_active: false }).where('email', 'in', emails).execute();
    }
    await db.destroy();
  });

  async function mkEmployee(
    email: string,
    status: 'active' | 'exited' = 'active',
    tag = 'A',
  ): Promise<number> {
    const row = await db
      .insertInto('core.employees')
      .values({
        ecode: `LNK${String(stamp).slice(-8)}${tag}`,
        company_id: companyId,
        first_name: 'Link',
        work_email: email,
        status,
        dol: status === 'exited' ? new Date() : null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function mkUser(email: string, employeeId: number | null, roleCode: string): Promise<number> {
    emails.push(email);
    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password), employee_id: employeeId })
      .returning('id')
      .executeTakeFirstOrThrow();
    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', roleCode)
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: user.id, role_id: role.id, scope_org_unit_id: null })
      .execute();
    return user.id;
  }

  async function login(email: string): Promise<string> {
    const res = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(res.status, `login ${email}`).toBe(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  it('links an unlinked login to the unused employee with the same work_email', async () => {
    const email = `link-heal-${String(stamp)}@hrms.test`;
    const employeeId = await mkEmployee(email, 'active', 'H');
    await mkUser(email, null, 'employee');

    const token = await login(email);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect((me.body as MeBody).employeeId).toBe(employeeId);

    const stored = await db
      .selectFrom('core.users')
      .select('employee_id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    expect(stored.employee_id).toBe(employeeId);

    const balances = await request(app)
      .get('/api/leave/balances')
      .set('Authorization', `Bearer ${token}`);
    expect(balances.status, 'ESS leave must work after the link').toBe(200);
  });

  it('does not steal an employee already attached to another login', async () => {
    const ownerEmail = `link-owner-${String(stamp)}@hrms.test`;
    const otherEmail = `link-other-${String(stamp)}@hrms.test`;
    const employeeId = await mkEmployee(ownerEmail, 'active', 'O');
    await mkUser(ownerEmail, employeeId, 'employee');
    await mkUser(otherEmail, null, 'employee');
    await db.updateTable('core.employees').set({ work_email: otherEmail }).where('id', '=', employeeId).execute();

    const token = await login(otherEmail);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect((me.body as MeBody).employeeId).toBeNull();
  });

  it('does not attach an exited employee', async () => {
    const email = `link-exited-${String(stamp)}@hrms.test`;
    await mkEmployee(email, 'exited', 'X');
    await mkUser(email, null, 'employee');

    const token = await login(email);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect((me.body as MeBody).employeeId).toBeNull();
  });
});
