/** CORE-10 / ATT-17: readonly grants never supply write authority or widen write scope. */
import 'dotenv/config';
import express from 'express';
import { OpenAPIHandler } from '@orpc/openapi/node';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely, Transaction } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import type { PermissionCode, Scope } from '../src/core/rbac/seed-data.js';
import { getUserPermissionAccess } from '../src/core/rbac/permissions.service.js';
import { employeeScopeSql } from '../src/core/rbac/employee-scope.js';
import { withAnyPermission, withPermission } from '../src/api/orpc.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { createApp } from '../src/app.js';
import { httpRequest } from './http-client.js';

const url = process.env['DATABASE_URL'];
const secret = 'permission-authority-integration-only-secret';
const rollback = new Error('Intentional authority fixture rollback');
interface Fixture {
  trx: Transaction<Database>;
  userId: number;
  employeeId: number;
  unitA: number;
  unitB: number;
  outsideId: number;
  token: string;
  grant: (permission: PermissionCode, scope: Scope, unitId?: number) => Promise<number>;
}

// Production gates, exercised through actual HTTP and native PostgreSQL.
const scopedWrite = withPermission('attendance.manual_override')
  .route({ method: 'POST', path: '/scope-write' })
  .input(z.object({}))
  .output(z.object({ ids: z.array(z.number()), canAdministerSettings: z.boolean() }))
  .handler(async ({ context }) => ({
    ids: (await context.db.selectFrom('core.employees as e').select('e.id')
      .where(employeeScopeSql({ ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, 'e')).execute()).map(row => row.id),
    canAdministerSettings: context.permissions.has('admin.settings'),
  }));
const alternativeWrite = withAnyPermission('admin.settings', 'attendance.manual_override')
  .route({ method: 'POST', path: '/alternative-write' })
  .input(z.object({}))
  .output(z.object({ all: z.boolean(), units: z.array(z.number()) }))
  .handler(({ context }) => ({ all: context.permissionAccess.all, units: [...context.permissionAccess.orgUnitIds] }));
const safeRead = withPermission('attendance.manual_override')
  .route({ method: 'GET', path: '/scope-read' })
  .input(z.object({}))
  .output(z.object({ ids: z.array(z.number()) }))
  .handler(async ({ context }) => ({
    ids: (await context.db.selectFrom('core.employees as e').select('e.id')
      .where(employeeScopeSql({ ...context.permissionAccess, actorEmployeeId: context.user.employee_id }, 'e')).execute()).map(row => row.id),
  }));

function appFor(trx: Transaction<Database>) {
  const handler = new OpenAPIHandler({ scopedWrite, alternativeWrite, safeRead });
  const app = express();
  app.use(async (req, res, next) => {
    const { matched } = await handler.handle(req, res, {
      context: { db: trx, jwtSecret: secret, secureCookies: false, req, res },
    });
    if (!matched) next();
  });
  return app;
}

describe.skipIf(!url)('CORE-10 permission action authority (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  let fixtureNo = 0;
  const stamp = String(Date.now());
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });

  async function fixture(run: (fixture: Fixture) => Promise<void>) {
    try {
      await db.transaction().execute(async trx => {
        const tag = `authority_${stamp}_${++fixtureNo}`;
        const company = await trx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false }).returning('id').executeTakeFirstOrThrow();
        const units = [];
        for (const suffix of ['A', 'B']) {
          units.push((await trx.insertInto('core.org_units').values({ company_id: company.id, name: `${tag}_${suffix}` }).returning('id').executeTakeFirstOrThrow()).id);
        }
        const unitA = units[0];
        const unitB = units[1];
        if (unitA === undefined || unitB === undefined) throw new Error('Authority fixture requires two units');
        const employee = await trx.insertInto('core.employees').values({ ecode: `${tag}_actor`, company_id: company.id, org_unit_id: unitA, first_name: 'Authority actor', status: 'active' }).returning('id').executeTakeFirstOrThrow();
        const outside = await trx.insertInto('core.employees').values({ ecode: `${tag}_outside`, company_id: company.id, org_unit_id: unitB, first_name: 'Authority outside', status: 'active' }).returning('id').executeTakeFirstOrThrow();
        const user = await trx.insertInto('core.users').values({ email: `${tag}@hrms.test`, password_hash: 'disabled-authority-fixture', employee_id: employee.id }).returning('id').executeTakeFirstOrThrow();
        const session = await trx.insertInto('sec.sessions').values({ user_id: user.id, expires_at: new Date(Date.now() + 3600000) }).returning('sid').executeTakeFirstOrThrow();
        let grantNo = 0;
        const grant = async (permission: PermissionCode, scope: Scope, unitId?: number) => {
          const role = await trx.insertInto('core.roles').values({ code: `${tag}_${++grantNo}`, name: tag }).returning('id').executeTakeFirstOrThrow();
          const p = await trx.selectFrom('core.permissions').select('id').where('code', '=', permission).executeTakeFirstOrThrow();
          await trx.insertInto('core.role_permissions').values({ role_id: role.id, permission_id: p.id, scope }).execute();
          await trx.insertInto('core.user_roles').values({ role_id: role.id, user_id: user.id, scope_org_unit_id: unitId ?? null }).execute();
          return role.id;
        };
        await run({ trx, userId: user.id, employeeId: employee.id, outsideId: outside.id, unitA, unitB, grant, token: await signAccessToken(user.id, `${tag}@hrms.test`, secret, session.sid) });
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
  }

  it('rejects an actual HR attendance mutation backed only by a readonly grant, without day or audit writes', async () => fixture(async f => {
    await f.grant('attendance.manual_override', 'readonly');
    const app = createApp({ db: f.trx, jwtSecret: secret, secureCookies: false });
    const response = await (await httpRequest(app)).put('/api/attendance/days/override')
      .set('Authorization', `Bearer ${f.token}`).send({ employeeId: f.outsideId, date: '2026-10-01', status: 'A', reason: 'Authority regression fixture' });
    expect(response.status).toBe(403);
    expect(await f.trx.selectFrom('att.day_records').select('id').where('employee_id', '=', f.outsideId).execute()).toHaveLength(0);
    expect(await f.trx.selectFrom('core.audit_log').select('id').where('actor_user_id', '=', f.userId).execute()).toHaveLength(0);
  }));

  it('preserves global read access while excluding readonly grants from a mixed org-scoped write', async () => fixture(async f => {
    await f.grant('attendance.manual_override', 'readonly');
    await f.grant('attendance.manual_override', 'org_unit', f.unitA);
    const app = appFor(f.trx);
    const read = await (await httpRequest(app)).get('/scope-read').set('Authorization', `Bearer ${f.token}`);
    expect(read.status).toBe(200);
    expect((read.body as { ids: number[] }).ids).toContain(f.outsideId);
    const write = await (await httpRequest(app)).post('/scope-write').set('Authorization', `Bearer ${f.token}`).send({});
    expect(write.status).toBe(200);
    const ids = (write.body as { ids: number[] }).ids;
    expect(ids).toContain(f.employeeId);
    expect(ids).not.toContain(f.outsideId);
  }));

  it('keeps a readonly grant bounded by the assigned organizational unit', async () => fixture(async f => {
    await f.grant('attendance.manual_override', 'readonly', f.unitA);
    const response = await (await httpRequest(appFor(f.trx))).get('/scope-read').set('Authorization', `Bearer ${f.token}`);
    expect(response.status).toBe(200);
    expect((response.body as { ids: number[] }).ids).toEqual([f.employeeId]);
  }));

  it('does not borrow readonly authority for a secondary permission inside a write handler', async () => fixture(async f => {
    await f.grant('attendance.manual_override', 'own');
    await f.grant('admin.settings', 'readonly');
    const response = await (await httpRequest(appFor(f.trx))).post('/scope-write').set('Authorization', `Bearer ${f.token}`).send({});
    expect(response.status).toBe(200);
    expect((response.body as { canAdministerSettings: boolean }).canAdministerSettings).toBe(false);
  }));

  it('uses an eligible writable alternative instead of an earlier readonly alternative', async () => fixture(async f => {
    await f.grant('admin.settings', 'readonly');
    await f.grant('attendance.manual_override', 'org_unit', f.unitA);
    const response = await (await httpRequest(appFor(f.trx))).post('/alternative-write').set('Authorization', `Bearer ${f.token}`).send({});
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ all: false, units: [f.unitA] });
  }));

  it('rejects writes through all-readonly alternative permissions', async () => fixture(async f => {
    await f.grant('admin.settings', 'readonly');
    await f.grant('attendance.manual_override', 'readonly');
    const response = await (await httpRequest(appFor(f.trx))).post('/alternative-write').set('Authorization', `Bearer ${f.token}`).send({});
    expect(response.status).toBe(403);
  }));

  it('revokes writes on the next request while retaining a separate readonly grant', async () => fixture(async f => {
    await f.grant('attendance.manual_override', 'readonly');
    const writableRole = await f.grant('attendance.manual_override', 'all');
    const app = appFor(f.trx);
    const invoke = async () => (await httpRequest(app)).post('/scope-write').set('Authorization', `Bearer ${f.token}`).send({});
    expect((await invoke()).status).toBe(200);
    await f.trx.deleteFrom('core.user_roles').where('user_id', '=', f.userId).where('role_id', '=', writableRole).execute();
    expect((await invoke()).status).toBe(403);
    expect((await (await httpRequest(app)).get('/scope-read').set('Authorization', `Bearer ${f.token}`)).status).toBe(200);
  }));

  it('preserves own-only writes alongside a global readonly grant', async () => fixture(async f => {
    await f.grant('attendance.manual_override', 'readonly');
    await f.grant('attendance.manual_override', 'own');
    const response = await (await httpRequest(appFor(f.trx))).post('/scope-write').set('Authorization', `Bearer ${f.token}`).send({});
    expect(response.status).toBe(200);
    expect((response.body as { ids: number[] }).ids).toEqual([f.employeeId]);
  }));

  it('returns no write scope when every matching grant is readonly', async () => fixture(async f => {
    await f.grant('attendance.manual_override', 'readonly');
    expect(await getUserPermissionAccess(f.trx, f.userId, 'attendance.manual_override', 'write')).toBeNull();
    expect(await getUserPermissionAccess(f.trx, f.userId, 'admin.settings')).toBeNull();
  }));

  it('retains subtree write scope without inheriting global readonly access', async () => fixture(async f => {
    await f.grant('attendance.manual_override', 'readonly');
    await f.grant('attendance.manual_override', 'subtree');
    expect(await getUserPermissionAccess(f.trx, f.userId, 'attendance.manual_override', 'write'))
      .toEqual({ all: false, own: false, subtree: true, orgUnitIds: [] });
  }));

  it('preserves an explicitly read-only POST payroll list without authorizing payroll creation', async () => fixture(async f => {
    await f.grant('payroll.run.view', 'readonly');
    await f.grant('payroll.run.manage', 'readonly');
    const app = createApp({ db: f.trx, jwtSecret: secret, secureCookies: false });
    const read = await (await httpRequest(app)).post('/api/payroll/runs/list').set('Authorization', `Bearer ${f.token}`).send({ company_id: -1 });
    expect(read.status).toBe(200);
    expect(read.body).toEqual([]);
    const write = await (await httpRequest(app)).post('/api/payroll/runs/create').set('Authorization', `Bearer ${f.token}`).send({ company_id: -1, month: '2026-10-01' });
    expect(write.status).toBe(403);
  }));

  it('does not turn a readonly helpdesk agent into an author of another employee’s ticket', async () => fixture(async f => {
    await f.grant('helpdesk.agent', 'readonly');
    const category = await f.trx.selectFrom('hd.categories').select('id').where('code', '=', 'it').executeTakeFirstOrThrow();
    const owner = await f.trx.insertInto('core.users').values({ email: `owner_${f.userId}@hrms.test`, password_hash: 'disabled-fixture' }).returning('id').executeTakeFirstOrThrow();
    const ticket = await f.trx.insertInto('hd.tickets').values({ ticket_no: `authority_${f.userId}`, raised_by: owner.id, assignee_user_id: f.userId, category_id: category.id, subject: 'Authority fixture', body: 'Fixture', sla_due_at: new Date('2027-01-01') }).returning('id').executeTakeFirstOrThrow();
    const response = await (await httpRequest(createApp({ db: f.trx, jwtSecret: secret, secureCookies: false }))).post(`/api/helpdesk/tickets/${ticket.id}/reply`).set('Authorization', `Bearer ${f.token}`).send({ body: 'Readonly agent attempt', isInternal: true });
    expect(response.status).toBe(403);
    expect(await f.trx.selectFrom('hd.ticket_messages').select('id').where('ticket_id', '=', ticket.id).execute()).toHaveLength(0);
  }));
});
