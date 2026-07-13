/**
 * Stage 1.5 — Leave module (LV-01..09), live Postgres:
 *  A1 monthly accrual: hand-computed credits, EL service gate, DB-idempotent
 *  A2 sandwich rule: exclude skips the Sunday, include counts it
 *  A3 apply→approve e2e (API): ledger debit + L day-records, atomic
 *  A4 balance guard blocks over-application
 *  A5 cancel is a RE-APPROVAL: exact reversal, days handed back to recompute
 *  A6 LWP: days written, NO ledger rows (LOP flows from day records)
 *  A7 comp-off: OT convert → 0.5 earn w/ expiry · half-day CO spend · expiry sweep
 *  A8 restricted holiday: per-year cap + approved pick becomes an H day
 *  A9 encashment: 3-step chain → 'encash' debit; duplicate request blocked
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { sql, type Kysely } from 'kysely';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';
import { decideOvertime, recomputeDay, registerAttendanceWorkflowHooks } from '../src/modules/attendance/index.js';
import {
  adjustBalance,
  applyForLeave,
  computeLeaveSpan,
  getBalance,
  getLeaveType,
  registerLeaveWorkflowHooks,
  requestEncashment,
  runCompOffExpiry,
  runMonthlyAccrual,
  selectRestrictedHoliday,
} from '../src/modules/leave/index.js';
import { act, WORKFLOW_DEFINITIONS } from '../src/modules/workflows/index.js';
import { addDaysIso, istDateString } from '../src/core/dates.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

const IST_OFFSET_MS = 5.5 * 3600_000;
function ist(isoDate: string, time: string): Date {
  return new Date(new Date(`${isoDate}T${time}:00Z`).getTime() - IST_OFFSET_MS);
}

// Fixed 2032 dates, weekday-verified: 04-30 Fri · 05-02 Sun · 05-03 Mon ·
// 05-06 Thu · 05-07 Fri · 03-10 Wed · 03-15 Mon.
const ACCRUAL_MONTH = '2030-01-01';
const FRI = '2032-04-30';
const MON = '2032-05-03';

run('Stage 1.5 — leave module (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 's15-test-pw-1!';

  let mgrId: number;
  let mgrUserId: number;
  let empId: number; // full ESS fixture (user + employee role), doj 2020
  let emp2Id: number; // doj 2029-11 → EL service gate blocks at 2030-01
  let emp3Id: number; // no user account — comp-off path
  let empToken: string;

  async function mkEmployee(suffix: string, managerId: number | null, doj: string): Promise<number> {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const r = await db
      .insertInto('core.employees')
      .values({
        ecode: `RML9${String(stamp).slice(-5)}${suffix}`,
        company_id: rml.id,
        first_name: `S15 ${suffix}`,
        reporting_manager_id: managerId,
        status: 'active',
        doj: sql<Date>`${doj}::date` as unknown as Date,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return r.id;
  }

  async function mkUser(employeeId: number | null, tag: string, roleCode?: string): Promise<number> {
    const u = await db
      .insertInto('core.users')
      .values({ email: `s15-${tag}-${stamp}@hrms.test`, password_hash: await hashPassword(password), employee_id: employeeId })
      .returning('id')
      .executeTakeFirstOrThrow();
    if (roleCode) {
      const role = await db.selectFrom('core.roles').select('id').where('code', '=', roleCode).executeTakeFirstOrThrow();
      await db.insertInto('core.user_roles').values({ user_id: u.id, role_id: role.id, scope_org_unit_id: null }).execute();
    }
    return u.id;
  }

  async function balanceOf(employeeId: number, code: string): Promise<number> {
    const type = await getLeaveType(db, code);
    return (await getBalance(db, employeeId, type.id)).balance;
  }

  async function day(employeeId: number, isoDate: string) {
    return db
      .selectFrom('att.day_records')
      .selectAll()
      .where('employee_id', '=', employeeId)
      .where('work_date', '=', sql<Date>`${isoDate}::date`)
      .executeTakeFirst();
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    registerAttendanceWorkflowHooks();
    registerLeaveWorkflowHooks();

    for (const def of WORKFLOW_DEFINITIONS.filter((d) =>
      ['leave', 'leave_cancel', 'leave_encashment', 'comp_off', 'restricted_holiday', 'overtime'].includes(d.code),
    )) {
      await db
        .insertInto('wf.definitions')
        .values({ code: def.code, name: def.name, steps: JSON.stringify(def.steps) })
        .onConflict((oc) => oc.column('code').doNothing())
        .execute();
    }

    mgrId = await mkEmployee('M', null, '2015-06-01');
    mgrUserId = await mkUser(mgrId, 'mgr');
    empId = await mkEmployee('E', mgrId, '2020-01-01');
    await mkUser(empId, 'emp', 'employee');
    emp2Id = await mkEmployee('F', mgrId, '2029-11-01');
    emp3Id = await mkEmployee('G', mgrId, '2010-01-01'); // deliberately NO user

    const login = await request(app).post('/api/auth/login').send({ identifier: `s15-emp-${stamp}@hrms.test`, password });
    empToken = (login.body as { accessToken: string }).accessToken;
    expect(empToken).toBeTruthy();
  });

  afterAll(async () => {
    const empIds = [empId, emp2Id, emp3Id, mgrId];
    await db.deleteFrom('lv.rh_selections').where('employee_id', 'in', empIds).execute();
    await db.deleteFrom('lv.applications').where('employee_id', 'in', empIds).execute();
    await db.deleteFrom('att.overtime_entries').where('employee_id', 'in', empIds).execute();
    const reqs = await db.selectFrom('wf.requests').select('id').where('subject_employee_id', 'in', empIds).execute();
    if (reqs.length > 0) {
      const ids = reqs.map((r) => r.id);
      await db.deleteFrom('wf.request_steps').where('request_id', 'in', ids).execute();
      await db.deleteFrom('wf.requests').where('id', 'in', ids).execute();
    }
    await db.deleteFrom('lv.restricted_holidays').where('name', 'like', `S15 ${stamp}%`).execute();
    for (const id of empIds) {
      await sql`DELETE FROM att.day_records WHERE employee_id = ${id} AND is_locked = false`.execute(db);
    }
    await db.deleteFrom('att.recompute_queue').where('employee_id', 'in', empIds).execute();
    await db
      .updateTable('core.users')
      .set({ is_active: false, employee_id: null })
      .where('email', 'like', `s15-%-${stamp}@hrms.test`)
      .execute();
    // lv.ledger rows are append-only BY DESIGN — they stay, like audit rows.
    await db.destroy();
  });

  it('A1: monthly accrual credits the seeded rates, gates EL on service, and is DB-idempotent', async () => {
    const first = await runMonthlyAccrual(db, ACCRUAL_MONTH);
    expect(first.credited).toBeGreaterThanOrEqual(1);

    // Hand-computed: CL 0.75 · SL 0.58 · EL 1.25 (doj 2020 → service ≥ 12 months).
    expect(await balanceOf(empId, 'CL')).toBe(0.75);
    expect(await balanceOf(empId, 'SL')).toBe(0.58);
    expect(await balanceOf(empId, 'EL')).toBe(1.25);
    // doj 2029-11-01 → 2 months of service at 2030-01: EL gate blocks, CL doesn't.
    expect(await balanceOf(emp2Id, 'EL')).toBe(0);
    expect(await balanceOf(emp2Id, 'CL')).toBe(0.75);

    // Re-run: the partial unique index absorbs it — balances unchanged.
    await runMonthlyAccrual(db, ACCRUAL_MONTH);
    expect(await balanceOf(empId, 'CL')).toBe(0.75);
    expect(await balanceOf(empId, 'EL')).toBe(1.25);
  });

  it('A2: sandwich rule — exclude skips the Sunday, include counts it', async () => {
    const employee = { id: empId, location_id: null };
    const cl = await getLeaveType(db, 'CL'); // exclude
    const el = await getLeaveType(db, 'EL'); // include
    expect((await computeLeaveSpan(db, employee, cl, FRI, MON, false, false)).days).toBe(3); // Fri+Sat+Mon
    expect((await computeLeaveSpan(db, employee, el, FRI, MON, false, false)).days).toBe(4); // Sunday sandwiched in
  });

  it('A3: apply → RM approves → ledger debit + L day-records, atomic with the decision', async () => {
    await adjustBalance(db, { employeeId: empId, leaveTypeCode: 'CL', delta: 5, note: 'test grant', actorUserId: mgrUserId });

    const res = await request(app)
      .post('/api/leave/applications')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ leaveType: 'CL', fromDate: FRI, toDate: MON, reason: 'family function' });
    expect(res.status).toBe(200);
    const { id, workflowRequestId, days } = res.body as { id: number; workflowRequestId: number; days: number };
    expect(days).toBe(3);

    expect(await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');

    const appRow = await db.selectFrom('lv.applications').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
    expect(appRow.status).toBe('approved');
    expect(appRow.ledger_txn_id).not.toBeNull();
    expect(await balanceOf(empId, 'CL')).toBe(2.75); // 0.75 + 5 − 3

    const cl = await getLeaveType(db, 'CL');
    for (const iso of [FRI, '2032-05-01', MON]) {
      const d = await day(empId, iso);
      expect(d?.status).toBe('L');
      expect(d?.leave_type_id).toBe(cl.id);
      expect(d?.source).toBe('regularized');
    }
    expect((await day(empId, '2032-05-02'))?.status).not.toBe('L'); // the excluded Sunday

    const balances = await request(app).get('/api/leave/balances').set('Authorization', `Bearer ${empToken}`);
    expect(balances.status).toBe(200);
    const clRow = (balances.body as { leaveType: string; available: number }[]).find((b) => b.leaveType === 'CL');
    expect(clRow?.available).toBe(2.75);
  });

  it('A4: the balance guard blocks over-application', async () => {
    await expect(
      applyForLeave(db, {
        employeeId: empId,
        requestedByUserId: mgrUserId,
        leaveTypeCode: 'SL',
        fromDate: '2032-06-07',
        toDate: '2032-06-08',
      }),
    ).rejects.toThrow(/Insufficient SL/);
  });

  it('A5: cancelling approved leave is a re-approval that reverses the exact debit', async () => {
    const appRow = await db
      .selectFrom('lv.applications')
      .selectAll()
      .where('employee_id', '=', empId)
      .where('status', '=', 'approved')
      .executeTakeFirstOrThrow();

    const res = await request(app)
      .post(`/api/leave/applications/${appRow.id}/cancel`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({});
    expect(res.status).toBe(200);
    const { workflowRequestId } = res.body as { workflowRequestId: number };

    expect(await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');

    const after = await db.selectFrom('lv.applications').selectAll().where('id', '=', appRow.id).executeTakeFirstOrThrow();
    expect(after.status).toBe('cancelled');
    expect(await balanceOf(empId, 'CL')).toBe(5.75); // debit exactly reversed

    // The days went back to the recompute pipeline.
    expect((await day(empId, FRI))?.source).toBe('auto');
    const queued = await db
      .selectFrom('att.recompute_queue')
      .select('work_date')
      .where('employee_id', '=', empId)
      .execute();
    expect(queued.length).toBeGreaterThanOrEqual(3);
  });

  it('A6: LWP writes the days but NO ledger rows — LOP flows from day records', async () => {
    const { workflowRequestId } = await applyForLeave(db, {
      employeeId: empId,
      requestedByUserId: mgrUserId,
      leaveTypeCode: 'LWP',
      fromDate: '2032-05-06',
      toDate: '2032-05-07',
    });
    expect(await act(db, { requestId: workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');

    const lwp = await getLeaveType(db, 'LWP');
    expect((await day(empId, '2032-05-06'))?.status).toBe('L');
    expect((await day(empId, '2032-05-07'))?.leave_type_id).toBe(lwp.id);
    const ledgerRows = await db
      .selectFrom('lv.ledger')
      .select('id')
      .where('employee_id', '=', empId)
      .where('leave_type_id', '=', lwp.id)
      .execute();
    expect(ledgerRows).toHaveLength(0);
  });

  it('A7: OT converts to a comp-off credit with expiry; half-day spend; expiry sweep lapses the rest', async () => {
    // GEN Wed 09:00→22:30 ⇒ OT 270 min; no user account ⇒ workflow-less entry.
    const otDay = '2032-03-10';
    await sql`SELECT att.ensure_swipe_partition(${otDay}::date)`.execute(db);
    const ecode = (await db.selectFrom('core.employees').select('ecode').where('id', '=', emp3Id).executeTakeFirstOrThrow()).ecode;
    for (const t of ['09:00', '22:30']) {
      await db
        .insertInto('att.swipe_events')
        .values({ employee_id: emp3Id, employee_no: ecode, swipe_ts: ist(otDay, t), door_code: `S15-${stamp}`, received_at: ist(otDay, t), source: `s15-${stamp}` })
        .execute();
    }
    expect(await recomputeDay(db, emp3Id, otDay)).toBe('P');

    const entry = await db
      .selectFrom('att.overtime_entries')
      .selectAll()
      .where('employee_id', '=', emp3Id)
      .where('work_date', '=', sql<Date>`${otDay}::date`)
      .executeTakeFirstOrThrow();
    expect(entry.detected_minutes).toBe(270);
    expect(entry.workflow_request_id).toBeNull();

    const decided = await decideOvertime(db, { entryId: entry.id, actorUserId: mgrUserId, action: 'convert_comp_off' });
    expect(decided.status).toBe('converted_comp_off');
    expect(decided.comp_off_credit_id).not.toBeNull();

    // 270 min ≥ half-day(240) but < full-day(480) ⇒ 0.5 comp-off, expiry +90d.
    const credit = await db.selectFrom('lv.ledger').selectAll().where('id', '=', decided.comp_off_credit_id ?? -1).executeTakeFirstOrThrow();
    expect(Number(credit.delta)).toBe(0.5);
    expect(credit.txn_type).toBe('comp_off_earn');
    expect(credit.expiry_date).not.toBeNull();
    expect(await balanceOf(emp3Id, 'CO')).toBe(0.5);

    // Spend it as a half-day CO application (the greytHR-broken flow, LV-04/PP-18).
    const co = await applyForLeave(db, {
      employeeId: emp3Id,
      requestedByUserId: mgrUserId,
      leaveTypeCode: 'CO',
      fromDate: '2032-03-15',
      toDate: '2032-03-15',
      fromHalf: true,
    });
    expect(co.days).toBe(0.5);
    expect(await act(db, { requestId: co.workflowRequestId, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');
    expect(await balanceOf(emp3Id, 'CO')).toBe(0);

    // An old credit past its window lapses; the live one survives (FIFO-generous).
    const coType = await getLeaveType(db, 'CO');
    await db
      .insertInto('lv.ledger')
      .values({
        employee_id: emp3Id,
        leave_type_id: coType.id,
        txn_type: 'comp_off_earn',
        delta: '1',
        effective_date: sql<Date>`${addDaysIso(istDateString(), -120)}::date` as unknown as Date,
        expiry_date: sql<Date>`${addDaysIso(istDateString(), -1)}::date` as unknown as Date,
        note: 'test: expired credit',
      })
      .execute();
    expect(await balanceOf(emp3Id, 'CO')).toBe(1);
    await runCompOffExpiry(db);
    expect(await balanceOf(emp3Id, 'CO')).toBe(0.5); // consumed 0.5 counted against the expired earn first
    await runCompOffExpiry(db); // idempotent
    expect(await balanceOf(emp3Id, 'CO')).toBe(0.5);
  });

  it('A8: restricted holidays are capped per year and an approved pick becomes an H day', async () => {
    const rhIds: number[] = [];
    for (const [date, name] of [
      ['2033-01-26', `S15 ${stamp} Republic`],
      ['2033-08-15', `S15 ${stamp} Independence`],
      ['2033-10-02', `S15 ${stamp} Gandhi`],
    ] as const) {
      const r = await db
        .insertInto('lv.restricted_holidays')
        .values({ holiday_date: sql<Date>`${date}::date` as unknown as Date, name, location_id: null })
        .returning('id')
        .executeTakeFirstOrThrow();
      rhIds.push(r.id);
    }

    const first = await selectRestrictedHoliday(db, { employeeId: empId, requestedByUserId: mgrUserId, restrictedHolidayId: rhIds[0] ?? -1 });
    await selectRestrictedHoliday(db, { employeeId: empId, requestedByUserId: mgrUserId, restrictedHolidayId: rhIds[1] ?? -1 });
    await expect(
      selectRestrictedHoliday(db, { employeeId: empId, requestedByUserId: mgrUserId, restrictedHolidayId: rhIds[2] ?? -1 }),
    ).rejects.toThrow(/limit reached/);

    expect(await act(db, { requestId: first, actorUserId: mgrUserId, action: 'approve' })).toBe('approved');
    expect((await day(empId, '2033-01-26'))?.status).toBe('H');
    const selection = await db.selectFrom('lv.rh_selections').selectAll().where('workflow_request_id', '=', first).executeTakeFirstOrThrow();
    expect(selection.applied).toBe(true);
  });

  it('A9: encashment walks its 3-step chain to an encash debit; duplicates are blocked', async () => {
    await adjustBalance(db, { employeeId: empId, leaveTypeCode: 'EL', delta: 10, note: 'test grant', actorUserId: mgrUserId });
    const before = await balanceOf(empId, 'EL'); // 1.25 + 10

    const requestId = await requestEncashment(db, { employeeId: empId, requestedByUserId: mgrUserId, leaveTypeCode: 'EL', days: 5 });
    await expect(
      requestEncashment(db, { employeeId: empId, requestedByUserId: mgrUserId, leaveTypeCode: 'EL', days: 2 }),
    ).rejects.toThrow(/already open/);

    const uH = await mkUser(null, 'hrops', 'hr_ops');
    const uP = await mkUser(null, 'payadm', 'payroll_admin');
    expect(await act(db, { requestId, actorUserId: mgrUserId, action: 'approve' })).toBe('advanced'); // RM
    expect(await act(db, { requestId, actorUserId: uH, action: 'approve' })).toBe('advanced'); // role:hr_ops
    expect(await act(db, { requestId, actorUserId: uP, action: 'approve' })).toBe('approved'); // role:payroll_admin

    expect(await balanceOf(empId, 'EL')).toBe(before - 5);
    const encash = await db
      .selectFrom('lv.ledger')
      .selectAll()
      .where('employee_id', '=', empId)
      .where('txn_type', '=', 'encash')
      .executeTakeFirstOrThrow();
    expect(Number(encash.delta)).toBe(-5);
    expect(encash.reference_id).toBe(requestId);
  });
});
