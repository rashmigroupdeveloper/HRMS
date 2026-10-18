/** ATT-05/06/07: native HTTP → manager decision → two-half facts → R3/muster. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { addDaysIso, istDateString, istDateTime } from '../src/core/dates.js';
import { createRegularization, recomputeDay, registerAttendanceWorkflowHooks } from '../src/modules/attendance/index.js';
import { act, resubmit } from '../src/modules/workflows/index.js';
import { reportR3Regularizations, exportR3Excel, buildMusterMonth, listMuster } from '../src/modules/reports/index.js';
import ExcelJS from 'exceljs';
import { httpRequest } from './http-client.js';

const url = process.env['DATABASE_URL'];
const secret = 'half-attendance-integration-only-secret';
describe.skipIf(!url)('ATT-05/06/07 half attendance (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); registerAttendanceWorkflowHooks(); });
  afterAll(async () => { await db.destroy(); });
  async function fixture(run: (f: {
    employeeId: number; userId: number; managerUserId: number; token: string; date: string; companyId: number;
    roster: (date: string, split?: boolean) => Promise<void>;
    swipe: (date: string, time: string) => Promise<void>;
  }) => Promise<void>) {
    const tag = `half_${randomUUID().slice(0, 8)}`;
    const company = await db.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false }).returning('id').executeTakeFirstOrThrow();
    const manager = await db.insertInto('core.employees').values({ ecode: `${tag}M`, company_id: company.id, first_name: 'Half fixture manager', status: 'active' }).returning('id').executeTakeFirstOrThrow();
    const employee = await db.insertInto('core.employees').values({ ecode: `${tag}E`, company_id: company.id, first_name: 'Half fixture employee', reporting_manager_id: manager.id, attendance_mode: 'manual', status: 'active' }).returning('id').executeTakeFirstOrThrow();
    const users = [];
    for (const [label, employeeId] of [['manager', manager.id], ['employee', employee.id]] as const) {
      const row = await db.insertInto('core.users').values({ email: `${tag}_${label}@hrms.invalid`, password_hash: '!disabled-fixture!', employee_id: employeeId }).returning('id').executeTakeFirstOrThrow(); users.push(row.id);
    }
    const managerUserId = users[0]; const userId = users[1];
    if (!managerUserId || !userId) throw new Error('Missing fixture users');
    const role = await db.selectFrom('core.roles').select('id').where('code', '=', 'employee').executeTakeFirstOrThrow();
    await db.insertInto('core.user_roles').values({ user_id: userId, role_id: role.id, scope_org_unit_id: null }).execute();
    const session = await db.insertInto('sec.sessions').values({ user_id: userId, expires_at: new Date(Date.now() + 3600000) }).returning('sid').executeTakeFirstOrThrow();
    const date = addDaysIso(istDateString(), -2);
    const roster = async (day: string, split = true) => {
      const shift = await db.selectFrom('att.shifts').select('id').where('code', '=', split ? 'G5' : 'GEN').executeTakeFirstOrThrow();
      await db.insertInto('att.rosters').values({ employee_id: employee.id, work_date: sql<Date>`${day}::date`, shift_id: shift.id, is_week_off: false })
        .onConflict(oc => oc.columns(['employee_id', 'work_date']).doUpdateSet({ shift_id: shift.id })).execute();
    };
    const swipe = async (day: string, time: string) => {
      await sql`SELECT att.ensure_swipe_partition(${day}::date)`.execute(db);
      await db.insertInto('att.swipe_events').values({ employee_id: employee.id, employee_no: `${tag}E`, swipe_ts: istDateTime(day, time), door_code: tag, source: tag, received_at: new Date() }).execute();
    };
    try { await roster(date); await run({ employeeId: employee.id, userId, managerUserId, date, companyId: company.id, roster, swipe, token: await signAccessToken(userId, `${tag}_employee@hrms.invalid`, secret, session.sid) }); }
    finally {
      await db.deleteFrom('att.regularizations').where('employee_id', '=', employee.id).execute();
      const requests = await db.selectFrom('wf.requests').select('id').where('subject_employee_id', '=', employee.id).execute();
      const ids = requests.map(r => r.id);
      if (ids.length) {
        await db.deleteFrom('wf.request_steps').where('request_id', 'in', ids).execute();
        await db.deleteFrom('wf.requests').where('id', 'in', ids).execute();
      }
      await db.deleteFrom('att.day_records').where('employee_id', '=', employee.id).where('is_locked', '=', false).execute();
      // The owned month-lock header is immutable and retained with its isolated fixture company.
      await db.deleteFrom('att.recompute_queue').where('employee_id', '=', employee.id).execute();
      await db.updateTable('sec.sessions').set({ revoked_at: new Date(), revoke_reason: 'fixture cleanup' }).where('user_id', 'in', users).where('revoked_at', 'is', null).execute();
      await db.deleteFrom('core.user_roles').where('user_id', 'in', users).execute();
      await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('id', 'in', users).execute();
      await db.updateTable('core.employees').set({ status: 'exited', dol: sql<Date>`${istDateString()}::date`, reporting_manager_id: null }).where('id', 'in', [employee.id, manager.id]).execute();
    }
  }
  async function day(employeeId: number, date: string) {
    return db.selectFrom('att.day_records').selectAll().where('employee_id', '=', employeeId).where('work_date', '=', sql<Date>`${date}::date`).executeTakeFirstOrThrow();
  }
  it('HTTP first-half AR approves to P:A and keeps a half-day daily summary', async () => fixture(async f => {
    const app = createApp({ db, jwtSecret: secret, secureCookies: false });
    const schedule = await (await httpRequest(app)).get(`/api/attendance/requests/schedule?date=${f.date}`).auth(f.token, { type: 'bearer' });
    expect(schedule.status).toBe(200);
    expect((schedule.body as { windows: { dayPortion: string; startsAt: string; endsAt: string }[] }).windows).toContainEqual({
      dayPortion: 'first_half', startsAt: istDateTime(f.date, '09:00').toISOString(), endsAt: istDateTime(f.date, '13:30').toISOString(),
    });
    const response = await (await httpRequest(app)).post('/api/attendance/requests').auth(f.token, { type: 'bearer' })
      .send({ kind: 'AR', fromDate: f.date, toDate: f.date, dayPortion: 'first_half', reason: 'Missing first-half reader punch' });
    expect(response.status).toBe(200);
    const { workflowRequestId } = response.body as { workflowRequestId: number };
    expect(await act(db, { requestId: workflowRequestId, actorUserId: f.managerUserId, action: 'approve' })).toBe('approved');
    const posted = await day(f.employeeId, f.date);
    expect(posted.status).toBe('HD');
    expect(posted.session_statuses).toEqual([{ session: 1, status: 'P' }, { session: 2, status: 'A' }]);
    const mine = await (await httpRequest(app)).get('/api/attendance/requests/mine').auth(f.token, { type: 'bearer' });
    expect((mine.body as { dayPortion: string }[])[0]?.dayPortion).toBe('first_half');
    const report = await reportR3Regularizations(db, { companyId: f.companyId });
    expect(report[0]?.dayPortion).toBe('first_half');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(await exportR3Excel(db, { companyId: f.companyId })).buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Missing R3 sheet');
    expect(sheet.getRow(1).values).toContain('Attendance half');
    expect(sheet.getRow(2).values).toContain('first_half');
    await buildMusterMonth(db, f.companyId, f.date.slice(0, 7) + '-01');
    const muster = await listMuster(db, { companyId: f.companyId, month: f.date.slice(0, 7) + '-01' });
    const employee = muster.find(row => row.ecode.endsWith('E'));
    expect(employee?.dayStatuses[f.date.slice(-2)]).toBe('P:A');
    expect(employee?.halfDays).toBe(1);

  }));
  it('allows complementary pending halves and rejects overlapping coverage', async () => fixture(async f => {
    const base = { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'AR' as const, fromDate: f.date, toDate: f.date, reason: 'Correct missing reader punches' };
    const first = await createRegularization(db, { ...base, dayPortion: 'first_half' });
    const second = await createRegularization(db, { ...base, dayPortion: 'second_half' });
    await expect(createRegularization(db, { ...base, dayPortion: 'first_half' })).rejects.toThrow(/covers/);
    await expect(createRegularization(db, base)).rejects.toThrow(/covers/);
    await act(db, { requestId: first.workflowRequestId, actorUserId: f.managerUserId, action: 'approve' });
    await act(db, { requestId: second.workflowRequestId, actorUserId: f.managerUserId, action: 'approve' });
    expect((await day(f.employeeId, f.date)).status).toBe('P');
  }));
  it('keeps approved OD while later second-half swipes change the other half', async () => fixture(async f => {
    const request = await createRegularization(db, { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'OD', dayPortion: 'first_half', fromDate: f.date, toDate: f.date, reason: 'Client visit in the first half' });
    await act(db, { requestId: request.workflowRequestId, actorUserId: f.managerUserId, action: 'approve' });
    expect((await day(f.employeeId, f.date)).status).toBe('HD');
    await f.swipe(f.date, '13:35'); await f.swipe(f.date, '18:00');
    await recomputeDay(db, f.employeeId, f.date);
    const posted = await day(f.employeeId, f.date);
    expect(posted.status).toBe('P');
    expect(posted.late_minutes).toBe(0);
    expect(posted.session_statuses).toEqual([{ session: 1, status: 'OD' }, { session: 2, status: 'P' }]);
  }));
  it('does not fabricate future absence; approved half-OD queues processing at shift end', async () => fixture(async f => {
    const future = addDaysIso(istDateString(), 3); await f.roster(future);
    const request = await createRegularization(db, { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'OD', dayPortion: 'second_half', fromDate: future, toDate: future, reason: 'Planned customer visit after lunch' });
    await act(db, { requestId: request.workflowRequestId, actorUserId: f.managerUserId, action: 'approve' });
    expect(await db.selectFrom('att.day_records').select('id').where('employee_id', '=', f.employeeId).execute()).toHaveLength(0);
    const queued = await db.selectFrom('att.recompute_queue').select('queued_at').where('employee_id', '=', f.employeeId).executeTakeFirstOrThrow();
    expect(queued.queued_at.getTime()).toBeGreaterThan(Date.now());
  }));
  it('send-back correction updates authoritative half and manager-visible payload together', async () => fixture(async f => {
    const request = await createRegularization(db, { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'AR', dayPortion: 'first_half', fromDate: f.date, toDate: f.date, reason: 'Initial missing punch correction' });
    await act(db, { requestId: request.workflowRequestId, actorUserId: f.managerUserId, action: 'send_back', comment: 'Confirm which half needs correction' });
    await resubmit(db, { requestId: request.workflowRequestId, requesterUserId: f.userId, payload: { kind: 'AR', dayPortion: 'second_half', fromDate: f.date, toDate: f.date, reason: 'Corrected second-half missing punch' } });
    await act(db, { requestId: request.workflowRequestId, actorUserId: f.managerUserId, action: 'approve' });
    expect((await day(f.employeeId, f.date)).session_statuses).toEqual([{ session: 1, status: 'A' }, { session: 2, status: 'P' }]);
  }));
  it('keeps month locks authoritative and rolls back the entire half approval', async () => fixture(async f => {
    const request = await createRegularization(db, { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'AR', dayPortion: 'first_half', fromDate: f.date, toDate: f.date, reason: 'Missing first-half swipe correction' });
    await db.insertInto('att.month_locks').values({ company_id: f.companyId, locked_by: f.managerUserId, checklist: '{}', month: sql<Date>`${f.date.slice(0, 7) + '-01'}::date` }).execute();
    await expect(act(db, { requestId: request.workflowRequestId, actorUserId: f.managerUserId, action: 'approve' })).rejects.toThrow(/locked/);
    expect((await db.selectFrom('wf.requests').select('status').where('id', '=', request.workflowRequestId).executeTakeFirstOrThrow()).status).toBe('pending');
    expect((await db.selectFrom('att.regularizations').select('applied').where('id', '=', request.id).executeTakeFirstOrThrow()).applied).toBe(false);
  }));
  it('rejects half requests when shift boundaries are unavailable', async () => fixture(async f => {
    await f.roster(f.date, false);
    await expect(createRegularization(db, { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'AR', dayPortion: 'first_half', fromDate: f.date, toDate: f.date, reason: 'Missing reader entry for first half' })).rejects.toThrow(/boundaries/);
  }));
  it('serializes simultaneous submissions for the same half without orphan workflows', async () => fixture(async f => {
    const params = { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'AR' as const, dayPortion: 'first_half' as const, fromDate: f.date, toDate: f.date, reason: 'Concurrent missing swipe correction' };
    const results = await Promise.allSettled([createRegularization(db, params), createRegularization(db, params)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.selectFrom('att.regularizations').select('id').where('employee_id', '=', f.employeeId).execute()).toHaveLength(1);
    expect(await db.selectFrom('wf.requests').select('id').where('subject_employee_id', '=', f.employeeId).execute()).toHaveLength(1);
  }));
  it('does not replace an HR manual decision when a half request reaches final approval', async () => fixture(async f => {
    const request = await createRegularization(db, { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'AR', dayPortion: 'second_half', fromDate: f.date, toDate: f.date, reason: 'Missing second-half swipe entry' });
    await db.insertInto('att.day_records').values({ employee_id: f.employeeId, work_date: sql<Date>`${f.date}::date`, status: 'A', source: 'manual', override_reason: 'HR fixture correction'  }).execute();
    await expect(act(db, { requestId: request.workflowRequestId, actorUserId: f.managerUserId, action: 'approve' })).rejects.toThrow(/override/);
    expect((await day(f.employeeId, f.date)).source).toBe('manual');
    expect((await db.selectFrom('att.regularizations').select('applied').where('id', '=', request.id).executeTakeFirstOrThrow()).applied).toBe(false);
  }));

  it('does not report a false approval when existing leave prevents the half update', async () => fixture(async f => {
    const request = await createRegularization(db, { employeeId: f.employeeId, requestedByUserId: f.userId, kind: 'AR', dayPortion: 'first_half', fromDate: f.date, toDate: f.date, reason: 'Correct missing swipe before reconciliation' });
    const leave = await db.selectFrom('lv.leave_types').select('id').limit(1).executeTakeFirstOrThrow();
    await db.insertInto('att.day_records').values({ employee_id: f.employeeId, work_date: sql<Date>`${f.date}::date`, status: 'L', source: 'regularized', leave_type_id: leave.id }).execute();
    await expect(act(db, { requestId: request.workflowRequestId, actorUserId: f.managerUserId, action: 'approve' })).rejects.toThrow(/reconciliation/);
    expect((await day(f.employeeId, f.date)).status).toBe('L');
    expect((await db.selectFrom('att.regularizations').select('applied').where('id', '=', request.id).executeTakeFirstOrThrow()).applied).toBe(false);
  }));

});
