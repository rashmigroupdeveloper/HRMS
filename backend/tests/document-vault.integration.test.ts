/**
 * Stage 5.4 — document vault list for a fresh employee is empty (DOC-02).
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
import { TEST_RATE_LIMITS } from './helpers/rate-limits.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

interface LoginBody {
  accessToken: string;
}
interface MineBody {
  rows: { id: number; documentType: string }[];
}

run('Stage 5.4 — document vault (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'VaultEmpty2026x';
  const email = `doc-vault-${String(stamp)}@hrms.test`;
  let token: string;
  let userId: number;
  let employeeId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false, rateLimits: TEST_RATE_LIMITS });

    const companyId = (
      await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow()
    ).id;

    const employee = await db
      .insertInto('core.employees')
      .values({
        ecode: `DOC${String(stamp).slice(-8)}`,
        company_id: companyId,
        first_name: 'Vault',
        last_name: 'Empty',
        work_email: email,
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    employeeId = employee.id;

    const user = await db
      .insertInto('core.users')
      .values({
        email,
        password_hash: await hashPassword(password),
        employee_id: employeeId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    userId = user.id;

    const role = await db
      .selectFrom('core.roles')
      .select('id')
      .where('code', '=', 'employee')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: userId, role_id: role.id, scope_org_unit_id: null })
      .execute();

    // Ensure the employee role actually holds doc.vault.own in this DB
    // (seed may lag behind source if seed:rbac was not re-run).
    const perm = await db
      .selectFrom('core.permissions')
      .select('id')
      .where('code', '=', 'doc.vault.own')
      .executeTakeFirst();
    if (perm) {
      await db
        .insertInto('core.role_permissions')
        .values({ role_id: role.id, permission_id: perm.id, scope: 'own' })
        .onConflict((oc) => oc.columns(['role_id', 'permission_id']).doNothing())
        .execute();
    }

    const login = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(login.status).toBe(200);
    token = (login.body as LoginBody).accessToken;
  });

  afterAll(async () => {
    await db.updateTable('core.users').set({ is_active: false }).where('id', '=', userId).execute();
    await db.destroy();
  });

  it('lists an empty vault for a new employee', async () => {
    const res = await request(app)
      .get('/api/documents/mine')
      .set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const body = res.body as MineBody;
    expect(body.rows).toEqual([]);
  });

  it('returns the seeded type catalog', async () => {
    const res = await request(app)
      .get('/api/documents/types')
      .set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const types = (res.body as { types: { code: string }[] }).types.map((t) => t.code);
    expect(types).toEqual(expect.arrayContaining(['pan', 'aadhaar', 'appointment', 'medical_fitness']));
  });
});
