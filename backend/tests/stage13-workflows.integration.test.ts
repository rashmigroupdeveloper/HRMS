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
    // Workflow participation is a permission now (audit W0-T19), so that
    // revoking it — suspension, exit-day cut — actually stops someone
    // approving. Every real employee holds `employee`; these fixtures did not,
    // which is why they were reaching the engine with no role at all.
    await giveRole(workerUser, 'employee');
    await giveRole(managerUser, 'employee');
    await giveRole(delegateUser, 'employee');
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
    // Wide window (yesterday..tomorrow) so the assertion is robust across the
    // UTC/IST date boundary — the engine judges the window in IST (tz3 fix).
    const dayMs = 86_400_000;
    const yesterday = new Date(Date.now() - dayMs).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + dayMs).toISOString().slice(0, 10);
    const setDelegation = await request(app)
      .put('/api/workflows/delegations')
      .set('Authorization', `Bearer ${mt}`)
      .send({ toUserId: delegateUser, fromDate: yesterday, toDate: tomorrow });
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

  it('vacant approver auto-skips with an audit trail; an UNDECIDED chain never approves (WF-01)', async () => {
    /**
     * CHANGED 5 Sep 2026, audit W0-T17 / finding [E1].
     *
     * This case previously asserted `status === 'approved'` — it encoded the
     * defect as intended behaviour, and the plan record for Stage 1.3 repeated
     * it ("chain exhausted → auto-approved ✓"). The audit used exactly this
     * path to raise a resignation against another employee and have it approve
     * itself with zero step rows and nobody notified.
     *
     * docs/04 §5 authorises "auto-skip-to-next ... never a dead end". It does
     * NOT authorise approving when nobody was ever asked. Skipping is still
     * asserted below; the ending is not.
     *
     * The specific fallback approver is `core.settings`
     * (`wf.vacant_chain_fallback_approver`), not a value invented here.
     * Sponsor decision D21 confirms the policy.
     */
    const requestId = await createRequest(db, {
      definitionCode: 'leave',
      subjectEmployeeId: managerEmpId,
      requestedByUserId: managerUser,
      payload: { from: '2026-08-12', to: '2026-08-12', type: 'CL' },
    });
    createdRequests.push(requestId);

    const req = await db.selectFrom('wf.requests').select('status').where('id', '=', requestId).executeTakeFirstOrThrow();
    expect(req.status).not.toBe('approved');
    expect(req.status).toBe('pending');

    // The skip itself is still audited — that part was always right.
    const audit = await db
      .selectFrom('core.audit_log')
      .select('new_value')
      .where('entity', '=', 'wf.requests')
      .where('entity_id', '=', requestId)
      .execute();
    expect(audit.some((a) => a.new_value?.includes('vacant'))).toBe(true);

    // This fixture has no hr_head either, so the fallback is vacant too and the
    // request parks as pending-and-loud. Stuck-and-visible beats silently
    // approved. (The fallback-resolves path is covered by the dedicated
    // 'vacant-chain floor' suite below, which seeds an hr_head.)
    expect(
      audit.some((a) => (a.new_value ?? '').includes('fallback') || (a.new_value ?? '').includes('vacant')),
    ).toBe(true);
    // No orphan approval: the request did not reach a terminal state without a
    // step. (`notified_at` is NOT NULL, so a step row cannot exist without its
    // receipt — that half was always structural; what was missing is that a
    // step row now has to exist at all before anything can approve.)
    const steps = await db
      .selectFrom('wf.request_steps')
      .select('id')
      .where('request_id', '=', requestId)
      .execute();
    expect(steps.length === 0 && req.status !== 'pending').toBe(false);
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

/**
 * THE VACANT-CHAIN FLOOR — regression net for docs/audit/01-FINDINGS.md [E1].
 *
 * The audit raised a resignation against another employee and watched it reach
 * `approved` with ZERO `wf.request_steps` rows: every spec in the chain —
 * reporting_manager, role:hr_head, role:hr_ops — resolved to nobody, so the
 * chain "completed". CLAUDE.md rule 8 ("every workflow step records notified_at;
 * the approver-never-notified bug must be impossible") was satisfied only
 * vacuously, because there were no steps to carry a receipt.
 *
 * A chain that nobody decided must never end in `approved`.
 */
import { sql as vacantSql } from 'kysely';

describe.skipIf(!process.env['DATABASE_URL'])('vacant-chain floor (WF-01, finding E1)', () => {
  const db = createDatabase(process.env['DATABASE_URL'] ?? '');
  const stamp = Date.now();
  const P = `VC${stamp.toString(36).toUpperCase().slice(0, 6)}`;
  const defCode = `${P}_orphan`;
  let subjectId = 0;
  let requesterUserId = 0;
  let hrHeadUserId = 0;

  beforeAll(async () => {
    const company = await db
      .insertInto('core.companies')
      .values({ code: P, name: `Vacant chain ${stamp}`, ecode_prefix: P })
      .returning('id')
      .executeTakeFirstOrThrow();

    // A subject with NO reporting manager — the real-world trigger. After the
    // 1,066-employee import, anyone whose RM did not resolve looks like this.
    subjectId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: `${P}SUB`, company_id: company.id, first_name: 'Orphan', last_name: 'Subject',
          status: 'active', doj: '2024-01-01', category: 'white_collar',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    requesterUserId = (
      await db
        .insertInto('core.users')
        .values({ email: `${P}-req@hrms.test`.toLowerCase(), password_hash: 'x', employee_id: subjectId })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    // A chain whose every step is unresolvable: no RM, and two roles nobody holds.
    await db
      .insertInto('wf.definitions')
      .values({
        code: defCode,
        name: 'Orphan chain',
        steps: JSON.stringify([
          { step: 1, approver: 'reporting_manager', slaHours: 72, onBreach: 'escalate' },
          { step: 2, approver: `role:${P}_nobody`, slaHours: 72, onBreach: 'escalate' },
        ]),
      })
      .execute();
  }, 120_000);

  afterAll(async () => {
    await db.updateTable('core.users').set({ is_active: false, employee_id: null })
      .where('email', 'like', `${P}-%`).execute();
    await db.destroy();
  });

  it('does NOT auto-approve when every step is vacant — it routes to the fallback', async () => {
    // hr_head is the shipped fallback (core.settings wf.vacant_chain_fallback_approver).
    hrHeadUserId = (
      await db
        .insertInto('core.users')
        .values({ email: `${P}-head@hrms.test`.toLowerCase(), password_hash: 'x' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    const role = await db.selectFrom('core.roles').select('id')
      .where('code', '=', 'hr_head').executeTakeFirstOrThrow();
    await db.insertInto('core.user_roles')
      .values({ user_id: hrHeadUserId, role_id: role.id, scope_org_unit_id: null }).execute();

    const requestId = await createRequest(db, {
      definitionCode: defCode,
      subjectEmployeeId: subjectId,
      requestedByUserId: requesterUserId,
      payload: { probe: 'vacant-chain' },
    });

    const req = await db.selectFrom('wf.requests').select(['status'])
      .where('id', '=', requestId).executeTakeFirstOrThrow();
    expect(req.status).toBe('pending');

    // ...and the receipt invariant now MEANS something: a real step exists.
    const steps = await db.selectFrom('wf.request_steps')
      .select(['approver_user_id', 'approver_spec', 'notified_at'])
      .where('request_id', '=', requestId).execute();
    expect(steps).toHaveLength(1);
    expect(steps[0]?.approver_user_id).toBe(hrHeadUserId);
    expect(steps[0]?.approver_spec).toBe('role:hr_head');
    expect(steps[0]?.notified_at).toBeTruthy();
  });

  it('leaves the request PENDING and alerts when the fallback is vacant too', async () => {
    await db.updateTable('core.users').set({ is_active: false })
      .where('id', '=', hrHeadUserId).execute();

    const requestId = await createRequest(db, {
      definitionCode: defCode,
      subjectEmployeeId: subjectId,
      requestedByUserId: requesterUserId,
      payload: { probe: 'vacant-fallback' },
    });

    const req = await db.selectFrom('wf.requests').select(['status'])
      .where('id', '=', requestId).executeTakeFirstOrThrow();
    // The whole point: stuck-and-visible beats silently approved.
    expect(req.status).toBe('pending');
    expect(req.status).not.toBe('approved');

    const audit = await db.selectFrom('core.audit_log').select(['field', 'new_value'])
      .where('entity', '=', 'wf.requests').where('entity_id', '=', requestId).execute();
    expect(audit.some((a) => a.field === 'chain_stalled')).toBe(true);
  });

  it('no request raised through this chain reaches a terminal state with zero steps', async () => {
    /**
     * W0-T21 — the standing probe from docs/audit/03-DATA-ISSUES.md §5.3,
     * asserted as a test rather than left as a query somebody remembers to run.
     *
     * Scoped to THIS suite's definition on purpose: the shared integration
     * database still holds rows from before the fix (13 at the time of writing),
     * and in a real deployment those pre-fix requests need triage, not a red
     * test. The unscoped query stays in 03-DATA-ISSUES.md §5.3 as the
     * operational check to run against production before go-live.
     */
    const orphans = await vacantSql<{ id: number }>`
      SELECT r.id
        FROM wf.requests r
        LEFT JOIN wf.request_steps s ON s.request_id = r.id
       WHERE r.status IN ('approved', 'rejected')
         AND r.definition_code = ${defCode}
       GROUP BY r.id
      HAVING count(s.id) = 0`.execute(db);
    expect(orphans.rows).toEqual([]);
  });
});
