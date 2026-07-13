/**
 * Stage 1.6 — absenteeism · boarding/exit email · letters · policies (live Postgres):
 *  B1 boarding/exit email: joins + exits in the payload, and an EMPTY day still sends
 *  B2 absence engine on a test clock: watch(4d) → show_cause(7d) → HR letter through
 *     the signature chain (linked on the case) → return closes as 'returned'
 *  B3 merge-field validation: missing and undeclared fields are hard errors;
 *     the rendered document carries the substituted values
 *  B4 policies: audience-scoped publish → ack → live HR tile 1/2 (50%) → weekly
 *     nag hits ONLY the non-acknowledger; re-ack is idempotent
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database, DayStatus } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { readDocument } from '../src/core/storage/index.js';
import {
  issueAbsenceCaseLetter,
  registerAttendanceWorkflowHooks,
  runAbsenceScan,
} from '../src/modules/attendance/index.js';
import { issueLetter, registerLettersWorkflowHooks, renderTemplate } from '../src/modules/letters/index.js';
import { acknowledgePolicy, listPoliciesFor, policyAckStatus, publishPolicy, runPolicyAckNag } from '../src/modules/policies/index.js';
import { sendBoardingExitEmail } from '../src/modules/lifecycle/index.js';
import { act, WORKFLOW_DEFINITIONS } from '../src/modules/workflows/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 1.6 — absence, letters, policies (live Postgres)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const password = 's16-test-pw-1!';

  let mgrId: number;
  let mgrUserId: number;
  let hrOpsUserId: number;
  let hrHeadUserId: number;
  let joinerId: number; // doj on the report day
  let leaverId: number; // dol on the report day
  let absenteeId: number; // the 7-day absence case
  let deptId: number; // audience scope for the policy test
  let ackEmpId: number; // acknowledges the policy
  let nagEmpId: number; // does not — must be nagged
  let nagUserId: number;

  const policyIds: number[] = [];

  async function mkEmployee(suffix: string, opts: { managerId?: number | null; doj?: string; dol?: string; departmentId?: number | null; exited?: boolean }): Promise<number> {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const r = await db
      .insertInto('core.employees')
      .values({
        ecode: `RMLX${String(stamp).slice(-5)}${suffix}`,
        company_id: rml.id,
        first_name: `S16 ${suffix}`,
        reporting_manager_id: opts.managerId ?? null,
        department_id: opts.departmentId ?? null,
        status: opts.exited ? 'exited' : 'active',
        doj: sql<Date>`${opts.doj ?? '2020-01-01'}::date` as unknown as Date,
        ...(opts.dol ? { dol: sql<Date>`${opts.dol}::date` as unknown as Date, exit_reason: 'resignation' } : {}),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return r.id;
  }

  async function mkUser(employeeId: number | null, tag: string, roleCode?: string): Promise<number> {
    const u = await db
      .insertInto('core.users')
      .values({ email: `s16-${tag}-${stamp}@hrms.test`, password_hash: await hashPassword(password), employee_id: employeeId })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (roleCode) {
      const role = await db.selectFrom('core.roles').select('id').where('code', '=', roleCode).executeTakeFirstOrThrow();
      await db.insertInto('core.user_roles').values({ user_id: u.id, role_id: role.id, scope_org_unit_id: null }).execute();
    }
    return u.id;
  }

  async function setDay(employeeId: number, isoDate: string, status: DayStatus): Promise<void> {
    await db
      .insertInto('att.day_records')
      .values({ employee_id: employeeId, work_date: sql<Date>`${isoDate}::date` as unknown as Date, status, source: 'auto', computed_at: new Date() })
      .onConflict((oc) => oc.columns(['employee_id', 'work_date']).doUpdateSet({ status }))
      .execute();
  }

  async function absenceCase(employeeId: number) {
    return db.selectFrom('att.absence_cases').selectAll().where('employee_id', '=', employeeId).orderBy('id', 'desc').executeTakeFirstOrThrow();
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    registerAttendanceWorkflowHooks();
    registerLettersWorkflowHooks();

    for (const def of WORKFLOW_DEFINITIONS.filter((d) => d.code === 'letter_signature')) {
      await db
        .insertInto('wf.definitions')
        .values({ code: def.code, name: def.name, steps: JSON.stringify(def.steps) })
        .onConflict((oc) => oc.column('code').doNothing())
        .execute();
    }

    const dept = await db.insertInto('core.departments').values({ name: `S16 Dept ${stamp}` }).returning('id').executeTakeFirstOrThrow();
    deptId = dept.id;

    mgrId = await mkEmployee('M', {});
    mgrUserId = await mkUser(mgrId, 'mgr');
    hrOpsUserId = await mkUser(null, 'hrops', 'hr_ops');
    hrHeadUserId = await mkUser(null, 'hrhead', 'hr_head');
    joinerId = await mkEmployee('J', { managerId: mgrId, doj: '2032-06-01' });
    leaverId = await mkEmployee('L', { managerId: mgrId, doj: '2020-01-01', dol: '2032-06-01', exited: true });
    absenteeId = await mkEmployee('A', { managerId: mgrId });
    ackEmpId = await mkEmployee('P', { departmentId: deptId });
    nagEmpId = await mkEmployee('Q', { departmentId: deptId });
    nagUserId = await mkUser(nagEmpId, 'nag');

    // Boarding/exit audience is DATA — subscribe an email + the manager's user.
    await db
      .insertInto('wf.event_subscriptions')
      .values([
        { event_code: 'lifecycle.boarding_exit', recipient_kind: 'email', recipient_ref: `s16-${stamp}@rashmi.test` },
        { event_code: 'lifecycle.boarding_exit', recipient_kind: 'user', recipient_ref: String(mgrUserId) },
      ])
      .execute();
  });

  afterAll(async () => {
    const empIds = [mgrId, joinerId, leaverId, absenteeId, ackEmpId, nagEmpId];
    await db.deleteFrom('att.absence_cases').where('employee_id', 'in', empIds).execute();
    const letters = await db.selectFrom('core.letters').select(['id', 'document_id']).where('employee_id', 'in', empIds).execute();
    await db.deleteFrom('core.letters').where('employee_id', 'in', empIds).execute();
    if (policyIds.length > 0) {
      await db.deleteFrom('core.policy_acknowledgments').where('policy_id', 'in', policyIds).execute();
      const policyDocs = await db.selectFrom('core.policies').select('document_id').where('id', 'in', policyIds).execute();
      await db.deleteFrom('core.policies').where('id', 'in', policyIds).execute();
      for (const d of policyDocs) await db.deleteFrom('core.documents').where('id', '=', d.document_id).execute();
    }
    const reqs = await db.selectFrom('wf.requests').select('id').where('subject_employee_id', 'in', empIds).execute();
    if (reqs.length > 0) {
      const ids = reqs.map((r) => r.id);
      await db.deleteFrom('wf.request_steps').where('request_id', 'in', ids).execute();
      await db.deleteFrom('wf.requests').where('id', 'in', ids).execute();
    }
    for (const l of letters) await db.deleteFrom('core.documents').where('id', '=', l.document_id).execute();
    for (const id of empIds) {
      await sql`DELETE FROM att.day_records WHERE employee_id = ${id} AND is_locked = false`.execute(db);
    }
    await db.deleteFrom('wf.event_subscriptions').where('event_code', '=', 'lifecycle.boarding_exit').where('recipient_ref', 'like', `%${stamp}%`).execute();
    await db.deleteFrom('wf.event_subscriptions').where('recipient_ref', '=', String(mgrUserId)).execute();
    await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('email', 'like', `s16-%-${stamp}@hrms.test`).execute();
    await db.updateTable('core.employees').set({ department_id: null }).where('id', 'in', empIds).execute();
    await db.deleteFrom('core.departments').where('id', '=', deptId).execute();
    await db.destroy();
  });

  it('B1: the boarding/exit email carries joins + exits — and an EMPTY day still sends', async () => {
    const queued = await sendBoardingExitEmail(db, '2032-06-01');
    expect(queued).toBe(2); // both subscribers

    const joinerEcode = (await db.selectFrom('core.employees').select('ecode').where('id', '=', joinerId).executeTakeFirstOrThrow()).ecode;
    const leaverEcode = (await db.selectFrom('core.employees').select('ecode').where('id', '=', leaverId).executeTakeFirstOrThrow()).ecode;
    const note = await db
      .selectFrom('wf.notifications')
      .selectAll()
      .where('template_code', '=', 'boarding_exit_daily')
      .where(sql<boolean>`payload->>'date' = '2032-06-01'`)
      .where('recipient_email', '=', `s16-${stamp}@rashmi.test`)
      .executeTakeFirstOrThrow();
    const payload = note.payload as { joinCount: number; exitCount: number; joins: { ecode: string }[]; exits: { ecode: string; exitReason: string | null }[] };
    expect(payload.joins.some((j) => j.ecode === joinerEcode)).toBe(true);
    expect(payload.exits.some((x) => x.ecode === leaverEcode)).toBe(true);
    expect(payload.exits.find((x) => x.ecode === leaverEcode)?.exitReason).toBe('resignation');

    // PP-6's real fix: a day with NO movement still produces the email.
    const emptyQueued = await sendBoardingExitEmail(db, '2032-06-15');
    expect(emptyQueued).toBe(2);
    const empty = await db
      .selectFrom('wf.notifications')
      .selectAll()
      .where('template_code', '=', 'boarding_exit_daily')
      .where(sql<boolean>`payload->>'date' = '2032-06-15'`)
      .where('recipient_email', '=', `s16-${stamp}@rashmi.test`)
      .executeTakeFirstOrThrow();
    expect((empty.payload as { joinCount: number; exitCount: number }).joinCount).toBe(0);
    expect((empty.payload as { joinCount: number; exitCount: number }).exitCount).toBe(0);
  });

  it('B2: 4 days → watch · 7 days → show_cause · letter through the chain · return closes the case', async () => {
    // Jul 2032: 01 Thu … 04 Sunday (WO, neutral — 7 ABSENT days need 08 Thu).
    const absentDays = ['2032-07-01', '2032-07-02', '2032-07-03', '2032-07-05', '2032-07-06', '2032-07-07', '2032-07-08'];
    await setDay(absenteeId, '2032-07-04', 'WO');
    for (const d of absentDays.slice(0, 3)) await setDay(absenteeId, d, 'A');

    // Day 3 of absence: below the watch threshold — no case.
    let result = await runAbsenceScan(db, '2032-07-03');
    expect(result.absentees).toBeGreaterThanOrEqual(1);
    expect(await db.selectFrom('att.absence_cases').select('id').where('employee_id', '=', absenteeId).executeTakeFirst()).toBeUndefined();

    // Day 4 (Sunday was neutral): case opens at 'watch'.
    await setDay(absenteeId, '2032-07-05', 'A');
    result = await runAbsenceScan(db, '2032-07-05');
    expect(result.casesOpened).toBeGreaterThanOrEqual(1);
    let c = await absenceCase(absenteeId);
    expect(c.stage).toBe('watch');
    expect(c.days_absent).toBe(4);

    // 7th ABSENT day: escalates to 'show_cause'; the RM was alerted along the way.
    for (const d of absentDays.slice(4)) await setDay(absenteeId, d, 'A');
    result = await runAbsenceScan(db, '2032-07-08');
    expect(result.casesEscalated).toBeGreaterThanOrEqual(1);
    c = await absenceCase(absenteeId);
    expect(c.stage).toBe('show_cause');
    expect(c.days_absent).toBe(7); // 7 absent days, the Sunday is neutral
    const rmAlerts = await db
      .selectFrom('wf.notifications')
      .select('id')
      .where('recipient_user_id', '=', mgrUserId)
      .where('template_code', '=', 'uab_alert')
      .execute();
    expect(rmAlerts.length).toBeGreaterThanOrEqual(3);

    // HR issues the show-cause letter FROM the case; it walks hr_ops → hr_head.
    const issued = await issueAbsenceCaseLetter(db, { caseId: c.id, templateCode: 'show_cause', actorUserId: hrOpsUserId });
    expect((await absenceCase(absenteeId)).letter_id).toBe(issued.letterId);
    expect(issued.workflowRequestId).not.toBeNull();
    let letter = await db.selectFrom('core.letters').selectAll().where('id', '=', issued.letterId).executeTakeFirstOrThrow();
    expect(letter.issued_at).toBeNull(); // draft until the chain signs (PP-14)

    expect(await act(db, { requestId: issued.workflowRequestId ?? -1, actorUserId: hrOpsUserId, action: 'approve' })).toBe('advanced');
    expect(await act(db, { requestId: issued.workflowRequestId ?? -1, actorUserId: hrHeadUserId, action: 'approve' })).toBe('approved');
    letter = await db.selectFrom('core.letters').selectAll().where('id', '=', issued.letterId).executeTakeFirstOrThrow();
    expect(letter.issued_at).not.toBeNull();

    // The archived document carries the SUBSTITUTED values.
    const doc = await readDocument(db, letter.document_id);
    const body = doc.content.toString('utf8');
    expect(body).toContain('2032-07-01'); // absence_start_date rendered
    expect(body).toContain('(7 days)');
    expect(body).not.toContain('{{');

    // The employee returns → the case closes as 'returned'.
    await setDay(absenteeId, '2032-07-09', 'P');
    result = await runAbsenceScan(db, '2032-07-09');
    expect(result.casesClosed).toBeGreaterThanOrEqual(1);
    c = await absenceCase(absenteeId);
    expect(c.resolution).toBe('returned');
    expect(c.closed_at).not.toBeNull();
  });

  it('B3: merge-field validation is a hard gate, both directions', async () => {
    await expect(
      issueLetter(db, { employeeId: absenteeId, templateCode: 'warning', requestedByUserId: hrOpsUserId }),
    ).rejects.toThrow(/Missing merge fields: warning_reason/);

    expect(() => renderTemplate('Hello {{name}}, ref {{undeclared_field}}', ['name'], { name: 'A' })).toThrow(/undeclared merge field/);
  });

  it('B4: audience-scoped policy → ack → live 50% tile → nag hits only the non-acknowledger', async () => {
    const policyId = await publishPolicy(db, {
      title: `S16 Policy ${stamp}`,
      effectiveDate: '2032-01-01',
      requiresAcknowledgment: true,
      audience: { departmentIds: [deptId] },
      fileName: 'policy.html',
      mime: 'text/html',
      content: '<p>Test policy body</p>',
      actorUserId: hrOpsUserId,
    });
    policyIds.push(policyId);

    // Both department members see it; nobody outside the audience does.
    expect((await listPoliciesFor(db, ackEmpId)).some((p) => p.id === policyId)).toBe(true);
    expect((await listPoliciesFor(db, mgrId)).some((p) => p.id === policyId)).toBe(false);

    await acknowledgePolicy(db, policyId, ackEmpId);
    await acknowledgePolicy(db, policyId, ackEmpId); // idempotent
    const acks = await db.selectFrom('core.policy_acknowledgments').select('id').where('policy_id', '=', policyId).execute();
    expect(acks).toHaveLength(1);

    const tile = await policyAckStatus(db);
    const mine = tile.find((t) => t.id === policyId);
    expect(mine?.targeted).toBe(2);
    expect(mine?.acknowledged).toBe(1);
    expect(mine?.pct).toBe(50);

    // The weekly nag reaches ONLY the non-acknowledger's account.
    await runPolicyAckNag(db);
    const nags = await db
      .selectFrom('wf.notifications')
      .select(['recipient_user_id'])
      .where('template_code', '=', 'policy_ack_reminder')
      .where(sql<boolean>`(payload->>'policyId')::bigint = ${policyId}`)
      .execute();
    expect(nags).toHaveLength(1);
    expect(nags[0]?.recipient_user_id).toBe(nagUserId);
  });
});
