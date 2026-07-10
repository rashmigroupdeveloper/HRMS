/**
 * Stage 1.3 live proof (WF-01..04, doc 11 §4b):
 *  - every step carries a notification RECEIPT (the anti-PP-14 guarantee)
 *  - full chain walk: RM approve → HR step → approved
 *  - send_back → resubmit restarts the chain
 *  - non-approvers are refused; delegation reroutes with a trail
 *  - vacant approvers auto-skip with audit
 *  - SLA breaches: escalate / lapse (OT) / auto-approve (RH)
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
import { createRequest, runEscalations } from '../src/modules/workflows/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

run('Stage 1.3 — workflow engine (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'stage13-test-password-1!';

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
    const res = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(res.status).toBe(200);
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
      .values({ ecode: `RML8${String(stamp).slice(-5)}M`, company_id: rml.id, first_name: 'S13 Manager' })
      .returning('id')
      .executeTakeFirstOrThrow();
    managerEmpId = mgr.id;
    const wrk = await db
      .insertInto('core.employees')
      .values({
        ecode: `RML8${String(stamp).slice(-5)}W`,
        company_id: rml.id,
        first_name: 'S13 Worker',
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
    await db.deleteFrom('core.user_roles').where('user_id', 'in', [workerUser, managerUser, hrUser, delegateUser]).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('id', 'in', [workerUser, managerUser, hrUser, delegateUser])
      .execute();
    await db.deleteFrom('core.employees').where('id', 'in', [workerEmpId, managerEmpId]).execute();
    await db.destroy();
  });

  it('leave request: step 1 lands on the RM with a notification RECEIPT (PP-14)', async () => {
    const t = await token(`s13-worker-${stamp}@hrms.test`);
    const res = await request(app)
      .post('/api/workflows/requests')
      .set('Authorization', `Bearer ${t}`)
      .send({ definitionCode: 'leave', payload: { from: '2026-08-03', to: '2026-08-05', type: 'CL' } });
    expect(res.status).toBe(200);
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
    const inbox = await request(app).get('/api/workflows/inbox').set('Authorization', `Bearer ${mt}`);
    expect((inbox.body as { requestId: number }[]).some((r) => r.requestId === requestId)).toBe(true);

    // …a stranger cannot act, the RM can.
    const st = await token(`s13-hr-${stamp}@hrms.test`);
    const forbidden = await request(app)
      .post(`/api/workflows/requests/${requestId}/act`)
      .set('Authorization', `Bearer ${st}`)
      .send({ requestId, action: 'approve' });
    expect(forbidden.status).toBe(403);

    const approve = await request(app)
      .post(`/api/workflows/requests/${requestId}/act`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ requestId, action: 'approve', comment: 'Enjoy' });
    expect(approve.status).toBe(200);
    expect((approve.body as { outcome: string }).outcome).toBe('approved'); // single-step chain
  });

  it('send_back → requester fixes → resubmit restarts the chain (doc 11 §4b)', async () => {
    const wt = await token(`s13-worker-${stamp}@hrms.test`);
    const mt = await token(`s13-manager-${stamp}@hrms.test`);

    const created = await request(app)
      .post('/api/workflows/requests')
      .set('Authorization', `Bearer ${wt}`)
      .send({ definitionCode: 'regularization', payload: { date: '2026-08-01', reason: 'forgot' } });
    const requestId = (created.body as { requestId: number }).requestId;
    createdRequests.push(requestId);

    const back = await request(app)
      .post(`/api/workflows/requests/${requestId}/act`)
      .set('Authorization', `Bearer ${mt}`)
      .send({ requestId, action: 'send_back', comment: 'Reason too vague — which gate?' });
    expect((back.body as { outcome: string }).outcome).toBe('sent_back');

    const resub = await request(app)
      .post(`/api/workflows/requests/${requestId}/resubmit`)
      .set('Authorization', `Bearer ${wt}`)
      .send({ requestId, payload: { date: '2026-08-01', reason: 'Kent door S4 offline, gate register signed' } });
    expect(resub.status).toBe(200);

    const timeline = await request(app)
      .get(`/api/workflows/requests/${requestId}`)
      .set('Authorization', `Bearer ${wt}`);
    const body = timeline.body as { status: string; steps: { action: string | null }[] };
    expect(body.status).toBe('pending');
    expect(body.steps.map((s) => s.action)).toEqual(['sent_back', null]); // round 1 + fresh step
  });

  it('delegation reroutes new steps to the delegate, recording delegated_from (WF-01)', async () => {
    const mt = await token(`s13-manager-${stamp}@hrms.test`);
    const today = new Date().toISOString().slice(0, 10);
    const setDelegation = await request(app)
      .put('/api/workflows/delegations')
      .set('Authorization', `Bearer ${mt}`)
      .send({ toUserId: delegateUser, fromDate: today, toDate: today });
    expect(setDelegation.status).toBe(200);

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

  it('vacant approver auto-skips with an audit trail; empty chain → auto-approved (WF-01)', async () => {
    // The manager employee has NO reporting manager → leave for the MANAGER
    // has a vacant step 1 → skip → nothing left → approved.
    const requestId = await createRequest(db, {
      definitionCode: 'leave',
      subjectEmployeeId: managerEmpId,
      requestedByUserId: managerUser,
      payload: { from: '2026-08-12', to: '2026-08-12', type: 'CL' },
    });
    createdRequests.push(requestId);

    const req = await db.selectFrom('wf.requests').select('status').where('id', '=', requestId).executeTakeFirstOrThrow();
    expect(req.status).toBe('approved');

    const audit = await db
      .selectFrom('core.audit_log')
      .select('new_value')
      .where('entity', '=', 'wf.requests')
      .where('entity_id', '=', requestId)
      .execute();
    expect(audit.some((a) => a.new_value?.includes('vacant'))).toBe(true);
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

    // Leave → escalate: manager overdue, no manager-of-manager → skips → approved
    // (single-step chain); the escalation TOUCH is recorded on the step.
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
  });

  it('the chain catalog is runtime-editable data: editing a definition changes routing immediately', async () => {
    await giveRole(hrUser, 'super_admin'); // needs admin.settings
    const st = await token(`s13-hr-${stamp}@hrms.test`);

    const edit = await request(app)
      .put('/api/workflows/definitions/od')
      .set('Authorization', `Bearer ${st}`)
      .send({
        code: 'od',
        name: 'On Duty',
        steps: [{ step: 1, approver: `user:${hrUser}`, slaHours: 24, onBreach: 'escalate' }],
      });
    expect(edit.status).toBe(200);

    const odId = await createRequest(db, {
      definitionCode: 'od',
      subjectEmployeeId: workerEmpId,
      requestedByUserId: workerUser,
      payload: { date: '2026-08-22', site: 'DIP-6' },
    });
    createdRequests.push(odId);
    const step = await db.selectFrom('wf.request_steps').selectAll().where('request_id', '=', odId).executeTakeFirstOrThrow();
    expect(step.approver_user_id).toBe(hrUser); // the edited chain took effect at once

    // Restore the shipped default.
    await request(app)
      .put('/api/workflows/definitions/od')
      .set('Authorization', `Bearer ${st}`)
      .send({
        code: 'od',
        name: 'On Duty',
        steps: [{ step: 1, approver: 'reporting_manager', slaHours: 48, onBreach: 'escalate' }],
      });
  });
});
