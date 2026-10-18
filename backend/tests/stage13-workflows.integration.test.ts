/**
 * Stage 1.3 live proof (WF-01..04, doc 11 §4b):
 *  - every step carries a notification RECEIPT (the anti-PP-14 guarantee)
 *  - full chain walk: RM approve → HR step → approved
 *  - send_back → resubmit restarts the chain
 *  - non-approvers are refused; delegation reroutes with a trail
 *  - all-vacant approval chains remain pending for HR with audit
 *  - SLA breaches: escalate / lapse (OT) / auto-approve (RH)
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpRequest } from './http-client.js';
import { expectHttpStatus } from './http-assertions.js';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { act, createRequest, resubmit, runEscalations } from '../src/modules/workflows/index.js';
import { getUserPermissions, getUserRoleCodes } from '../src/core/rbac/permissions.service.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

run('Stage 1.3 — workflow engine (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'stage13-test-password-1!';
  const genericDefinitionCode = `s13_chain_${stamp}`;
  const editableDefinitionCode = `s13_edit_${stamp}`;

  // people: worker → manager → (hr user with hr_ops role)
  let workerEmpId: number;
  let managerEmpId: number;
  let workerUser: number;
  let managerUser: number;
  let hrUser: number;
  let delegateUser: number;
  const createdRequests: number[] = [];

  async function makeUser(email: string, employeeId?: number): Promise<number> {
    const row = await db
      .insertInto('core.users')
      .values({ email, password_hash: await hashPassword(password), employee_id: employeeId ?? null })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  async function token(email: string): Promise<string> {
    const res = await (await httpRequest(app)).post('/api/auth/login').send({ identifier: email, password });
    expectHttpStatus(res, 200);
    return (res.body as { accessToken: string }).accessToken;
  }

  async function giveRole(userId: number, roleCode: string): Promise<void> {
    const role = await db.selectFrom('core.roles').select('id').where('code', '=', roleCode).executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: userId, role_id: role.id, scope_org_unit_id: null })
      .onConflict((oc) => oc.columns(['user_id', 'role_id', 'scope_org_unit_id']).doNothing())
      .execute();
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });

    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const mgr = await db
      .insertInto('core.employees')
      .values({ ecode: `RML8${String(stamp).slice(-5)}M`, company_id: rml.id, first_name: 'S13 Manager', status: 'active' })
      .returning('id')
      .executeTakeFirstOrThrow();
    managerEmpId = mgr.id;
    const wrk = await db
      .insertInto('core.employees')
      .values({
        ecode: `RML8${String(stamp).slice(-5)}W`,
        company_id: rml.id,
        first_name: 'S13 Worker',
        status: 'active',
        reporting_manager_id: managerEmpId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    workerEmpId = wrk.id;

    workerUser = await makeUser(`s13-worker-${stamp}@hrms.test`, workerEmpId);
    managerUser = await makeUser(`s13-manager-${stamp}@hrms.test`, managerEmpId);
    hrUser = await makeUser(`s13-hr-${stamp}@hrms.test`);
    delegateUser = await makeUser(`s13-delegate-${stamp}@hrms.test`);
    await giveRole(hrUser, 'hr_ops');
    // Test the configurable generic engine without bypassing the dedicated
    // leave/attendance APIs or editing shared default workflow definitions.
    const steps = JSON.stringify([
      { step: 1, approver: 'reporting_manager', slaHours: 48, onBreach: 'escalate' },
    ]);
    await db.insertInto('wf.definitions').values([
      { code: genericDefinitionCode, name: 'S13 synthetic approval chain', steps },
      { code: editableDefinitionCode, name: 'S13 editable approval chain', steps },
    ]).execute();
    // Make this HR user the deterministic role resolution target? Resolution
    // picks the LOWEST active user id holding the role — existing test users
    // are inactive, so ours wins unless an older active hr_ops user exists.
  });

  afterAll(async () => {
    for (const id of createdRequests) {
      await db.deleteFrom('wf.request_steps').where('request_id', '=', id).execute();
      await db.deleteFrom('wf.requests').where('id', '=', id).execute();
    }
    await db.deleteFrom('wf.delegations').where('from_user_id', '=', managerUser).execute();
    await db.deleteFrom('wf.event_subscriptions').where('event_code', '=', 'workflow.routing_held')
      .where('recipient_kind', '=', 'user').where('recipient_ref', '=', String(hrUser)).execute();
    await db.deleteFrom('wf.definitions')
      .where('code', 'in', [genericDefinitionCode, editableDefinitionCode]).execute();
    await db.deleteFrom('core.user_roles').where('user_id', 'in', [workerUser, managerUser, hrUser, delegateUser]).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('id', 'in', [workerUser, managerUser, hrUser, delegateUser])
      .execute();
    await db.deleteFrom('core.employees').where('id', 'in', [workerEmpId, managerEmpId]).execute();
    await db.destroy();
  });

  it('generic request: step 1 lands on the RM with a notification RECEIPT (PP-14)', async () => {
    const t = await token(`s13-worker-${stamp}@hrms.test`);
    const res = await (await httpRequest(app))
      .post('/api/workflows/requests')
      .set('Authorization', `Bearer ${t}`)
      .send({ definitionCode: genericDefinitionCode, payload: { reason: 'Synthetic routing proof' } });
    expectHttpStatus(res, 200);
    const requestId = (res.body as { requestId: number }).requestId;
    createdRequests.push(requestId);

    // The receipt: step row has notified_at AND a queued notification exists.
    const step = await db
      .selectFrom('wf.request_steps')
      .selectAll()
      .where('request_id', '=', requestId)
      .executeTakeFirstOrThrow();
    expect(step.approver_user_id).toBe(managerUser);
    expect(step.notified_at).toBeInstanceOf(Date);

    const note = await db
      .selectFrom('wf.notifications')
      .select('id')
      .where('recipient_user_id', '=', managerUser)
      .where('template_code', '=', 'approval_pending')
      .execute();
    expect(note.length).toBeGreaterThanOrEqual(1);

    // It shows in the manager's inbox…
    const mt = await token(`s13-manager-${stamp}@hrms.test`);
    const inbox = await (await httpRequest(app)).get('/api/workflows/inbox').set('Authorization', `Bearer ${mt}`);
    expect((inbox.body as { requestId: number }[]).some((r) => r.requestId === requestId)).toBe(true);

    // …a stranger cannot act, the RM can.
    const st = await token(`s13-hr-${stamp}@hrms.test`);
    const forbidden = await (await httpRequest(app))
      .post(`/api/workflows/requests/${requestId}/act`)
      .set('Authorization', `Bearer ${st}`)
      .send({ requestId, action: 'approve' });
    expectHttpStatus(forbidden, 403);

    const approve = await (await httpRequest(app))
      .post(`/api/workflows/requests/${requestId}/act`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ requestId, action: 'approve', comment: 'Enjoy' });
    expectHttpStatus(approve, 200);
    expect((approve.body as { outcome: string }).outcome).toBe('approved'); // single-step chain
  });

  it('send_back → requester fixes → resubmit restarts the chain (doc 11 §4b)', async () => {
    const wt = await token(`s13-worker-${stamp}@hrms.test`);
    const mt = await token(`s13-manager-${stamp}@hrms.test`);

    const created = await (await httpRequest(app))
      .post('/api/workflows/requests')
      .set('Authorization', `Bearer ${wt}`)
      .send({ definitionCode: genericDefinitionCode, payload: { reason: 'forgot' } });
    expectHttpStatus(created, 200);
    const requestId = (created.body as { requestId: number }).requestId;
    createdRequests.push(requestId);

    const back = await (await httpRequest(app))
      .post(`/api/workflows/requests/${requestId}/act`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ requestId, action: 'send_back', comment: 'Reason too vague — which gate?' });
    expectHttpStatus(back, 200);
    expect((back.body as { outcome: string }).outcome).toBe('sent_back');

    const resub = await (await httpRequest(app))
      .post(`/api/workflows/requests/${requestId}/resubmit`)
      .set('Authorization', `Bearer ${wt}`)
      .send({ requestId, payload: { date: '2026-08-01', reason: 'Kent door S4 offline, gate register signed' } });
    expectHttpStatus(resub, 200);

    const timeline = await (await httpRequest(app))
      .get(`/api/workflows/requests/${requestId}`)
      .set('Authorization', `Bearer ${wt}`);
    const body = timeline.body as { status: string; steps: { action: string | null }[] };
    expect(body.status).toBe('pending');
    expect(body.steps.map((s) => s.action)).toEqual(['sent_back', null]); // round 1 + fresh step
  });

  it('CORE-10 derives manager approval permissions from the live reporting tree', async () => {
    expect(await getUserRoleCodes(db, managerUser)).toContain('manager');
    expect(await getUserPermissions(db, managerUser)).toContain('ar.approve');
    expect(await getUserPermissions(db, managerUser)).toContain('leave.approve');
    expect(await getUserRoleCodes(db, workerUser)).not.toContain('manager');
  });

  it.each(['reject', 'send_back'] as const)('WF-04 refuses %s without a decision reason', async action => {
    const requestId = await createRequest(db, {
      definitionCode: genericDefinitionCode, subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser, payload: { reason: 'Decision-note regression' },
    });
    createdRequests.push(requestId);
    const mt = await token(`s13-manager-${stamp}@hrms.test`);
    const response = await (await httpRequest(app)).post(`/api/workflows/requests/${requestId}/act`)
      .set('Authorization', `Bearer ${mt}`).send({ requestId, action, comment: '   ' });
    expectHttpStatus(response, 400);
    const request = await db.selectFrom('wf.requests').select('status').where('id', '=', requestId).executeTakeFirstOrThrow();
    expect(request.status).toBe('pending');
    const step = await db.selectFrom('wf.request_steps').select('action').where('request_id', '=', requestId).executeTakeFirstOrThrow();
    expect(step.action).toBeNull();
  });

  it.each(['leave', 'leave_cancel', 'leave_encashment', 'comp_off', 'restricted_holiday', 'regularization', 'od', 'overtime'])(
    'WF-01 refuses %s through the generic API so domain validation cannot be bypassed',
    async definitionCode => {
      const t = await token(`s13-worker-${stamp}@hrms.test`);
      const res = await (await httpRequest(app)).post('/api/workflows/requests')
        .auth(t, { type: 'bearer' }).send({ definitionCode, payload: {} });
      expectHttpStatus(res, 400);
      const error = res.body as { message: string };
      expect(error.message).toContain('dedicated domain API');
    },
  );

  it('delegation reroutes new steps to the delegate, recording delegated_from (WF-01)', async () => {
    const mt = await token(`s13-manager-${stamp}@hrms.test`);
    // Wide window (yesterday..tomorrow) so the assertion is robust across the
    // UTC/IST date boundary — the engine judges the window in IST (tz3 fix).
    const dayMs = 86_400_000;
    const yesterday = new Date(Date.now() - dayMs).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + dayMs).toISOString().slice(0, 10);
    const setDelegation = await (await httpRequest(app))
      .put('/api/workflows/delegations')
      .set('Authorization', `Bearer ${mt}`)
      .send({ toUserId: delegateUser, fromDate: yesterday, toDate: tomorrow });
    expectHttpStatus(setDelegation, 200);

    const requestId = await createRequest(db, {
      definitionCode: 'leave',
      subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser,
      payload: { from: '2026-08-10', to: '2026-08-10', type: 'SL' },
    });
    createdRequests.push(requestId);

    const step = await db
      .selectFrom('wf.request_steps')
      .selectAll()
      .where('request_id', '=', requestId)
      .executeTakeFirstOrThrow();
    expect(step.approver_user_id).toBe(delegateUser);
    expect(step.delegated_from).toBe(managerUser);

    await db.deleteFrom('wf.delegations').where('from_user_id', '=', managerUser).execute();
  });

  it('holds an all-vacant chain for HR instead of approving it (WF-01 sponsor decision 16 Oct)', async () => {
    await db.insertInto('wf.event_subscriptions').values({ event_code: 'workflow.routing_held',
      recipient_kind: 'user', recipient_ref: String(hrUser) }).execute();
    // The manager employee has NO reporting manager → leave for the MANAGER
    // has a vacant step 1 → hold for routing repair, without domain effects.
    const requestId = await createRequest(db, {
      definitionCode: genericDefinitionCode,
      subjectEmployeeId: managerEmpId,
      requestedByUserId: managerUser,
      payload: { from: '2026-08-12', to: '2026-08-12', type: 'CL' },
    });
    createdRequests.push(requestId);

    const req = await db.selectFrom('wf.requests').select('status').where('id', '=', requestId).executeTakeFirstOrThrow();
    expect(req.status).toBe('pending');
    expect(await db.selectFrom('wf.request_steps').select('id').where('request_id', '=', requestId)
      .where('action', 'is', null).execute()).toHaveLength(0);
    const alerts = await db.selectFrom('wf.notifications').select('id').where('recipient_user_id', '=', hrUser)
      .where('template_code', '=', 'workflow_routing_held').execute();
    expect(alerts.length).toBeGreaterThan(0);

    const audit = await db
      .selectFrom('core.audit_log')
      .select('new_value')
      .where('entity', '=', 'wf.requests')
      .where('entity_id', '=', requestId)
      .execute();
    expect(audit.some((a) => a.new_value?.includes('vacant'))).toBe(true);
  });

  it.each(['creation', 'resubmission'] as const)('holds %s when its configured manager account is inactive', async mode => {
    let requestId = 0;
    if (mode === 'resubmission') {
      requestId = await createRequest(db, { definitionCode: genericDefinitionCode, subjectEmployeeId: workerEmpId,
        requestedByUserId: workerUser, payload: { reason: 'Before send back' } });
      createdRequests.push(requestId);
      await act(db, { requestId, actorUserId: managerUser, action: 'send_back', comment: 'Please correct the request' });
    }
    await db.updateTable('core.users').set({ is_active: false }).where('id', '=', managerUser).execute();
    try {
      if (mode === 'creation') {
        requestId = await createRequest(db, { definitionCode: genericDefinitionCode, subjectEmployeeId: workerEmpId,
          requestedByUserId: workerUser, payload: { reason: 'Inactive approver' } });
        createdRequests.push(requestId);
      } else await resubmit(db, { requestId, requesterUserId: workerUser, payload: { reason: 'Corrected request' } });
      const held = await db.selectFrom('wf.requests').select(['status', 'decided_at']).where('id', '=', requestId).executeTakeFirstOrThrow();
      expect(held).toEqual({ status: 'pending', decided_at: null });
      const steps = await db.selectFrom('wf.request_steps').select('action').where('request_id', '=', requestId).execute();
      expect(steps.some(step => step.action === null || step.action === 'approved')).toBe(false);
    } finally { await db.updateTable('core.users').set({ is_active: true }).where('id', '=', managerUser).execute(); }
  });

  it('SLA breach behaviors: OT lapses hard; Restricted Holiday auto-approves; leave escalates (WF-03)', async () => {
    // Overtime → lapse.
    const otId = await createRequest(db, {
      definitionCode: 'overtime',
      subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser,
      payload: { date: '2026-08-01', minutes: 90 },
    });
    createdRequests.push(otId);

    // Restricted holiday → auto-approve.
    const rhId = await createRequest(db, {
      definitionCode: 'restricted_holiday',
      subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser,
      payload: { date: '2026-08-15' },
    });
    createdRequests.push(rhId);

    // Force both overdue, then sweep.
    await db
      .updateTable('wf.request_steps')
      .set({ sla_due_at: new Date(Date.now() - 3600_000) })
      .where('request_id', 'in', [otId, rhId])
      .where('action', 'is', null)
      .execute();
    const handled = await runEscalations(db);
    expect(handled).toBeGreaterThanOrEqual(2);

    const ot = await db.selectFrom('wf.requests').select('status').where('id', '=', otId).executeTakeFirstOrThrow();
    expect(ot.status).toBe('lapsed'); // ATT-08: miss 48h → OT lapses, no exceptions

    const rh = await db.selectFrom('wf.requests').select('status').where('id', '=', rhId).executeTakeFirstOrThrow();
    expect(rh.status).toBe('approved'); // RH: silence = consent at cutoff

    // An unresolved escalation must never turn silence into approval.
    const lvId = await createRequest(db, {
      definitionCode: 'leave',
      subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser,
      payload: { from: '2026-08-20', to: '2026-08-21', type: 'CL' },
    });
    createdRequests.push(lvId);
    await db
      .updateTable('wf.request_steps')
      .set({ sla_due_at: new Date(Date.now() - 3600_000) })
      .where('request_id', '=', lvId)
      .where('action', 'is', null)
      .execute();
    await runEscalations(db);
    const lvSteps = await db.selectFrom('wf.request_steps').selectAll().where('request_id', '=', lvId).execute();
    expect(lvSteps.some((s) => s.action === 'escalated')).toBe(true);
    const leave = await db.selectFrom('wf.requests').select('status').where('id', '=', lvId).executeTakeFirstOrThrow();
    expect(leave.status).toBe('pending');
    expect(lvSteps.some(step => step.action === null && step.approver_user_id === managerUser)).toBe(true);
  });

  it('the chain catalog is runtime-editable data: editing a definition changes routing immediately', async () => {
    await giveRole(hrUser, 'super_admin'); // needs admin.settings
    const st = await token(`s13-hr-${stamp}@hrms.test`);

    const edit = await (await httpRequest(app))
      .put(`/api/workflows/definitions/${editableDefinitionCode}`)
      .set('Authorization', `Bearer ${st}`)
      .send({
        code: editableDefinitionCode,
        name: 'On Duty',
        steps: [{ step: 1, approver: `user:${hrUser}`, slaHours: 24, onBreach: 'escalate' }],
      });
    expectHttpStatus(edit, 200);

    const odId = await createRequest(db, {
      definitionCode: editableDefinitionCode,
      subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser,
      payload: { date: '2026-08-22', site: 'DIP-6' },
    });
    createdRequests.push(odId);
    const step = await db.selectFrom('wf.request_steps').selectAll().where('request_id', '=', odId).executeTakeFirstOrThrow();
    expect(step.approver_user_id).toBe(hrUser); // the edited chain took effect at once

    // The edited definition is fixture-owned and removed by afterAll.
  });

  it.each([
    { label: 'duplicate step numbers', steps: [{ step: 1, approver: 'reporting_manager' }, { step: 1, approver: 'functional_manager' }] },
    { label: 'an unknown approver', steps: [{ step: 1, approver: 'reporting_manger' }] },
    { label: 'an invalid escalation target', steps: [{ step: 1, approver: 'reporting_manager', escalateTo: 'user:0' }] },
  ])('refuses $label instead of silently skipping required authority', async ({ steps }) => {
    const t = await token(`s13-hr-${stamp}@hrms.test`);
    const previous = await db.selectFrom('wf.definitions').select('steps').where('code', '=', editableDefinitionCode).executeTakeFirstOrThrow();
    const response = await (await httpRequest(app)).put(`/api/workflows/definitions/${editableDefinitionCode}`)
      .auth(t, { type: 'bearer' }).send({ name: 'Invalid chain regression', steps });
    expectHttpStatus(response, 400);
    expect((await db.selectFrom('wf.definitions').select('steps').where('code', '=', editableDefinitionCode).executeTakeFirstOrThrow()).steps)
      .toEqual(previous.steps);
  });

  it('still skips one vacant step when a later configured approver is available', async () => {
    await db.updateTable('wf.definitions').set({ steps: JSON.stringify([
      { step: 1, approver: 'functional_manager', slaHours: 48, onBreach: 'escalate' },
      { step: 2, approver: 'reporting_manager', slaHours: 48, onBreach: 'escalate' },
    ]) }).where('code', '=', editableDefinitionCode).execute();
    const requestId = await createRequest(db, { definitionCode: editableDefinitionCode, subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser, payload: { reason: 'Partially vacant chain' } });
    createdRequests.push(requestId);
    const step = await db.selectFrom('wf.request_steps').select(['step_no', 'approver_user_id'])
      .where('request_id', '=', requestId).where('action', 'is', null).executeTakeFirstOrThrow();
    expect(step).toEqual({ step_no: 2, approver_user_id: managerUser });
    expect(await act(db, { requestId, actorUserId: managerUser, action: 'approve' })).toBe('approved');
  });

  it('isolates an invalid legacy chain so valid overdue OT still lapses', async () => {
    const invalidId = await createRequest(db, { definitionCode: editableDefinitionCode, subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser, payload: { reason: 'Legacy configuration isolation' } });
    const validId = await createRequest(db, { definitionCode: 'overtime', subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser, payload: { workDate: '2026-08-01', detectedMinutes: 90 } });
    createdRequests.push(invalidId, validId);
    // Simulate malformed pre-existing data, not an edit accepted by the validated API.
    await db.updateTable('wf.definitions').set({ steps: JSON.stringify([
      { step: 2, approver: 'reporting_manger', slaHours: 48, onBreach: 'escalate' },
    ]) }).where('code', '=', editableDefinitionCode).execute();
    await db.updateTable('wf.request_steps').set({ sla_due_at: new Date(Date.now() - 3600_000) })
      .where('request_id', 'in', [invalidId, validId]).where('action', 'is', null).execute();
    await expect(runEscalations(db)).resolves.toBeGreaterThanOrEqual(1);
    expect((await db.selectFrom('wf.requests').select('status').where('id', '=', invalidId).executeTakeFirstOrThrow()).status).toBe('pending');
    expect((await db.selectFrom('wf.requests').select('status').where('id', '=', validId).executeTakeFirstOrThrow()).status).toBe('lapsed');
  });

  it('enforces act and resubmit domain guards and validation errors', async () => {
    const testReqId = await createRequest(db, {
      definitionCode: genericDefinitionCode,
      subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser,
      payload: { reason: 'Workflow domain guards test' },
    });
    createdRequests.push(testReqId);

    // 1. act without comment on reject or send_back throws
    await expect(
      act(db, {
        requestId: testReqId,
        actorUserId: managerUser,
        action: 'reject',
        comment: '',
      })
    ).rejects.toThrow(/decision reason is required/);

    await expect(
      act(db, {
        requestId: testReqId,
        actorUserId: managerUser,
        action: 'send_back',
        comment: '   ',
      })
    ).rejects.toThrow(/decision reason is required/);

    // 2. act by unauthorized user throws Not the current approver
    await expect(
      act(db, {
        requestId: testReqId,
        actorUserId: workerUser,
        action: 'approve',
      })
    ).rejects.toThrow(/Not the current approver/);

    // 3. resubmit when status is pending (not sent_back) throws
    await expect(
      resubmit(db, {
        requestId: testReqId,
        requesterUserId: workerUser,
        payload: { workDate: '2026-08-05', detectedMinutes: 120 },
      })
    ).rejects.toThrow(/Only sent-back requests can be resubmitted/);

    // 4. Send back request properly
    const sentBack = await act(db, {
      requestId: testReqId,
      actorUserId: managerUser,
      action: 'send_back',
      comment: 'Please correct OT hours detected',
    });
    expect(sentBack).toBe('sent_back');

    // 5. resubmit by non-requester throws
    await expect(
      resubmit(db, {
        requestId: testReqId,
        requesterUserId: managerUser,
        payload: { workDate: '2026-08-05', detectedMinutes: 120 },
      })
    ).rejects.toThrow(/Only the requester can resubmit/);

    // Domain facts cannot be rewritten through generic resubmission when domain-reserved.
    await db.updateTable('wf.requests').set({ definition_code: 'overtime' }).where('id', '=', testReqId).execute();
    await expect(resubmit(db, {
      requestId: testReqId,
      requesterUserId: workerUser,
      payload: { workDate: '2026-08-06', detectedMinutes: 999 },
    })).rejects.toThrow(/validated domain correction/);
    await db.updateTable('wf.requests').set({ definition_code: `s13_chain_${stamp}` }).where('id', '=', testReqId).execute();
    expect((await db.selectFrom('wf.requests').select('status').where('id', '=', testReqId).executeTakeFirstOrThrow()).status).toBe('sent_back');

    // Unchanged domain facts may restart the approval chain.
    await resubmit(db, {
      requestId: testReqId,
      requesterUserId: workerUser,
      payload: { reason: 'Workflow domain guards test' },
    });
    const restarted = await db.selectFrom('wf.requests').select('status').where('id', '=', testReqId).executeTakeFirstOrThrow();
    expect(restarted.status).toBe('pending');

    // 7. Reject request properly
    const rejected = await act(db, {
      requestId: testReqId,
      actorUserId: managerUser,
      action: 'reject',
      comment: 'Rejected permanently',
    });
    expect(rejected).toBe('rejected');

    // 8. act on already rejected request throws
    await expect(
      act(db, {
        requestId: testReqId,
        actorUserId: managerUser,
        action: 'approve',
      })
    ).rejects.toThrow(/not actionable/);
  });
});
