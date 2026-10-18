/** CORE-10/11, ATT-03/04/05/15/17: native regression tests for role-flow F02–F05. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely, type Transaction } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { createApp } from '../src/app.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { setManualStatus } from '../src/modules/attendance/index.js';
import { recordDetectedOvertime } from '../src/modules/attendance/overtime.service.js';
import { httpRequest } from './http-client.js';

const url = process.env['DATABASE_URL'];
const secret = 'hr-attendance-safety-synthetic-only';
const rollback = new Error('Intentional HR safety fixture rollback');
interface Fixture {
  trx: Transaction<Database>; employeeId: number; outsideId: number; userId: number;
  companyId: number; token: string;
  request: Awaited<ReturnType<typeof httpRequest>>;
}
describe.skipIf(!url)('HR attendance correction and scheme safety (native PostgreSQL)', () => {
  let db: Kysely<Database>;
  beforeAll(() => { db = createDatabase(url ?? ''); });
  afterAll(async () => { await db.destroy(); });
  async function fixture(run: (f: Fixture) => Promise<void>) {
    try { await db.transaction().execute(async trx => {
      const tag = `hrsafe_${randomUUID().slice(0, 8)}`;
      const company = await trx.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false }).returning('id').executeTakeFirstOrThrow();
      const units = [];
      for (const suffix of ['A', 'B']) units.push((await trx.insertInto('core.org_units').values({ company_id: company.id, name: tag + suffix }).returning('id').executeTakeFirstOrThrow()).id);
      const people = [];
      for (const [i, unit] of units.entries()) people.push((await trx.insertInto('core.employees').values({ ecode: tag + String(i), first_name: 'HR safety synthetic', company_id: company.id, org_unit_id: unit, status: 'active', attendance_mode: 'manual' }).returning('id').executeTakeFirstOrThrow()).id);
      const employeeId = people[0]; const outsideId = people[1];
      if (!employeeId || !outsideId || !units[0]) throw new Error('Missing fixture people');
      const user = await trx.insertInto('core.users').values({ email: tag + '@hrms.invalid', password_hash: '!disabled!', employee_id: employeeId }).returning('id').executeTakeFirstOrThrow();
      const role = await trx.selectFrom('core.roles').select('id').where('code', '=', 'hr_ops').executeTakeFirstOrThrow();
      await trx.insertInto('core.user_roles').values({ user_id: user.id, role_id: role.id, scope_org_unit_id: units[0] }).execute();
      const session = await trx.insertInto('sec.sessions').values({ user_id: user.id, expires_at: new Date(Date.now() + 3600000) }).returning('sid').executeTakeFirstOrThrow();
      const token = await signAccessToken(user.id, tag + '@hrms.invalid', secret, session.sid);
      await run({ trx, employeeId, outsideId, userId: user.id, companyId: company.id, token, request: await httpRequest(createApp({ db: trx, jwtSecret: secret, secureCookies: false })) });
      throw rollback;
    }); } catch (error) { if (error !== rollback) throw error; }
  }
  const override = (f: Fixture, body: object) => f.request.put('/api/attendance/days/override').auth(f.token, { type: 'bearer' }).send({ employeeId: f.employeeId, date: '2026-10-01', status: 'A', reason: 'Gate register checked by HR', ...body });
  const day = (f: Fixture) => f.trx.selectFrom('att.day_records').selectAll().where('employee_id', '=', f.employeeId).where('work_date', '=', sql<Date>`'2026-10-01'::date`).executeTakeFirst();
  const audits = async (f: Fixture) => Number((await f.trx.selectFrom('core.audit_log').select(({ fn }) => fn.countAll().as('n')).where('actor_user_id', '=', f.userId).executeTakeFirstOrThrow()).n);
  const scheme = (f: Fixture, employeeId = f.employeeId, weekdayShiftCode = 'G5') => f.request.put(`/api/attendance/config/schemes/${employeeId}`).auth(f.token, { type: 'bearer' }).send({ employeeId, weekdayShiftCode });

  it('refuses a foreign-unit override and read without day/audit changes', async () => fixture(async f => {
    expect((await override(f, { employeeId: f.outsideId })).status).toBe(403);
    expect((await f.request.get(`/api/attendance/days?employeeId=${f.outsideId}&from=2026-10-01&to=2026-10-02`).auth(f.token, { type: 'bearer' })).status).toBe(403);
    expect(await audits(f)).toBe(0);
  }));
  it('writes an authorized half correction and preserves it through own scoped read', async () => fixture(async f => {
    const sessions = [{ session: 1, status: 'P' }, { session: 2, status: 'A' }];
    expect((await override(f, { status: 'HD', sessionStatuses: sessions, reason: '  Gate register checked by HR  ' })).status).toBe(200);
    expect(await day(f)).toMatchObject({ status: 'HD', session_statuses: sessions, override_reason: 'Gate register checked by HR' });
    const response = await f.request.get(`/api/attendance/days?employeeId=${f.employeeId}&from=2026-10-01&to=2026-10-01`).auth(f.token, { type: 'bearer' });
    expect(response.status).toBe(200); expect((response.body as { sessionStatuses: unknown }[])[0]?.sessionStatuses).toEqual(sessions);
    expect(await audits(f)).toBe(1);
  }));
  it('rejects whitespace and invalid calendar dates without audit', async () => fixture(async f => {
    expect((await override(f, { reason: '     ' })).status).toBe(400);
    expect((await override(f, { date: '2026-02-30' })).status).toBe(400);
    expect(await day(f)).toBeUndefined(); expect(await audits(f)).toBe(0);
  }));
  it('returns conflict for a locked row instead of a successful no-op', async () => fixture(async f => {
    await f.trx.insertInto('att.day_records').values({ employee_id: f.employeeId, work_date: sql<Date>`'2026-10-01'::date`, status: 'P', is_locked: true }).execute();
    expect((await override(f, {})).status).toBe(409);
    expect((await day(f))?.status).toBe('P'); expect(await audits(f)).toBe(0);
  }));
  it('refuses insertion into a closed month with no pre-existing day row', async () => fixture(async f => {
    await f.trx.insertInto('att.month_locks').values({ company_id: f.companyId, month: sql<Date>`'2026-10-01'::date`, locked_by: f.userId }).execute();
    expect((await override(f, {})).status).toBe(409);
    expect(await day(f)).toBeUndefined(); expect(await audits(f)).toBe(0);
  }));
  it('clears stale derived OT/penalty/working facts but retains the before snapshot', async () => fixture(async f => {
    await f.trx.insertInto('att.day_records').values({ employee_id: f.employeeId, work_date: sql<Date>`'2026-10-01'::date`, status: 'P', ot_minutes: 120, penalty_flag: true, weekoff_paid: true, worked_minutes: 600 }).execute();
    expect((await override(f, {})).status).toBe(200);
    expect(await day(f)).toMatchObject({ status: 'A', ot_minutes: 0, penalty_flag: false, weekoff_paid: null, worked_minutes: null, leave_type_id: null });
    const audit = await f.trx.selectFrom('core.audit_log').select(['old_value', 'new_value']).where('actor_user_id', '=', f.userId).executeTakeFirstOrThrow();
    expect(JSON.parse(audit.old_value ?? '{}') as object).toMatchObject({ otMinutes: 120, penaltyFlag: true });
    expect(JSON.parse(audit.new_value ?? '{}') as object).toMatchObject({ otMinutes: 0, penaltyFlag: false });
  }));
  it('does not erase an approved leave fact/ledger through attendance override', async () => fixture(async f => {
    const leaveType = await f.trx.selectFrom('lv.leave_types').select('id').where('is_active', '=', true).executeTakeFirstOrThrow();
    await f.trx.insertInto('att.day_records').values({ employee_id: f.employeeId, work_date: sql<Date>`'2026-10-01'::date`, status: 'L', leave_type_id: leaveType.id }).execute();
    expect((await override(f, { status: 'P' })).status).toBe(409);
    expect((await day(f))?.status).toBe('L'); expect(await audits(f)).toBe(0);
  }));
  it('does not erase an outstanding overtime decision or converted entitlement', async () => fixture(async f => {
    await f.trx.insertInto('att.overtime_entries').values({ employee_id: f.employeeId, work_date: sql<Date>`'2026-10-01'::date`, detected_minutes: 120, claimed_minutes: 120, deadline_at: new Date('2026-10-04'), status: 'approved', approved_minutes: 120 }).execute();
    expect((await override(f, {})).status).toBe(409);
    expect(await day(f)).toBeUndefined(); expect(await audits(f)).toBe(0);
  }));
  it('denies foreign-unit scheme assignment without a write/audit', async () => fixture(async f => {
    expect((await scheme(f, f.outsideId)).status).toBe(403);
    expect(await f.trx.selectFrom('att.employee_shifts').select('employee_id').where('employee_id', '=', f.outsideId).executeTakeFirst()).toBeUndefined();
    expect(await audits(f)).toBe(0);
  }));
  it('audits a real scheme change, queues affected unlocked unrostered days, and preserves no-op retries', async () => fixture(async f => {
    for (const [date, locked] of [['2026-10-01', false], ['2026-10-02', true]] as const) await f.trx.insertInto('att.day_records').values({ employee_id: f.employeeId, work_date: sql<Date>`${date}::date`, status: 'P', is_locked: locked }).execute();
    expect((await scheme(f)).status).toBe(200);
    expect(await audits(f)).toBe(1);
    expect(await f.trx.selectFrom('att.recompute_queue').select('employee_id').where('employee_id', '=', f.employeeId).execute()).toHaveLength(1);
    expect((await scheme(f)).status).toBe(200); expect(await audits(f)).toBe(1);
  }));
  it('rejects inactive or missing shifts without changing the employee scheme', async () => fixture(async f => {
    const shift = await f.trx.insertInto('att.shifts').values({ code: `inactive_${f.userId}`, name: 'Inactive test', start_time: '09:00', end_time: '18:00', min_half_day_hours: '4', min_full_day_hours: '8', is_active: false }).returning('code').executeTakeFirstOrThrow();
    expect((await scheme(f, f.employeeId, shift.code)).status).toBe(400);
    expect((await scheme(f, f.employeeId, 'missing-shift-for-test')).status).toBe(400);
    expect(await audits(f)).toBe(0);
  }));
  it('validates reasons in the service as well as the HTTP contract', async () => fixture(async f => {
    await expect(setManualStatus(f.trx, { employeeId: f.employeeId, isoDate: '2026-10-01', status: 'P', reason: '     ', actorUserId: f.userId })).rejects.toThrow(/reason/i);
    expect(await day(f)).toBeUndefined(); expect(await audits(f)).toBe(0);
  }));
  it('invalidates affected manager attestations once and preserves roster/due-date authority', async () => fixture(async f => {
    await f.trx.updateTable('core.employees').set({ reporting_manager_id: f.outsideId }).where('id', '=', f.employeeId).execute();
    const g5 = await f.trx.selectFrom('att.shifts').select('id').where('code', '=', 'G5').executeTakeFirstOrThrow();
    for (const date of ['2026-10-01', '2026-10-02']) await f.trx.insertInto('att.day_records').values({ employee_id: f.employeeId, work_date: sql<Date>`${date}::date`, status: 'P' }).execute();
    await f.trx.insertInto('att.rosters').values({ employee_id: f.employeeId, work_date: sql<Date>`'2026-10-02'::date`, shift_id: g5.id }).execute();
    await f.trx.insertInto('att.manager_month_approvals').values({ company_id: f.companyId, manager_employee_id: f.outsideId, month: sql<Date>`'2026-10-01'::date`, approved_by_user_id: f.userId, event_type: 'approve' }).execute();
    const due = new Date('2027-01-01T00:00:00Z');
    await f.trx.insertInto('att.recompute_queue').values({ employee_id: f.employeeId, work_date: sql<Date>`'2026-10-01'::date`, queued_at: due }).execute();
    expect((await scheme(f)).status).toBe(200);
    const queue = await f.trx.selectFrom('att.recompute_queue').select('queued_at').where('employee_id', '=', f.employeeId).execute();
    expect(queue).toHaveLength(1); expect(queue[0]?.queued_at.toISOString()).toBe(due.toISOString());
    expect((await f.trx.selectFrom('att.manager_month_approvals').select('event_type').where('manager_employee_id', '=', f.outsideId).orderBy('id').execute()).map(r => r.event_type)).toEqual(['approve', 'invalidate']);
    expect((await scheme(f)).status).toBe(200); expect(await audits(f)).toBe(1);
  }));

  async function committedFixture(run: (employeeId: number, userId: number) => Promise<void>) {
    const tag = `hrsafe_commit_${randomUUID().slice(0, 8)}`;
    const company = await db.insertInto('core.companies').values({ code: tag, name: tag, ecode_prefix: tag, is_india_payroll: false }).returning('id').executeTakeFirstOrThrow();
    const employee = await db.insertInto('core.employees').values({ company_id: company.id, ecode: tag, first_name: 'Committed synthetic safety', status: 'active', attendance_mode: 'manual' }).returning('id').executeTakeFirstOrThrow();
    const user = await db.insertInto('core.users').values({ email: tag + '@hrms.invalid', password_hash: '!disabled!', employee_id: employee.id }).returning('id').executeTakeFirstOrThrow();
    try { await run(employee.id, user.id); }
    finally {
      await db.deleteFrom('att.overtime_entries').where('employee_id', '=', employee.id).execute();
      const requests = await db.selectFrom('wf.requests').select('id').where('subject_employee_id', '=', employee.id).execute();
      const ids = requests.map(r => r.id);
      if (ids.length) {
        await db.deleteFrom('wf.request_steps').where('request_id', 'in', ids).execute();
        await db.deleteFrom('wf.requests').where('id', 'in', ids).execute();
      }
      await db.deleteFrom('att.day_records').where('employee_id', '=', employee.id).where('is_locked', '=', false).execute();
      await db.deleteFrom('att.recompute_queue').where('employee_id', '=', employee.id).execute();
      await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('id', '=', user.id).execute();
      await db.updateTable('core.employees').set({ status: 'exited', dol: new Date() }).where('id', '=', employee.id).execute();
    }
  }
  it('rolls back the day when its audit insert fails, using a real standalone transaction', async () => committedFixture(async (employeeId) => {
    await expect(setManualStatus(db, { employeeId, isoDate: '2026-10-01', status: 'P', reason: 'Audit failure rollback proof', actorUserId: -1 })).rejects.toThrow();
    expect(await db.selectFrom('att.day_records').select('id').where('employee_id', '=', employeeId).execute()).toHaveLength(0);
  }));
  it('serializes concurrent corrections and records the actual predecessor for each', async () => committedFixture(async (employeeId, userId) => {
    await Promise.all((['P', 'A'] as const).map(status => setManualStatus(db, { employeeId, isoDate: '2026-10-01', status, reason: 'Concurrent HR correction proof', actorUserId: userId })));
    const log = await db.selectFrom('core.audit_log').select(['old_value', 'new_value']).where('actor_user_id', '=', userId).orderBy('id').execute();
    expect(log).toHaveLength(2); expect(log[0]?.old_value).toBeNull();
    const first = JSON.parse(log[0]?.new_value ?? '{}') as { status: string };
    const secondOld = JSON.parse(log[1]?.old_value ?? '{}') as { status: string };
    const last = JSON.parse(log[1]?.new_value ?? '{}') as { status: string };
    expect(secondOld.status).toBe(first.status);
    expect((await db.selectFrom('att.day_records').select('status').where('employee_id', '=', employeeId).executeTakeFirstOrThrow()).status).toBe(last.status);
  }));

  it('rejects a delayed derived OT detector after HR corrected the source day', async () => committedFixture(async (employeeId, userId) => {
    await setManualStatus(db, { employeeId, isoDate: '2026-10-01', status: 'A', reason: 'HR gate register correction', actorUserId: userId });
    await recordDetectedOvertime(db, employeeId, '2026-10-01', 120, { otMinMinutes: 30, otDecisionHours: 48 }, true);
    expect(await db.selectFrom('att.overtime_entries').select('id').where('employee_id', '=', employeeId).execute()).toHaveLength(0);
  }));

  it('rechecks a delayed OT workflow detector after it waits for the HR subject lock', async () => committedFixture(async (employeeId, userId) => {
    await db.insertInto('att.day_records').values({ employee_id: employeeId, work_date: sql<Date>`'2026-10-01'::date`, status: 'P', ot_minutes: 120 }).execute();
    let detection: Promise<void> | undefined;
    try {
      await db.transaction().execute(async trx => {
        await trx.selectFrom('core.employees').select('id').where('id', '=', employeeId).forUpdate().executeTakeFirstOrThrow();
        const holder = (await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(trx)).rows[0]?.pid;
        if (!holder) throw new Error('Missing holder PID');
        detection = recordDetectedOvertime(db, employeeId, '2026-10-01', 120, { otMinMinutes: 30, otDecisionHours: 48 }, true);
        const until = Date.now() + 5000;
        for (;;) {
          const waiting = await sql<{ blocked: boolean }>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE ${holder} = ANY(pg_blocking_pids(a.pid))) AS blocked`.execute(db);
          if (waiting.rows[0]?.blocked) break;
          if (Date.now() > until) throw new Error('OT detector did not wait for subject lock');
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        await setManualStatus(trx, { employeeId, isoDate: '2026-10-01', status: 'A', reason: 'HR correction wins detector race', actorUserId: userId });
      });
    } finally { await detection; }
    expect(await db.selectFrom('att.overtime_entries').select('id').where('employee_id', '=', employeeId).execute()).toHaveLength(0);
    expect(await db.selectFrom('wf.requests').select('id').where('subject_employee_id', '=', employeeId).execute()).toHaveLength(0);
  }));

});
