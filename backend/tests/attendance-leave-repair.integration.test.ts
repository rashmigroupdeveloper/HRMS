/** ATT/LV/CORE/PAY: all fixtures and effects stay inside a rolled-back native transaction. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { addDaysIso, istDateString, istDateTime } from '../src/core/dates.js';
import { httpRequest } from './http-client.js';
import { createRegularization } from '../src/modules/attendance/index.js';
import { applyForLeave, requestCancellation } from '../src/modules/leave/index.js';
import { act } from '../src/modules/workflows/index.js';
import { PayrollRunService } from '../src/modules/payroll-core/runs/run.service.js';
import { reportR24Boarding } from '../src/modules/reports/reports.service.js';
import { hrOpsDashboard } from '../src/modules/reports/dashboard.service.js';
import { setSetting } from '../src/modules/settings/index.js';

const secret = 'isolated-attendance-leave-repair-secret';
const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('Attendance and leave repair against native PostgreSQL', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  async function fixture() {
    const tx = await db.startTransaction().execute();
    const tag = `repair${randomUUID().slice(0, 8)}`;
    const company = await tx.insertInto('core.companies').values({ code: tag, ecode_prefix: tag, name: tag }).returning('id').executeTakeFirstOrThrow();
    const unit = await tx.insertInto('core.org_units').values({ company_id: company.id, name: tag }).returning('id').executeTakeFirstOrThrow();
    const manager = await tx.insertInto('core.employees').values({ company_id: company.id, org_unit_id: unit.id, ecode: `${tag}M`, first_name: 'Synthetic manager', status: 'active', doj: '2020-01-01', attendance_mode: 'manual' }).returning('id').executeTakeFirstOrThrow();
    const employee = await tx.insertInto('core.employees').values({ company_id: company.id, org_unit_id: unit.id, ecode: `${tag}E`, first_name: 'Synthetic employee', status: 'active', doj: '2020-01-01', attendance_mode: 'manual', category: 'white_collar', reporting_manager_id: manager.id }).returning('id').executeTakeFirstOrThrow();
    const users: Record<string, { id: number; token: string }> = {};
    for (const [label, role, employeeId, scope] of [
      ['employee', 'employee', employee.id, null], ['manager', 'manager', manager.id, null],
      ['hr', 'hr_head', null, null], ['admin', 'super_admin', null, null], ['scoped', 'hr_ops', null, unit.id], ['payroll', 'payroll_admin', null, unit.id],
    ] as const) {
      const user = await tx.insertInto('core.users').values({ email: `${tag}-${label}@hrms.invalid`, password_hash: '!disabled!', employee_id: employeeId }).returning('id').executeTakeFirstOrThrow();
      const r = await tx.selectFrom('core.roles').select('id').where('code', '=', role).executeTakeFirstOrThrow();
      await tx.insertInto('core.user_roles').values({ user_id: user.id, role_id: r.id, scope_org_unit_id: scope }).execute();
      const session = await tx.insertInto('sec.sessions').values({ user_id: user.id, expires_at: new Date(Date.now() + 600_000) }).returning('sid').executeTakeFirstOrThrow();
      users[label] = { id: user.id, token: await signAccessToken(user.id, `${tag}-${label}@hrms.invalid`, secret, session.sid) };
    }
    const app = createApp({ db: tx, jwtSecret: secret, secureCookies: false });
    const date = addDaysIso(istDateString(), -1);
    const shift = await tx.selectFrom('att.shifts').select('id').where('code', '=', 'G5').executeTakeFirstOrThrow();
    await tx.insertInto('att.rosters').values({ employee_id: employee.id, work_date: sql<Date>`${date}::date`, shift_id: shift.id, is_week_off: false }).execute();
    const leave = await tx.insertInto('lv.leave_types').values({ code: tag, name: tag, is_paid: true }).returning('id').executeTakeFirstOrThrow();
    await tx.insertInto('lv.ledger').values({ employee_id: employee.id, leave_type_id: leave.id, txn_type: 'grant', delta: '10', effective_date: date, note: tag }).execute();
    return { tx, company: company.id, employee: employee.id, date, leave: tag, leaveId: leave.id, users,
      call: async (who: string, method: 'get' | 'put' | 'post', path: string, body?: object) => {
        const request = (await httpRequest(app))[method](path).set('Authorization', `Bearer ${users[who]?.token ?? ''}`);
        return body === undefined ? request : request.send(body);
      }, cleanup: async () => { await tx.rollback().execute(); } };
  }
  const config = (code: string) => ({ code, name: 'Synthetic policy', isPaid: true, accrualPerMonth: 1.25, accrualRequiresServiceMonths: 0, maxCarryForward: 10, encashable: false, maxPerRequest: 5, allowHalfDay: true, sandwichRule: 'exclude' });

  it('scoped HR can inspect global policy but cannot change it; full HR can edit and deactivate', async () => {
    const f = await fixture(); try {
      expect((await f.call('scoped', 'get', '/api/leave/admin/types')).body as unknown).toMatchObject({ canManageTypes: false });
      expect((await f.call('scoped', 'put', `/api/leave/types/${f.leave}`, config(f.leave))).status).toBe(403);
      expect((await f.call('hr', 'put', `/api/leave/types/${f.leave}`, { ...config(f.leave), isActive: false })).status).toBe(200);
      const catalog = await f.call('hr', 'get', '/api/leave/admin/types');
      const body = catalog.body as { canManageTypes: boolean; types: { code: string; isActive: boolean }[] };
      expect(body.canManageTypes).toBe(true);
      expect(body.types.find(row => row.code === f.leave)?.isActive).toBe(false);
    } finally { await f.cleanup(); }
  });
  it.each([{ accrualPerMonth: -1 }, { accrualRequiresServiceMonths: 0.5 }, { maxCarryForward: -1 }, { maxPerRequest: 0 }, { name: '   ' }, { isPaid: false, encashable: true }])('rejects invalid leave configuration %j', async invalid => {
    const f = await fixture(); try {
      expect((await f.call('hr', 'put', `/api/leave/types/${f.leave}`, { ...config(f.leave), ...invalid })).status).toBe(400);
    } finally { await f.cleanup(); }
  });
  it('cannot change paid/unpaid semantics of an already used leave type', async () => {
    const f = await fixture(); try {
      expect((await f.call('hr', 'put', `/api/leave/types/${f.leave}`, { ...config(f.leave), isPaid: false, accrualPerMonth: 0 })).status).toBe(409);
    } finally { await f.cleanup(); }
  });
  it('catalog and balances filter by employee category consistently', async () => {
    const f = await fixture(); try {
      await f.tx.updateTable('lv.leave_types').set({ applicable_categories: ['blue_collar'] }).where('id', '=', f.leaveId).execute();
      const types = await f.call('employee', 'get', '/api/leave/types');
      const balances = await f.call('employee', 'get', '/api/leave/balances');
      expect(types.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: f.leave })]));
      expect(balances.body).not.toEqual(expect.arrayContaining([expect.objectContaining({ leaveType: f.leave })]));
    } finally { await f.cleanup(); }
  });
  it('rejects impossible calendar dates, invalid clocks and whitespace-only reasons', async () => {
    const f = await fixture(); try {
      for (const input of [
        { kind: 'AR', fromDate: '2026-02-30', toDate: '2026-02-30', reason: 'Synthetic reason' },
        { kind: 'PERMISSION', fromDate: f.date, toDate: f.date, fromTime: '25:00', toTime: '26:00', reason: 'Synthetic reason' },
        { kind: 'AR', fromDate: f.date, toDate: f.date, reason: '     ' },
      ]) expect((await f.call('employee', 'post', '/api/attendance/requests', input)).status).toBe(400);
    } finally { await f.cleanup(); }
  });
  it('rejects a locked leave cancellation before it creates an approval request', async () => {
    const f = await fixture(); try {
      const leave = await applyForLeave(f.tx, { employeeId: f.employee, requestedByUserId: f.users['employee']?.id ?? 0, leaveTypeCode: f.leave, fromDate: f.date, toDate: f.date });
      await act(f.tx, { requestId: leave.workflowRequestId, actorUserId: f.users['manager']?.id ?? 0, action: 'approve' });
      await f.tx.updateTable('att.day_records').set({ is_locked: true }).where('employee_id', '=', f.employee).execute();
      await expect(requestCancellation(f.tx, { applicationId: leave.id, employeeId: f.employee, requestedByUserId: f.users['employee']?.id ?? 0 })).rejects.toThrow(/locked/);
      expect(await f.tx.selectFrom('wf.requests').select('id').where('subject_employee_id', '=', f.employee).where('definition_code', '=', 'leave_cancel').execute()).toHaveLength(0);
    } finally { await f.cleanup(); }
  });
  it.each(['leave_first', 'ar_first'])('prevents conflicting leave and regularization coverage (%s)', async order => {
    const f = await fixture(); try {
      const leave = () => applyForLeave(f.tx, { employeeId: f.employee, requestedByUserId: f.users['employee']?.id ?? 0, leaveTypeCode: f.leave, fromDate: f.date, toDate: f.date });
      const ar = () => createRegularization(f.tx, { employeeId: f.employee, requestedByUserId: f.users['employee']?.id ?? 0, kind: 'AR', fromDate: f.date, toDate: f.date, reason: 'Synthetic missing punch' });
      if (order === 'leave_first') { await leave(); await expect(ar()).rejects.toThrow(/leave/i); }
      else { await ar(); await expect(leave()).rejects.toThrow(/attendance|regularization/i); }
    } finally { await f.cleanup(); }
  });
  it('does not report missing attendance as complete coverage', async () => {
    const f = await fixture(); try {
      expect(await hrOpsDashboard(f.tx, f.company)).toMatchObject({ expectedToday: 2, processedToday: 0, awaitingToday: 2 });
    } finally { await f.cleanup(); }
  });
  it('refuses input lock before attendance closes, preserving the draft', async () => {
    const f = await fixture(); try {
      const service = new PayrollRunService(f.tx);
      const id = await service.createRun({ companyId: f.company, month: '2026-09-01', actorUserId: f.users['payroll']?.id ?? 0 });
      await expect(service.lockInputs(id, f.users['payroll']?.id ?? 0)).rejects.toThrow(/attendance/i);
      expect((await service.getRun(id))?.status).toBe('draft');
    } finally { await f.cleanup(); }
  });
  it('cancellation approval restores the exact debit and queues attendance recalculation', async () => {
    const f = await fixture(); try {
      const actor = f.users['employee']?.id ?? 0;
      const manager = f.users['manager']?.id ?? 0;
      const leave = await applyForLeave(f.tx, { employeeId: f.employee, requestedByUserId: actor, leaveTypeCode: f.leave, fromDate: f.date, toDate: f.date });
      await act(f.tx, { requestId: leave.workflowRequestId, actorUserId: manager, action: 'approve' });
      // A legacy/half-leave row may still carry clocks; cancellation must hand
      // back a clean pending result until the raw-swipe recompute runs.
      await f.tx.updateTable('att.day_records').set({ first_in: istDateTime(f.date, '09:00'), last_out: istDateTime(f.date, '18:00'), worked_minutes: 480 })
        .where('employee_id', '=', f.employee).where('work_date', '=', sql<Date>`${f.date}::date`).execute();
      const cancellation = await requestCancellation(f.tx, { applicationId: leave.id, employeeId: f.employee, requestedByUserId: actor });
      await act(f.tx, { requestId: cancellation, actorUserId: manager, action: 'approve' });
      expect(await f.tx.selectFrom('lv.applications').select('status').where('id', '=', leave.id).executeTakeFirstOrThrow()).toEqual({ status: 'cancelled' });
      const entries = await f.tx.selectFrom('lv.ledger').select(['txn_type', 'delta']).where('employee_id', '=', f.employee).execute();
      expect(entries.reduce((sum, row) => sum + Number(row.delta), 0)).toBe(10);
      expect(entries.filter(row => row.txn_type === 'cancel')).toHaveLength(1);
      expect(await f.tx.selectFrom('att.recompute_queue').select('employee_id').where('employee_id', '=', f.employee).execute()).toHaveLength(1);
      expect(await f.tx.selectFrom('att.day_records').select(['first_in', 'last_out', 'worked_minutes']).where('employee_id', '=', f.employee)
        .where('work_date', '=', sql<Date>`${f.date}::date`).executeTakeFirstOrThrow()).toEqual({first_in:null,last_out:null,worked_minutes:null});
    } finally { await f.cleanup(); }
  });
  it('full-day leave clears stale derived swipe and overtime facts', async () => {
    const f = await fixture(); try {
      await f.tx.insertInto('att.day_records').values({ employee_id: f.employee, work_date: f.date, status: 'P',
        first_in: istDateTime(f.date, '09:00'), last_out: istDateTime(f.date, '20:00'), worked_minutes: 600,
        late_minutes: 20, early_exit_minutes: 10, ot_minutes: 120, source: 'auto' }).execute();
      const leave = await applyForLeave(f.tx, { employeeId: f.employee, requestedByUserId: f.users['employee']?.id ?? 0,
        leaveTypeCode: f.leave, fromDate: f.date, toDate: f.date });
      await act(f.tx, { requestId: leave.workflowRequestId, actorUserId: f.users['manager']?.id ?? 0, action: 'approve' });
      expect(await f.tx.selectFrom('att.day_records').select(['status', 'first_in', 'last_out', 'worked_minutes', 'late_minutes', 'early_exit_minutes', 'ot_minutes'])
        .where('employee_id', '=', f.employee).where('work_date', '=', sql<Date>`${f.date}::date`).executeTakeFirstOrThrow())
        .toEqual({ status: 'L', first_in: null, last_out: null, worked_minutes: null, late_minutes: 0, early_exit_minutes: 0, ot_minutes: 0 });
    } finally { await f.cleanup(); }
  });
  it('holds full-day leave approval when an approved overtime obligation needs reconciliation', async () => {
    const f = await fixture(); try {
      const leave = await applyForLeave(f.tx, { employeeId: f.employee, requestedByUserId: f.users['employee']?.id ?? 0,
        leaveTypeCode: f.leave, fromDate: f.date, toDate: f.date });
      await f.tx.insertInto('att.overtime_entries').values({ employee_id: f.employee, work_date: f.date,
        detected_minutes: 120, claimed_minutes: 120, approved_minutes: 120, status: 'approved', deadline_at: new Date() }).execute();
      await expect(act(f.tx, { requestId: leave.workflowRequestId, actorUserId: f.users['manager']?.id ?? 0, action: 'approve' }))
        .rejects.toThrow(/overtime|comp.off/i);
      expect((await f.tx.selectFrom('lv.applications').select('status').where('id', '=', leave.id).executeTakeFirstOrThrow()).status).toBe('pending');
      expect((await f.tx.selectFrom('lv.ledger').select('id').where('employee_id', '=', f.employee).where('txn_type', '=', 'application').execute())).toHaveLength(0);
    } finally { await f.cleanup(); }
  });
  it('rejects future leave-job inputs before any global job executes', async () => {
    const f = await fixture(); try {
      const r = await f.call('admin', 'post', '/api/leave/accrual/run', { month: '2999-01' });
      expect(r.status).toBe(400);
      expect((await f.call('admin', 'post', '/api/leave/year-end/run', { yearEnd: '2999-12-31' })).status).toBe(400);
    } finally { await f.cleanup(); }
  });

  it('consolidates boarding in one scoped report without exposing other companies', async () => {
    const f = await fixture(); try {
      const unit = await f.tx.selectFrom('core.employees').select('org_unit_id').where('id', '=', f.employee).executeTakeFirstOrThrow();
      const result = await reportR24Boarding(f.tx, '2019-01-01', '2026-12-31', undefined, { all: false, own: false, subtree: false, orgUnitIds: [unit.org_unit_id ?? -1], actorEmployeeId: null });
      expect(result.joins).toHaveLength(2);
      expect(result.exits).toEqual([]);
      const denied = await reportR24Boarding(f.tx, '2019-01-01', '2026-12-31', undefined, { all: false, own: false, subtree: false, orgUnitIds: [], actorEmployeeId: null });
      expect(denied).toEqual({ joins: [], exits: [] });
    } finally { await f.cleanup(); }
  });

  it('preview enforces the same request cap as submission', async () => {
    const f = await fixture(); try {
      const path = `/api/leave/preview?leaveType=${f.leave}&from=${f.date}&to=${f.date}`;
      expect((await f.call('employee', 'get', path)).status).toBe(200);
      await f.tx.updateTable('lv.leave_types').set({ max_per_request: '0.5' }).where('id', '=', f.leaveId).execute();
      expect((await f.call('employee', 'get', path)).status).toBe(400);
      expect((await f.call('employee', 'post', '/api/leave/applications', { leaveType: f.leave, fromDate: f.date, toDate: f.date, reason: 'Synthetic reason' })).status).toBe(400);
    } finally { await f.cleanup(); }
  });
  it.each(['white_collar', 'blue_collar'] as const)('validates clock requests and rechecks minute caps at approval for %s', async category => {
    const f = await fixture(); try {
      await f.tx.updateTable('core.employees').set({category}).where('id','=',f.employee).execute();
      const common = {employeeId:f.employee,requestedByUserId:f.users['employee']?.id ?? 0,fromDate:f.date,toDate:f.date,reason:'Correct a bounded clock gap'};
      await expect(createRegularization(f.tx,{...common,kind:'AR',fromTime:'09:00',toTime:'10:00'})).rejects.toThrow(/short permission|times/i);
      await expect(createRegularization(f.tx,{...common,kind:'PERMISSION',fromTime:'02:00',toTime:'03:00'})).rejects.toThrow(/shift|working/i);
      const permission = await createRegularization(f.tx,{...common,kind:'PERMISSION',fromTime:'09:07',toTime:'10:08'}); // exactly 61 minutes
      await setSetting(f.tx,{key:'att.permission_max_hours',value:1,type:'number',description:'Synthetic minute cap',actorUserId:f.users['admin']?.id ?? 0});
      // The app owns a transaction per decision. This rollback-only fixture
      // supplies its parent transaction, so emulate that boundary explicitly.
      await sql`SAVEPOINT minute_cap_decision`.execute(f.tx);
      await expect(act(f.tx,{requestId:permission.workflowRequestId,actorUserId:f.users['manager']?.id ?? 0,action:'approve'})).rejects.toThrow(/capped|hours/i);
      await sql`ROLLBACK TO SAVEPOINT minute_cap_decision`.execute(f.tx);
      expect((await f.tx.selectFrom('att.regularizations').select('applied').where('id','=',permission.id).executeTakeFirstOrThrow()).applied).toBe(false);
      await setSetting(f.tx,{key:'att.permission_max_hours',value:2,type:'number',description:'Synthetic minute cap',actorUserId:f.users['admin']?.id ?? 0});
      await act(f.tx,{requestId:permission.workflowRequestId,actorUserId:f.users['manager']?.id ?? 0,action:'approve'});
      expect((await f.tx.selectFrom('att.regularizations').select('applied').where('id','=',permission.id).executeTakeFirstOrThrow()).applied).toBe(true);
    } finally { await f.cleanup(); }
  });
  it('validates balance adjustments and keeps the register consistent with the ledger', async () => {
    const f = await fixture(); try {
      const input = { employeeId: f.employee, leaveType: f.leave, delta: 2, note: 'Synthetic balance correction' };
      expect((await f.call('scoped', 'post', '/api/leave/adjustments', { ...input, delta: 0 })).status).toBe(400);
      expect((await f.call('scoped', 'post', '/api/leave/adjustments', { ...input, note: '     ' })).status).toBe(400);
      expect((await f.call('scoped', 'post', '/api/leave/adjustments', input)).status).toBe(200);
      const register = (await f.call('scoped', 'get', '/api/leave/register?onLeaveOnly=false')).body as { rows: { employeeId: number; balances: Record<string, number> }[] };
      expect(register.rows.find(row => row.employeeId === f.employee)?.balances[f.leave]).toBe(12);
    } finally { await f.cleanup(); }
  });

});
