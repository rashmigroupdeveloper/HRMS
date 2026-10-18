/** CORE-10 / WF-01 / ATT-07: scoped role queues cannot leak or approve OD. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { createRegularization } from '../src/modules/attendance/index.js';
import { act } from '../src/modules/workflows/index.js';
import { resolveApprover } from '../src/modules/workflows/workflow-approvers.js';
import { addDaysIso, istDateString } from '../src/core/dates.js';
import { httpRequest } from './http-client.js';
import { expectHttpStatus } from './http-assertions.js';

const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('WF-01 scoped approvers against native PostgreSQL', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const roleCode = `wfscope_${stamp}`;
  const heldDefinition = `wfscope_hold_${stamp}`;
  const password = 'Workflow-scope-fixture-1!';
  const users: number[] = [];
  const employees: number[] = [];
  let companyId = 0;
  let unitA: number;
  let unitB: number;
  let roleId = 0;
  let subjectId = 0;
  let managerId: number;
  let ownerUser: number;
  let insideUser: number;
  let outsideUser: number;
  let insideToken: string;
  let outsideToken: string;
  let ownerToken: string;
  let dateOffset = 0;

  async function user(suffix: string, employeeId: number | null, scope: number | null) {
    const row = await db.insertInto('core.users').values({
      email: `wfscope-${stamp}-${suffix}@hrms.test`, employee_id: employeeId,
      password_hash: await hashPassword(password),
    }).returning('id').executeTakeFirstOrThrow();
    users.push(row.id);
    if (suffix !== 'owner' && suffix !== 'manager') await db.insertInto('core.user_roles')
      .values({ user_id: row.id, role_id: roleId, scope_org_unit_id: scope }).execute();
    return row.id;
  }
  async function login(suffix: string) {
    const response = await (await httpRequest(app)).post('/api/auth/login')
      .send({ identifier: `wfscope-${stamp}-${suffix}@hrms.test`, password });
    expectHttpStatus(response, 200);
    return (response.body as { accessToken: string }).accessToken;
  }
  async function pendingOd(onDate?: string) {
    let date = onDate ?? addDaysIso(istDateString(), 10 + dateOffset++ * 3);
    if (!onDate) {
      // Closed fixture months are immutable, just like real closed months.
      while (await db.selectFrom('att.month_locks').select('id').where('company_id', '=', companyId)
        .where('month', '=', sql<Date>`${`${date.slice(0, 7)}-01`}::date`).executeTakeFirst()) {
        date = addDaysIso(date, 32);
      }
    }
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) date = addDaysIso(date, 1);
    const created = await createRegularization(db, {
      employeeId: subjectId, requestedByUserId: ownerUser, kind: 'OD',
      fromDate: date, toDate: date, reason: 'Scoped official-duty regression fixture',
    });
    // Simulate a pre-existing named notification whose role scope has moved.
    // The current runtime scope must still govern inbox, detail and action.
    await db.updateTable('wf.request_steps').set({ approver_spec: `role:${roleCode}`, approver_user_id: outsideUser })
      .where('request_id', '=', created.workflowRequestId).where('action', 'is', null).execute();
    return { ...created, date };
  }
  beforeAll(async () => {
    db = createDatabase(url ?? '');
    app = createApp({ db, jwtSecret: process.env['JWT_SECRET'] ?? 'workflow-fixture-secret-at-least-32-characters', secureCookies: false });
    // Audit scopes reference these stable, explicitly named fixture masters.
    // Reuse them across serialized runs; never delete immutable audit parents.
    await db.insertInto('core.companies').values({ code: 'WF-SCOPE-FIXTURE', ecode_prefix: 'WFSCOPEFIXTURE',
      name: 'Workflow scope test fixture' }).onConflict(oc => oc.column('code').doNothing()).execute();
    companyId = (await db.selectFrom('core.companies').select('id')
      .where('code', '=', 'WF-SCOPE-FIXTURE').where('ecode_prefix', '=', 'WFSCOPEFIXTURE').executeTakeFirstOrThrow()).id;
    async function unit(name: string) {
      const existing = await db.selectFrom('core.org_units').select('id').where('company_id', '=', companyId).where('name', '=', name).executeTakeFirst();
      return existing?.id ?? (await db.insertInto('core.org_units').values({ company_id: companyId, name }).returning('id').executeTakeFirstOrThrow()).id;
    }
    unitA = await unit('Workflow scope fixture A'); unitB = await unit('Workflow scope fixture B');
    roleId = (await db.insertInto('core.roles').values({ code: roleCode, name: 'Scoped approval fixture' }).returning('id').executeTakeFirstOrThrow()).id;
    const permission = await db.selectFrom('core.permissions').select('id').where('code', '=', 'od.approve').executeTakeFirstOrThrow();
    await db.insertInto('core.role_permissions').values({ role_id: roleId, permission_id: permission.id, scope: 'org_unit' }).execute();
    const routingPermission = await db.selectFrom('core.permissions').select('id').where('code', '=', 'admin.settings').executeTakeFirstOrThrow();
    await db.insertInto('core.role_permissions').values({ role_id: roleId, permission_id: routingPermission.id, scope: 'org_unit' }).execute();
    await db.insertInto('wf.definitions').values({ code: heldDefinition, name: 'Scoped hold fixture',
      steps: JSON.stringify([{ step: 1, approver: 'functional_manager', slaHours: 48, onBreach: 'auto_approve' }]),
    }).execute();
    managerId = (await db.insertInto('core.employees').values({ company_id: companyId, org_unit_id: unitA,
      ecode: `WF${stamp}M`, first_name: 'Workflow manager', status: 'active' }).returning('id').executeTakeFirstOrThrow()).id;
    employees.push(managerId);
    subjectId = (await db.insertInto('core.employees').values({ company_id: companyId, org_unit_id: unitA,
      ecode: `WF${stamp}E`, first_name: 'Workflow employee', status: 'active', reporting_manager_id: managerId })
      .returning('id').executeTakeFirstOrThrow()).id;
    employees.push(subjectId);
    await user('manager', managerId, null);
    ownerUser = await user('owner', subjectId, null);
    const employeeRole = await db.selectFrom('core.roles').select('id').where('code', '=', 'employee').executeTakeFirstOrThrow();
    await db.insertInto('core.user_roles').values({ user_id: ownerUser, role_id: employeeRole.id }).execute();
    outsideUser = await user('outside', null, unitB); // lower ID must not win resolution
    insideUser = await user('inside', null, unitA);
    await user('unscoped', null, null);
    outsideToken = await login('outside'); insideToken = await login('inside'); ownerToken = await login('owner');
  });
  afterAll(async () => {
    try {
      const requests = await db.selectFrom('wf.requests').select('id').where('subject_employee_id', '=', subjectId).execute();
      const ids = requests.map(row => row.id);
      await db.deleteFrom('att.regularizations').where('employee_id', '=', subjectId).execute();
      if (ids.length) {
        await db.deleteFrom('wf.request_steps').where('request_id', 'in', ids).execute();
        await db.deleteFrom('wf.requests').where('id', 'in', ids).execute();
      }
      await db.deleteFrom('att.day_records').where('employee_id', '=', subjectId).where('is_locked', '=', false).execute();
      if (users.length) {
        await db.deleteFrom('core.user_roles').where('user_id', 'in', users).execute();
        await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('id', 'in', users).execute();
      }
      if (employees.length) await db.deleteFrom('core.employees').where('id', 'in', employees).execute();
      await db.deleteFrom('core.role_permissions').where('role_id', '=', roleId).execute();
      await db.deleteFrom('core.roles').where('id', '=', roleId).execute();
      await db.deleteFrom('wf.definitions').where('code', '=', heldDefinition).execute();
      // Audited company/org-unit identities remain; no active users/employees or open requests remain.
    } finally { await db.destroy(); }
  });

  it('resolves a scoped eligible role holder rather than the lowest active user ID', async () => {
    expect((await resolveApprover(db, `role:${roleCode}`, subjectId, 'od'))?.userId).toBe(insideUser);
  });
  it('keeps another unit out of the inbox, timeline and action even if named on the old step', async () => {
    const request = await pendingOd();
    const queue = await (await httpRequest(app)).get('/api/workflows/inbox').set('Authorization', `Bearer ${outsideToken}`);
    expectHttpStatus(queue, 200);
    expect((queue.body as { requestId: number }[]).some(row => row.requestId === request.workflowRequestId)).toBe(false);
    const detail = await (await httpRequest(app)).get(`/api/workflows/requests/${request.workflowRequestId}`).set('Authorization', `Bearer ${outsideToken}`);
    expectHttpStatus(detail, 403);
    const refused = await (await httpRequest(app)).post(`/api/workflows/requests/${request.workflowRequestId}/act`)
      .set('Authorization', `Bearer ${outsideToken}`).send({ action: 'approve' });
    expectHttpStatus(refused, 403);
    const accepted = await (await httpRequest(app)).post(`/api/workflows/requests/${request.workflowRequestId}/act`)
      .set('Authorization', `Bearer ${insideToken}`).send({ action: 'approve' });
    expectHttpStatus(accepted, 200);
    const calendar = await (await httpRequest(app)).get(`/api/my/attendance?month=${request.date.slice(0, 7)}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expectHttpStatus(calendar, 200);
    expect((calendar.body as { date: string; status: string }[]).find(day => day.date === request.date)?.status).toBe('OD');
  });
  it('revocation takes effect on the next inbox and decision request', async () => {
    const request = await pendingOd();
    await db.updateTable('wf.request_steps').set({ approver_user_id: insideUser })
      .where('request_id', '=', request.workflowRequestId).execute();
    await db.deleteFrom('core.user_roles').where('user_id', '=', insideUser).where('role_id', '=', roleId).execute();
    try {
      await expect(resolveApprover(db, `role:${roleCode}`, subjectId, 'od')).rejects.toThrow(/No authorized approver/);
      const queue = await (await httpRequest(app)).get('/api/workflows/inbox').set('Authorization', `Bearer ${insideToken}`);
      expectHttpStatus(queue, 200);
      expect((queue.body as { requestId: number }[]).some(row => row.requestId === request.workflowRequestId)).toBe(false);
      const response = await (await httpRequest(app)).post(`/api/workflows/requests/${request.workflowRequestId}/act`)
        .set('Authorization', `Bearer ${insideToken}`).send({ action: 'approve' });
      expectHttpStatus(response, 403);
    } finally {
      await db.insertInto('core.user_roles').values({ user_id: insideUser, role_id: roleId, scope_org_unit_id: unitA }).execute();
    }
    const saved = await db.selectFrom('wf.requests').select('status').where('id', '=', request.workflowRequestId).executeTakeFirstOrThrow();
    expect(saved.status).toBe('pending');
    expect(await db.selectFrom('att.day_records').select('id').where('employee_id', '=', subjectId)
      .where('work_date', '=', sql<Date>`${request.date}::date`).executeTakeFirst()).toBeUndefined();
  });
  it('rejects approval for a closed company-month even when that date has no day row', async () => {
    // A date no other case uses (today+10 collided with the first approved OD → flaky day-row assertion).
    const request = await pendingOd(addDaysIso(istDateString(), 400));
    const month = `${request.date.slice(0, 7)}-01`;
    await db.insertInto('att.month_locks').values({ company_id: companyId,
      month: sql<Date>`${month}::date`, locked_by: insideUser,
    }).onConflict(oc => oc.columns(['company_id', 'month']).doNothing()).execute();
    await expect(act(db, { requestId: request.workflowRequestId, actorUserId: insideUser, action: 'approve' }))
      .rejects.toThrow(/month is locked/);
    const saved = await db.selectFrom('wf.requests').select('status').where('id', '=', request.workflowRequestId).executeTakeFirstOrThrow();
    expect(saved.status).toBe('pending');
    const domain = await db.selectFrom('att.regularizations').select('applied')
      .where('workflow_request_id', '=', request.workflowRequestId).executeTakeFirstOrThrow();
    expect(domain.applied).toBe(false);
    expect(await db.selectFrom('att.day_records').select('id').where('employee_id', '=', subjectId)
      .where('work_date', '=', sql<Date>`${request.date}::date`).executeTakeFirst()).toBeUndefined();
    // Retain the immutable lock and its inactive audited user; never disable triggers.
  });

  it('holds for HR and permits only scoped routing repair, not implicit approval', async () => {
    const created = await (await httpRequest(app)).post('/api/workflows/requests')
      .auth(ownerToken, { type: 'bearer' }).send({ definitionCode: heldDefinition, payload: { reason: 'Hold regression' } });
    expectHttpStatus(created, 200);
    const { requestId } = created.body as { requestId: number };
    const detail = await (await httpRequest(app)).get(`/api/workflows/requests/${requestId}`).auth(ownerToken, { type: 'bearer' });
    expectHttpStatus(detail, 200);
    expect(detail.body as { status: string; routingState: string; steps: unknown[] }).toMatchObject({
      status: 'pending', routingState: 'held_for_hr', steps: [],
    });
    const holds = await (await httpRequest(app)).get('/api/workflows/routing-holds?limit=100').auth(insideToken, { type: 'bearer' });
    expectHttpStatus(holds, 200);
    expect((holds.body as { requestId: number }[]).some(r => r.requestId === requestId)).toBe(true);
    const outside = await (await httpRequest(app)).get('/api/workflows/routing-holds?limit=100').auth(outsideToken, { type: 'bearer' });
    expectHttpStatus(outside, 200);
    expect((outside.body as { requestId: number }[]).some(r => r.requestId === requestId)).toBe(false);
    const retryUrl = `/api/workflows/requests/${requestId}/retry-routing`;
    for (const deniedToken of [outsideToken, ownerToken]) {
      const denied = await (await httpRequest(app)).post(retryUrl).auth(deniedToken, { type: 'bearer' }).send({ reason: 'Attempt outside authority' });
      expectHttpStatus(denied, 403);
    }
    const routingPermission = await db.selectFrom('core.permissions').select('id').where('code', '=', 'admin.settings').executeTakeFirstOrThrow();
    await db.updateTable('core.role_permissions').set({ scope: 'readonly' }).where('role_id', '=', roleId)
      .where('permission_id', '=', routingPermission.id).execute();
    try {
      const readonly = await (await httpRequest(app)).post(retryUrl).auth(insideToken, { type: 'bearer' })
        .send({ reason: 'A readonly grant cannot repair routing' });
      expectHttpStatus(readonly, 403);
    } finally {
      await db.updateTable('core.role_permissions').set({ scope: 'org_unit' }).where('role_id', '=', roleId)
        .where('permission_id', '=', routingPermission.id).execute();
    }
    // A repeated retry without a repaired hierarchy still holds.
    const stillHeld = await (await httpRequest(app)).post(retryUrl).auth(insideToken, { type: 'bearer' }).send({ reason: 'Check unresolved hierarchy' });
    expectHttpStatus(stillHeld, 200);
    expect(stillHeld.body as { routingState: string }).toEqual({ routingState: 'held_for_hr' });
    await db.updateTable('core.employees').set({ functional_manager_id: managerId }).where('id', '=', subjectId).execute();
    const repairs = await Promise.all([1, 2].map(async () => (await httpRequest(app)).post(retryUrl)
      .auth(insideToken, { type: 'bearer' }).send({ reason: 'Functional manager restored' })));
    expect(repairs.map(r => r.status).sort()).toEqual([200, 400]);
    const open = await db.selectFrom('wf.request_steps').select('approver_user_id').where('request_id', '=', requestId)
      .where('action', 'is', null).execute();
    const managerUser = await db.selectFrom('core.users').select('id').where('employee_id', '=', managerId).executeTakeFirstOrThrow();
    expect(open).toEqual([{ approver_user_id: managerUser.id }]);
    expect((await db.selectFrom('wf.requests').select('status').where('id', '=', requestId).executeTakeFirstOrThrow()).status).toBe('pending');
    const notes = await db.selectFrom('wf.notifications').select('template_code').where('recipient_user_id', '=', ownerUser)
      .where(sql<boolean>`payload->>'requestId' = ${String(requestId)}`).execute();
    expect(notes.some(n => n.template_code === 'request_routing_held')).toBe(true);
    expect(notes.some(n => n.template_code === 'request_approved')).toBe(false);
  });
});
