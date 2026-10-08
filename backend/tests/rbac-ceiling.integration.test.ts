/**
 * THE `admin.roles` CEILING — regression net for docs/audit/05-SECURITY-REVIEW.md §3.
 *
 * The audit took an `it_admin` account — the role docs/08 §2 says must NEVER
 * hold `employee.compensation.read`, with "no HR data authority" — and in three
 * API calls granted itself the statutory-ID permission, assigned itself
 * `super_admin`, and read another employee's unmasked PAN, Aadhaar, UAN and bank
 * account. No ceiling, no self-grant check, no step-up.
 *
 * The rule asserted here: you cannot hand out what you do not hold. Roles in
 * this system are additive rather than ranked (docs/08 §1), so "grant ≤ own
 * level" is a comparison of permission SETS, which is what these cases check.
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

interface LoginBody { accessToken: string }
interface ErrBody { message?: string }

run('admin.roles ceiling (finding D3)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const P = `RC${stamp.toString(36).toUpperCase().slice(0, 6)}`;
  const password = 'RbacCeiling-2026-x1!';

  let itToken = '';
  let itUserId = 0;
  let victimUserId = 0;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  async function makeUser(suffix: string, roleCode: string | null): Promise<{ id: number; email: string }> {
    const email = `${P}-${suffix}@hrms.test`.toLowerCase();
    const user = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password) })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (roleCode !== null) {
      const role = await db
        .selectFrom('core.roles').select('id').where('code', '=', roleCode).executeTakeFirstOrThrow();
      await db.insertInto('core.user_roles')
        .values({ user_id: user.id, role_id: role.id, scope_org_unit_id: null }).execute();
    }
    return { id: user.id, email };
  }

  /** Log in using the current documented auth contract. */
  async function loginElevated(email: string): Promise<string> {
    const login = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(login.status).toBe(200);
    const token = (login.body as LoginBody).accessToken;
    return token;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    await makeUser('admin', 'super_admin');
    const it = await makeUser('it', 'it_admin');
    itUserId = it.id;
    victimUserId = (await makeUser('victim', 'employee')).id;
    itToken = await loginElevated(it.email);
  }, 120_000);

  afterAll(async () => {
    await db.updateTable('core.users').set({ is_active: false })
      .where('id', 'in', [itUserId, victimUserId]).execute();
    await db.destroy();
  });

  it('EXPLOIT 1: it_admin cannot grant itself compensation.read (docs/08 hard rule)', async () => {
    const res = await request(app)
      .post('/api/rbac/grants').set(auth(itToken))
      .send({ role: 'it_admin', permission: 'employee.compensation.read', scope: 'all' });
    expect(res.status).toBe(403);
    expect((res.body as ErrBody).message).toContain('do not hold it');

    const still = await db
      .selectFrom('core.role_permissions as rp')
      .innerJoin('core.roles as r', 'r.id', 'rp.role_id')
      .innerJoin('core.permissions as p', 'p.id', 'rp.permission_id')
      .where('r.code', '=', 'it_admin').where('p.code', '=', 'employee.compensation.read')
      .select('rp.role_id').execute();
    expect(still).toHaveLength(0);
  });

  it('EXPLOIT 1b: nor the statutory-ID permission', async () => {
    const res = await request(app)
      .post('/api/rbac/grants').set(auth(itToken))
      .send({ role: 'it_admin', permission: 'employee.statutory_ids.read', scope: 'all' });
    expect(res.status).toBe(403);
  });

  it('EXPLOIT 2: it_admin cannot assign super_admin to anyone', async () => {
    const res = await request(app)
      .post('/api/rbac/user-roles').set(auth(itToken))
      .send({ userId: victimUserId, role: 'super_admin' });
    expect(res.status).toBe(403);
    // super_admin carries every permission, so the message names the excess.
    expect((res.body as ErrBody).message).toContain('do not hold');
  });

  it('EXPLOIT 2b: nor to itself — self-targeting is refused before any lattice check', async () => {
    const res = await request(app)
      .post('/api/rbac/user-roles').set(auth(itToken))
      .send({ userId: itUserId, role: 'it_admin' });
    expect(res.status).toBe(403);
    expect((res.body as ErrBody).message).toContain('your own roles');
  });

  it('cannot revoke a permission it does not hold — no unilateral outage of another domain', async () => {
    const res = await request(app)
      .delete('/api/rbac/grants').set(auth(itToken))
      .send({ role: 'payroll_admin', permission: 'payroll.reports', scope: 'all' });
    expect(res.status).toBe(403);
  });

  it('CAN still do its own job: grant and revoke a permission it holds', async () => {
    // it_admin holds admin.devices, so handing it to another role is legitimate
    // administration — the ceiling must not become a blanket deny.
    const grant = await request(app)
      .post('/api/rbac/grants').set(auth(itToken))
      .send({ role: 'employee', permission: 'admin.devices', scope: 'all' });
    expect(grant.status).toBe(200);

    const revoke = await request(app)
      .delete('/api/rbac/grants').set(auth(itToken))
      .send({ role: 'employee', permission: 'admin.devices', scope: 'all' });
    expect(revoke.status).toBe(200);
  });

  it('cannot widen a readonly grant into authority for another role', async () => {
    const permission = await db.selectFrom('core.permissions').select('id')
      .where('code', '=', 'admin.devices').executeTakeFirstOrThrow();
    const role = await db.selectFrom('core.roles').select('id')
      .where('code', '=', 'it_admin').executeTakeFirstOrThrow();
    await db.updateTable('core.role_permissions').set({ scope: 'readonly' })
      .where('role_id', '=', role.id).where('permission_id', '=', permission.id).execute();
    try {
      const denied = await request(app).post('/api/rbac/grants').set(auth(itToken))
        .send({ role: 'employee', permission: 'admin.devices', scope: 'all' });
      expect(denied.status).toBe(403);
    } finally {
      await db.updateTable('core.role_permissions').set({ scope: 'all' })
        .where('role_id', '=', role.id).where('permission_id', '=', permission.id).execute();
    }
  });

  it('the DATABASE refuses to leave the platform with no active super_admin', async () => {
    const superRole = await db
      .selectFrom('core.roles').select('id').where('code', '=', 'super_admin').executeTakeFirstOrThrow();
    await expect(
      db.deleteFrom('core.user_roles').where('role_id', '=', superRole.id).execute(),
    ).rejects.toThrow(/no active super_admin/);
  });

  it('the DATABASE also refuses deactivating all super_admin users', async () => {
    const admins = db.selectFrom('core.user_roles as ur')
      .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
      .where('r.code', '=', 'super_admin').select('ur.user_id');
    await expect(db.updateTable('core.users').set({ is_active: false })
      .where('id', 'in', admins).execute()).rejects.toThrow(/no active super_admin/);
  });

  it('cannot disable administration by revoking or narrowing the admin.roles grant', async () => {
    const role = await db.selectFrom('core.roles').select('id')
      .where('code', '=', 'super_admin').executeTakeFirstOrThrow();
    const permission = await db.selectFrom('core.permissions').select('id')
      .where('code', '=', 'admin.roles').executeTakeFirstOrThrow();
    await expect(db.deleteFrom('core.role_permissions').where('role_id', '=', role.id)
      .where('permission_id', '=', permission.id).execute()).rejects.toThrow(/no active super_admin/);
    await expect(db.updateTable('core.role_permissions').set({ scope: 'own' })
      .where('role_id', '=', role.id).where('permission_id', '=', permission.id).execute())
      .rejects.toThrow(/no active super_admin/);
  });

  it('the user transition trigger allows ordinary account updates', async () => {
    await db.updateTable('core.users').set({ failed_attempts: 1 })
      .where('id', '=', victimUserId).execute();
    const victim = await db.selectFrom('core.users').select(['failed_attempts', 'is_active'])
      .where('id', '=', victimUserId).executeTakeFirstOrThrow();
    expect(victim).toEqual({ failed_attempts: 1, is_active: true });
  });
});
