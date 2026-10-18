/**
 * Stage 1.4 — AR/OD/Permission + Overtime 48h rule (ATT-06/07/08), live Postgres:
 *  V  validators: AR future / too-old / PERMISSION multi-day / over-cap
 *  R1 AR e2e: submit (API) → manager approves → day P source='regularized',
 *     applied=true, and recomputeDay SKIPS the regularized row
 *  R2 OD e2e: FUTURE-dated OD (the KQ ask) approved → day OD
 *  O1 OT detect on a GEN day (beyond shift end) → entry + workflow intimation;
 *     partial approval writes approved_minutes < claimed
 *  O2 OT lapse: SLA breach → request lapsed → entry lapsed (the hard rule)
 *  O3 week-off work by a user-less employee → workflow-less entry; deadline
 *     sweep lapses it
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpRequest } from './http-client.js';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { writeAudit } from '../src/core/audit/audit.service.js';
import { hashPassword } from '../src/modules/auth/index.js';
import {
  createRegularization,
  decideOvertime,
  lapseExpiredOvertime,
  recomputeDay,
  registerAttendanceWorkflowHooks,
} from '../src/modules/attendance/index.js';
import { act, inbox, resubmit, runEscalations, WORKFLOW_DEFINITIONS } from '../src/modules/workflows/index.js';
import { addDaysIso, istDateString } from '../src/core/dates.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

const IST_OFFSET_MS = 5.5 * 3600_000;
function ist(isoDate: string, time: string): Date {
  return new Date(new Date(`${isoDate}T${time}:00Z`).getTime() - IST_OFFSET_MS);
}
function dow(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

run('Stage 1.4 — requests + overtime (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const today = istDateString();
  const password = 's14-test-pw-1!';

  // Distinct past non-Sunday days within the AR window (validators use IST today).
  const pastDays: string[] = [];
  for (let off = 3; pastDays.length < 3; off++) {
    const iso = addDaysIso(today, -off);
    if (dow(iso) !== 0) pastDays.push(iso);
  }
  const [arDay = '', otDay = '', lapseDay = ''] = pastDays;
  let odDay = addDaysIso(today, 7);
  if (dow(odDay) === 0) odDay = addDaysIso(odDay, 1);

  let mgrId: number;
  let mgrUserId: number;
  let empId: number;
  let empUserId: number;
  let emp2Id: number;
  let emp3Id: number; // no user account → workflow-less OT path
  let empToken: string;

  async function mkEmployee(suffix: string, managerId: number | null): Promise<number> {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const r = await db
      .insertInto('core.employees')
      .values({
        ecode: `RML8${String(stamp).slice(-5)}${suffix}`,
        company_id: rml.id,
        first_name: `S14 ${suffix}`,
        reporting_manager_id: managerId,
        status: 'active',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return r.id;
  }

  async function mkUser(employeeId: number, tag: string, roleCode?: string): Promise<number> {
    const u = await db
      .insertInto('core.users')
      .values({ email: `s14-${tag}-${stamp}@hrms.test`, password_hash: await hashPassword(password), employee_id: employeeId })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (roleCode) {
      const role = await db.selectFrom('core.roles').select('id').where('code', '=', roleCode).executeTakeFirstOrThrow();
      await db.insertInto('core.user_roles').values({ user_id: u.id, role_id: role.id, scope_org_unit_id: null }).execute();
    }
    return u.id;
  }

  async function swipe(employeeId: number, at: Date): Promise<void> {
    await sql`SELECT att.ensure_swipe_partition(${at.toISOString().slice(0, 10)}::date)`.execute(db);
    const ecode = (await db.selectFrom('core.employees').select('ecode').where('id', '=', employeeId).executeTakeFirstOrThrow()).ecode;
    await db
      .insertInto('att.swipe_events')
      .values({ employee_id: employeeId, employee_no: ecode, swipe_ts: at, door_code: `S14-${stamp}`, received_at: at, source: `s14-${stamp}` })
      .execute();
  }

  async function day(employeeId: number, isoDate: string) {
    return db
      .selectFrom('att.day_records')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .where('work_date', '=', sql<Date>`${isoDate}::date`)
      .executeTakeFirstOrThrow();
  }

  async function otEntry(employeeId: number, isoDate: string) {
    return db
      .selectFrom('att.overtime_entries')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .where('work_date', '=', sql<Date>`${isoDate}::date`)
      .executeTakeFirstOrThrow();
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    registerAttendanceWorkflowHooks();

    // The three Stage-1.4 chains must exist (idempotent — runtime edits survive).
    for (const def of WORKFLOW_DEFINITIONS.filter((d) => ['regularization', 'od', 'overtime'].includes(d.code))) {
      await db
        .insertInto('wf.definitions')
        .values({ code: def.code, name: def.name, steps: JSON.stringify(def.steps) })
        .onConflict((oc) => oc.column('code').doNothing())
        .execute();
    }

    mgrId = await mkEmployee('M', null);
    mgrUserId = await mkUser(mgrId, 'mgr');
    empId = await mkEmployee('E', mgrId);
    empUserId = await mkUser(empId, 'emp', 'employee');
    emp2Id = await mkEmployee('F', mgrId);
    await mkUser(emp2Id, 'emp2');
    emp3Id = await mkEmployee('G', mgrId); // deliberately NO user account

    const login = await (await httpRequest(app)).post('/api/auth/login').send({ identifier: `s14-emp-${stamp}@hrms.test`, password });
    empToken = (login.body as { accessToken: string }).accessToken;
    expect(empToken).toBeTruthy();
  });

  afterAll(async () => {
    const empIds = [empId, emp2Id, emp3Id, mgrId];
    await db.deleteFrom('att.overtime_entries').where('employee_id', 'in', empIds).execute();
    await db.deleteFrom('att.regularizations').where('employee_id', 'in', empIds).execute();
    const reqs = await db.selectFrom('wf.requests').select('id').where('subject_employee_id', 'in', empIds).execute();
    if (reqs.length > 0) {
      const ids = reqs.map((r) => r.id);
      await db.deleteFrom('wf.request_steps').where('request_id', 'in', ids).execute();
      await db.deleteFrom('wf.requests').where('id', 'in', ids).execute();
    }
    for (const id of empIds) {
      await sql`DELETE FROM att.day_records WHERE employee_id = ${id} AND is_locked = false`.execute(db);
    }
    await db.deleteFrom('att.recompute_queue').where('employee_id', 'in', empIds).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('email', 'like', `s14-%-${stamp}@hrms.test`)
      .execute();
    // Immutable swipe/audit FKs retain these synthetic employees. Keep them
    // outside active/payroll populations rather than leaking active fixtures.
    await db.updateTable('core.employees').set({ status: 'onboarding', reporting_manager_id: null,
      biometric_registered: false }).where('id', 'in', empIds).execute();
    await db.destroy();
  });

  it('V: the validators hold the line (AR past-only, caps, permission shape)', async () => {
    const base = { employeeId: empId, requestedByUserId: empUserId, reason: 'validator probe' };

    await expect(
      createRegularization(db, { ...base, kind: 'OD', fromDate: addDaysIso(today, 5), toDate: addDaysIso(today, 2) }),
    ).rejects.toThrow(/fromDate must be on or before toDate/);

    await expect(
      createRegularization(db, { ...base, kind: 'AR', fromDate: addDaysIso(today, 2), toDate: addDaysIso(today, 2) }),
    ).rejects.toThrow(/past days only/);

    await expect(
      createRegularization(db, { ...base, kind: 'AR', fromDate: addDaysIso(today, -45), toDate: addDaysIso(today, -45) }),
    ).rejects.toThrow(/closed/);

    await expect(
      createRegularization(db, { ...base, kind: 'PERMISSION', fromDate: arDay, toDate: addDaysIso(arDay, 1), fromTime: '10:00', toTime: '11:00' }),
    ).rejects.toThrow(/one day/);

    await expect(
      createRegularization(db, { ...base, kind: 'PERMISSION', fromDate: arDay, toDate: arDay }),
    ).rejects.toThrow(/needs from\/to times/);

    await expect(
      createRegularization(db, { ...base, kind: 'PERMISSION', fromDate: arDay, toDate: arDay, fromTime: '11:00', toTime: '10:00' }),
    ).rejects.toThrow(/toTime must be after fromTime/);

    await expect(
      createRegularization(db, { ...base, kind: 'PERMISSION', fromDate: arDay, toDate: arDay, fromTime: '09:00', toTime: '14:00' }),
    ).rejects.toThrow(/capped/);

    await expect(
      createRegularization(db, { ...base, kind: 'PERMISSION', fromDate: arDay, toDate: arDay, fromTime: '10:00', toTime: '11:00', dayPortion: 'first_half' }),
    ).rejects.toThrow(/Short permission uses times/);

    await expect(
      createRegularization(db, { ...base, kind: 'AR', fromDate: arDay, toDate: arDay, fromTime: '10:00', dayPortion: 'first_half' }),
    ).rejects.toThrow(/without custom times/);
  });

  it('holds a real OD domain request without posting attendance when every approver is vacant', async () => {
    const request = await createRegularization(db, { employeeId: mgrId, requestedByUserId: mgrUserId,
      kind: 'OD', fromDate: odDay, toDate: odDay, reason: 'Vacant chain must not create OD attendance' });
    expect((await db.selectFrom('wf.requests').select('status').where('id', '=', request.workflowRequestId).executeTakeFirstOrThrow()).status)
      .toBe('pending');
    expect((await db.selectFrom('att.regularizations').select('applied').where('id', '=', request.id).executeTakeFirstOrThrow()).applied)
      .toBe(false);
    expect(await db.selectFrom('att.day_records').select('id').where('employee_id', '=', mgrId)
      .where('work_date', '=', sql<Date>`${odDay}::date`).executeTakeFirst()).toBeUndefined();
  });

  it('preserves the hard OT lapse deadline while an all-vacant request waits for HR', async () => {
    await swipe(mgrId, ist(otDay, '08:00'));
    await swipe(mgrId, ist(otDay, '20:00'));
    await recomputeDay(db, mgrId, otDay);
    const entry = await otEntry(mgrId, otDay);
    expect(entry.workflow_request_id).not.toBeNull();
    const workflowId = entry.workflow_request_id ?? -1;
    expect((await db.selectFrom('wf.requests').select('status').where('id', '=', workflowId).executeTakeFirstOrThrow()).status).toBe('pending');
    const beforeDeadline = new Date();
    await runEscalations(db, beforeDeadline);
    expect((await otEntry(mgrId, otDay)).status).toBe('pending');
    await db.updateTable('wf.requests').set({ created_at: new Date(Date.now() - 100 * 3600_000) }).where('id', '=', workflowId).execute();
    await db.updateTable('att.overtime_entries').set({ deadline_at: new Date(Date.now() - 60_000) }).where('id', '=', entry.id).execute();
    await runEscalations(db);
    expect((await db.selectFrom('wf.requests').select('status').where('id', '=', workflowId).executeTakeFirstOrThrow()).status).toBe('lapsed');
    expect((await otEntry(mgrId, otDay)).status).toBe('lapsed');
  });

  it.each(['employee', 'attendance_day'] as const)('does not hold the global audit lock while waiting for a %s lock during approval', async lockKind => {
    let requestedDate = addDaysIso(odDay, lockKind === 'employee' ? 22 : 25);
    if (dow(requestedDate) === 0) requestedDate = addDaysIso(requestedDate, 1);
    const request = await createRegularization(db, { employeeId: empId, requestedByUserId: empUserId,
      kind: 'OD', fromDate: requestedDate, toDate: requestedDate, reason: 'Audit and employee lock order regression' });
    if (lockKind === 'attendance_day') await db.insertInto('att.day_records').values({ employee_id: empId,
      work_date: sql<Date>`${requestedDate}::date`, status: 'A', source: 'auto' }).execute();
    let decision: Promise<{ outcome: string } | { failure: unknown }> | undefined;
    let blockerFailure: unknown;
    try {
      await db.transaction().execute(async trx => {
        await sql`SET LOCAL statement_timeout = '3s'`.execute(trx);
        const pid = (await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(trx)).rows[0]?.pid;
        if (!pid) throw new Error('No blocker PID');
        if (lockKind === 'employee') await trx.selectFrom('core.employees').select('id').where('id', '=', empId)
          .forUpdate().executeTakeFirstOrThrow();
        else await trx.selectFrom('att.day_records').select('id').where('employee_id', '=', empId)
          .where('work_date', '=', sql<Date>`${requestedDate}::date`).forUpdate().executeTakeFirstOrThrow();
        decision = act(db, { requestId: request.workflowRequestId, actorUserId: mgrUserId, action: 'approve' })
          .then(outcome => ({ outcome }), (failure: unknown) => ({ failure }));
        // Observe the real wait, rather than assuming a sleep interleaves two transactions.
        await expect.poll(async () => (await sql<{ waiting: boolean }>`SELECT EXISTS (
          SELECT 1 FROM pg_locks WHERE NOT granted AND ${pid} = ANY(pg_blocking_pids(pid))
        ) AS waiting`.execute(trx)).rows[0]?.waiting, { interval: 10, timeout: 2000 }).toBe(true);
        await writeAudit(trx, { actorUserId: empUserId, action: 'update', entity: 'core.employees',
          entityId: empId, field: 'lock_order_regression', newValue: 'Synthetic transaction completed' });
      });
    } catch (cause) { blockerFailure = cause; }
    const result = await decision;
    expect(blockerFailure).toBeUndefined();
    expect(result).toEqual({ outcome: 'approved' });
    expect((await day(empId, requestedDate)).status).toBe('OD');
  });

  it('R1: AR approved by the manager flips the absent day to P and survives recompute', async () => {
    expect(await recomputeDay(db, empId, arDay)).toBe('A'); // no swipes that day
    const type = await db.selectFrom('lv.leave_types').select('id').where('code', '=', 'SL').executeTakeFirstOrThrow();
    await db.updateTable('att.day_records').set({ status: 'HD', leave_type_id: type.id,
      session_statuses: JSON.stringify([{ session: 1, status: 'A' }, { session: 2, status: 'P' }]),
    }).where('employee_id', '=', empId).where('work_date', '=', sql<Date>`${arDay}::date`).execute();

    const res = await (await httpRequest(app))
      .post('/api/attendance/requests')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ kind: 'AR', fromDate: arDay, toDate: arDay, reason: 'Biometric reader was down at gate 2' });
    expect(res.status).toBe(200);
    const { workflowRequestId } = res.body as { id: number; workflowRequestId: number };

    // The manager sees it, approves it — write-back is atomic with the approval.
    expect((await inbox(db, mgrUserId)).some((r) => r.request_id === workflowRequestId)).toBe(true);
    expect(await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');

    const d = await day(empId, arDay);
    expect(d.status).toBe('P');
    expect(d.source).toBe('regularized');
    expect(d.leave_type_id).toBeNull();
    expect(d.session_statuses).toBeNull();
    const reg = await db.selectFrom('att.regularizations').selectAll().where('workflow_request_id', '=', workflowRequestId).executeTakeFirstOrThrow();
    expect(reg.applied).toBe(true);

    // A recompute (sync drain, roster edit…) must NOT revert the approval.
    expect(await recomputeDay(db, empId, arDay)).toBe('skipped');
    expect((await day(empId, arDay)).source).toBe('regularized');

    // ESS list shows the decided request.
    const mine = await (await httpRequest(app)).get('/api/attendance/requests/mine').set('Authorization', `Bearer ${empToken}`);
    expect(mine.status).toBe(200);
    const rows = mine.body as { workflowRequestId: number; workflowStatus: string; applied: boolean }[];
    expect(rows.find((r) => r.workflowRequestId === workflowRequestId)?.workflowStatus).toBe('approved');
    const month = await (await httpRequest(app)).get(`/api/my/attendance?month=${arDay.slice(0, 7)}`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(month.status).toBe(200);
    const posted = (month.body as { date: string; status: string; leaveTypeCode: string | null; source: string }[]).find(row => row.date === arDay);
    expect(posted).toMatchObject({ status: 'P', leaveTypeCode: null, source: 'regularized' });
  });

  it('R2: a FUTURE-dated OD (KQ ask) approves into an OD day record', async () => {
    const { workflowRequestId } = await createRegularization(db, {
      employeeId: empId,
      requestedByUserId: empUserId,
      kind: 'OD',
      fromDate: odDay,
      toDate: odDay,
      reason: 'Client visit — Kharagpur plant',
    });
    expect(await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');

    const d = await day(empId, odDay);
    expect(d.status).toBe('OD');
    expect(d.source).toBe('regularized');
  });

  it('AR resubmission cannot bypass past-date validation or alter only the displayed payload', async () => {
    const { workflowRequestId } = await createRegularization(db, {
      employeeId: emp2Id, requestedByUserId: empUserId, kind: 'AR', fromDate: arDay, toDate: arDay,
      reason: 'Missing gate punch for regression',
    });
    await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'send_back', comment: 'Please verify the date' });
    const future = addDaysIso(today, 2);
    await expect(resubmit(db, { requestId: workflowRequestId, requesterUserId: empUserId,
      payload: { kind: 'AR', fromDate: future, toDate: future, reason: 'Revised missing punch reason', fromTime: null, toTime: null },
    })).rejects.toThrow(/past days/);
    const stored = await db.selectFrom('wf.requests').select('status').where('id', '=', workflowRequestId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('sent_back');
  });

  it('OD resubmission updates the authoritative date before the manager approves it', async () => {
    let oldDate = addDaysIso(odDay, 12);
    if (dow(oldDate) === 0) oldDate = addDaysIso(oldDate, 1);
    let newDate = addDaysIso(oldDate, 2);
    if (dow(newDate) === 0) newDate = addDaysIso(newDate, 1);
    const { workflowRequestId } = await createRegularization(db, {
      employeeId: emp2Id, requestedByUserId: empUserId, kind: 'OD', fromDate: oldDate, toDate: oldDate,
      reason: 'Original client visit date',
    });
    await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'send_back', comment: 'Confirm the revised visit date' });
    await resubmit(db, { requestId: workflowRequestId, requesterUserId: empUserId,
      payload: { kind: 'OD', fromDate: newDate, toDate: newDate, reason: 'Revised client visit date', fromTime: null, toTime: null },
    });
    expect(await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');
    expect((await day(emp2Id, newDate)).status).toBe('OD');
    expect(await db.selectFrom('att.day_records').select('id').where('employee_id', '=', emp2Id)
      .where('work_date', '=', sql<Date>`${oldDate}::date`).executeTakeFirst()).toBeUndefined();
  });

  it('an HR override blocks approval atomically instead of marking an unapplied request approved', async () => {
    let date = addDaysIso(odDay, 30);
    if (dow(date) === 0) date = addDaysIso(date, 1);
    const { workflowRequestId } = await createRegularization(db, {
      employeeId: emp2Id, requestedByUserId: empUserId, kind: 'OD', fromDate: date, toDate: date,
      reason: 'Protected-date regression fixture',
    });
    await db.insertInto('att.day_records').values({ employee_id: emp2Id, work_date: sql<Date>`${date}::date`,
      status: 'A', source: 'manual', override_reason: 'HR-reviewed fixture' }).execute();
    await expect(act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).rejects.toThrow(/HR override/);
    const request = await db.selectFrom('wf.requests').select('status').where('id', '=', workflowRequestId).executeTakeFirstOrThrow();
    expect(request.status).toBe('pending');
    const reg = await db.selectFrom('att.regularizations').select('applied').where('workflow_request_id', '=', workflowRequestId).executeTakeFirstOrThrow();
    expect(reg.applied).toBe(false);
    expect((await day(emp2Id, date)).source).toBe('manual');
  });

  it('O1: OT beyond shift end creates an entry + intimation; partial approval sticks', async () => {
    // GEN 09:00–18:00 · swipes 09:00→20:00 ⇒ worked 630 (P), OT 120.
    await swipe(empId, ist(otDay, '09:00'));
    await swipe(empId, ist(otDay, '20:00'));
    expect(await recomputeDay(db, empId, otDay)).toBe('P');
    expect((await day(empId, otDay)).ot_minutes).toBe(120);

    let entry = await otEntry(empId, otDay);
    expect(entry.detected_minutes).toBe(120);
    expect(entry.claimed_minutes).toBe(120);
    expect(entry.status).toBe('pending');
    expect(entry.workflow_request_id).not.toBeNull();
    expect(entry.manager_id).toBe(mgrId);

    // Re-detection is idempotent — still ONE pending entry.
    expect(await recomputeDay(db, empId, otDay)).toBe('P');
    entry = await otEntry(empId, otDay);
    expect(entry.status).toBe('pending');

    // Manager approves 90 of the 120 claimed minutes.
    const decided = await decideOvertime(db, { entryId: entry.id, actorUserId: mgrUserId, action: 'approve', approvedMinutes: 90 });
    expect(decided.status).toBe('approved');
    expect(decided.approved_minutes).toBe(90);
    expect(decided.decided_at).not.toBeNull();

    // Decided entries are closed — a second decision must fail.
    await expect(
      decideOvertime(db, { entryId: entry.id, actorUserId: mgrUserId, action: 'reject' }),
    ).rejects.toThrow(/already approved/);
  });

  it('O2: an undecided OT request LAPSES at the deadline — the ATT-08 teeth', async () => {
    await swipe(emp2Id, ist(lapseDay, '09:00'));
    await swipe(emp2Id, ist(lapseDay, '19:30'));
    await recomputeDay(db, emp2Id, lapseDay);

    const entry = await otEntry(emp2Id, lapseDay);
    expect(entry.status).toBe('pending');
    expect(entry.workflow_request_id).not.toBeNull();

    // Force the SLA breach on OUR step only, then run the hourly sweep.
    await db
      .updateTable('wf.request_steps')
      .set({ sla_due_at: new Date(Date.now() - 3600_000) })
      .where('request_id', '=', entry.workflow_request_id ?? -1)
      .execute();
    await runEscalations(db);

    const wf = await db.selectFrom('wf.requests').select('status').where('id', '=', entry.workflow_request_id ?? -1).executeTakeFirstOrThrow();
    expect(wf.status).toBe('lapsed');
    const after = await otEntry(emp2Id, lapseDay);
    expect(after.status).toBe('lapsed');
    expect(after.approved_minutes).toBeNull();
  });

  it('O3: week-off work by a user-less employee → workflow-less entry, swept at deadline', async () => {
    // Next Sunday: no roster ⇒ WO; swipes 10:00→14:00 ⇒ 240 min of detected OT.
    let sunday = addDaysIso(today, 1);
    while (dow(sunday) !== 0) sunday = addDaysIso(sunday, 1);
    await swipe(emp3Id, ist(sunday, '10:00'));
    await swipe(emp3Id, ist(sunday, '14:00'));

    expect(await recomputeDay(db, emp3Id, sunday)).toBe('WO');
    const d = await day(emp3Id, sunday);
    expect(d.worked_minutes).toBe(240);
    expect(d.ot_minutes).toBe(240);

    const entry = await otEntry(emp3Id, sunday);
    expect(entry.workflow_request_id).toBeNull(); // no ESS account → no workflow
    expect(entry.detected_minutes).toBe(240);

    // Past the 48h deadline the sweep lapses it.
    const lapsed = await lapseExpiredOvertime(db, new Date(Date.now() + 49 * 3600_000));
    expect(lapsed).toBeGreaterThanOrEqual(1);
    expect((await otEntry(emp3Id, sunday)).status).toBe('lapsed');
  });

  it('R3: an AR spanning a Sunday marks the working days P but leaves the week-off intact', async () => {
    // A recent Sunday whose following Monday is still in the past (AR window).
    let sun = addDaysIso(today, -1);
    while (!(dow(sun) === 0 && addDaysIso(sun, 1) <= today)) sun = addDaysIso(sun, -1);
    const fri = addDaysIso(sun, -2);
    const mon = addDaysIso(sun, 1);

    const { workflowRequestId } = await createRegularization(db, {
      employeeId: empId,
      requestedByUserId: empUserId,
      kind: 'AR',
      fromDate: fri,
      toDate: mon,
      reason: 'Reader outage across the weekend',
    });
    expect(await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');

    expect((await day(empId, fri)).status).toBe('P'); // working day → regularized P
    expect((await day(empId, mon)).status).toBe('P');
    const sundayRow = await db
      .selectFrom('att.day_records')
      .selectAll()
      .where('employee_id', '=', empId)
      .where('work_date', '=', sql<Date>`${sun}::date`)
      .executeTakeFirst();
    expect(sundayRow?.status).not.toBe('P'); // the paid week-off was never converted
  });

  it('O4: converting workflow-backed OT to comp-off lands the entry AND the ledger credit atomically', async () => {
    // A fresh past working day for the ESS employee (has a user → workflow-backed).
    let convDay = addDaysIso(today, -14);
    while (dow(convDay) === 0) convDay = addDaysIso(convDay, -1);
    await swipe(empId, ist(convDay, '09:00'));
    await swipe(empId, ist(convDay, '22:30')); // GEN 18:00 → OT 270 (≥ half-day)
    await recomputeDay(db, empId, convDay);

    const entry = await otEntry(empId, convDay);
    expect(entry.workflow_request_id).not.toBeNull();
    expect(entry.detected_minutes).toBe(270);

    const decided = await decideOvertime(db, { entryId: entry.id, actorUserId: mgrUserId, action: 'convert_comp_off' });
    expect(decided.status).toBe('converted_comp_off');
    expect(decided.comp_off_credit_id).not.toBeNull();

    // The credit is a real, linked, immutable comp-off ledger row (0.5 for 270 min).
    const credit = await db
      .selectFrom('lv.ledger')
      .selectAll()
      .where('id', '=', decided.comp_off_credit_id ?? -1)
      .executeTakeFirstOrThrow();
    expect(credit.txn_type).toBe('comp_off_earn');
    expect(Number(credit.delta)).toBe(0.5);
    expect(credit.reference_id).toBe(entry.id);
    const wf = await db.selectFrom('wf.requests').select('status').where('id', '=', entry.workflow_request_id ?? -1).executeTakeFirstOrThrow();
    expect(wf.status).toBe('approved');
  });
});
