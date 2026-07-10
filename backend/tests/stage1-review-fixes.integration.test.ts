/**
 * Regression tests for the Phase-1 code-review fixes (live Postgres):
 *  F1 exclusive swipe attribution (night→day, no double-count)
 *  F2 holiday week earns a PAID week-off
 *  F6 day-records API returns the correct calendar date (IST server)
 *  F7 quarantined swipes can be re-ingested after review
 *  F8 role-queue: any active holder can act + sees it in their inbox
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
import { recomputeDay, closeWeek, reingestQuarantined } from '../src/modules/attendance/index.js';
import { createRequest, act, inbox } from '../src/modules/workflows/index.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

const IST_OFFSET_MS = 5.5 * 3600_000;
function ist(isoDate: string, time: string): Date {
  return new Date(new Date(`${isoDate}T${time}:00Z`).getTime() - IST_OFFSET_MS);
}

run('Phase-1 review fixes (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  let empId: number;
  const password = 'review-fix-pw-1!';

  async function mkEmployee(suffix: string): Promise<number> {
    const rml = await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow();
    const r = await db
      .insertInto('core.employees')
      .values({ ecode: `RML7${String(stamp).slice(-5)}${suffix}`, company_id: rml.id, first_name: `Fix ${suffix}` })
      .returning('id')
      .executeTakeFirstOrThrow();
    return r.id;
  }
  async function ecodeOf(id: number): Promise<string> {
    return (await db.selectFrom('core.employees').select('ecode').where('id', '=', id).executeTakeFirstOrThrow()).ecode;
  }
  async function swipe(employeeId: number, at: Date): Promise<void> {
    await sql`SELECT att.ensure_swipe_partition(${at.toISOString().slice(0, 10)}::date)`.execute(db);
    await db
      .insertInto('att.swipe_events')
      .values({ employee_id: employeeId, employee_no: await ecodeOf(employeeId), swipe_ts: at, door_code: `F-${stamp}`, received_at: at, source: `fix-${stamp}` })
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

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    empId = await mkEmployee('A');
  });

  afterAll(async () => {
    await db.deleteFrom('att.recompute_queue').where('employee_id', '=', empId).execute();
    await sql`DELETE FROM att.day_records WHERE employee_id = ${empId} AND is_locked = false`.execute(db);
    await db.deleteFrom('att.rosters').where('employee_id', '=', empId).execute();
    await db.deleteFrom('att.holidays').where('name', 'like', `Fix ${stamp}%`).execute();
    await db.destroy();
  });

  it('F1: a night worker’s morning exit is NOT double-counted onto the next day', async () => {
    // 2031-06-04 is a Wednesday; NIGHT that day, default (GEN) the next day.
    const d = '2031-06-04';
    const d1 = '2031-06-05';
    const night = await db.selectFrom('att.shifts').select('id').where('code', '=', 'NIGHT').executeTakeFirstOrThrow();
    await db
      .insertInto('att.rosters')
      .values({ employee_id: empId, work_date: sql<Date>`${d}::date` as unknown as Date, shift_id: night.id, is_week_off: false })
      .execute();

    await swipe(empId, ist(d, '22:05')); // night in
    await swipe(empId, ist(d1, '06:30')); // night out
    await swipe(empId, ist(d1, '09:05')); // NEXT day (GEN) in
    await swipe(empId, ist(d1, '18:05')); // NEXT day out

    await recomputeDay(db, empId, d);
    await recomputeDay(db, empId, d1);

    // Night day owns 22:05→06:30 only (≈8h25 − 30 break = 475), NOT up to 09:05.
    expect((await day(empId, d)).worked_minutes).toBe(475);
    // Next day starts at 09:05, not the 06:30 night-exit (9h − 30 = 510).
    expect((await day(empId, d1)).worked_minutes).toBe(510);
  });

  it('F2: a full-holiday week earns a PAID week-off (H counts as present)', async () => {
    // Week of Mon 2031-06-09 … Sun 06-15; Mon–Sat holidays, Sunday week-off.
    const mon = '2031-06-09';
    for (let i = 0; i < 6; i++) {
      const dt = new Date(`${mon}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() + i);
      const iso = dt.toISOString().slice(0, 10);
      await db
        .insertInto('att.holidays')
        .values({ holiday_date: sql<Date>`${iso}::date` as unknown as Date, name: `Fix ${stamp} H${i}`, location_id: null })
        .execute();
      await recomputeDay(db, empId, iso);
    }
    await recomputeDay(db, empId, '2031-06-15'); // Sunday → WO

    const updated = await closeWeek(db, mon);
    expect(updated).toBeGreaterThanOrEqual(1);
    expect((await day(empId, '2031-06-15')).weekoff_paid).toBe(true); // holidays keep the WO paid
  });

  it('F6: GET /attendance/days returns the correct calendar date (no IST off-by-one)', async () => {
    const hr = await db
      .insertInto('core.users')
      .values({ email: `fix-hr-${stamp}@hrms.test`, password_hash: await hashPassword(password), employee_id: empId })
      .returning('id')
      .executeTakeFirstOrThrow();
    const role = await db.selectFrom('core.roles').select('id').where('code', '=', 'hr_ops').executeTakeFirstOrThrow();
    await db.insertInto('core.user_roles').values({ user_id: hr.id, role_id: role.id, scope_org_unit_id: null }).execute();

    const login = await request(app).post('/api/auth/login').send({ identifier: `fix-hr-${stamp}@hrms.test`, password });
    const token = (login.body as { accessToken: string }).accessToken;

    const res = await request(app)
      .get('/api/attendance/days?employeeId=' + String(empId) + '&from=2031-06-04&to=2031-06-04')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const rows = res.body as { date: string }[];
    expect(rows[0]?.date).toBe('2031-06-04'); // the exact day, not 06-03

    await db.deleteFrom('core.user_roles').where('user_id', '=', hr.id).execute();
    await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('id', '=', hr.id).execute();
  });

  it('F7: quarantined swipes are re-ingested into attendance after review', async () => {
    const ecode = await ecodeOf(empId);
    await db
      .insertInto('att.quarantined_swipes')
      .values({
        employee_no: ecode,
        swipe_ts: ist('2031-06-04', '09:10'),
        door_code: `F-${stamp}`,
        received_at: ist('2031-06-04', '09:10'),
        source: `fix-q-${stamp}`,
        reason: 'future_timestamp',
      })
      .execute();

    const result = await reingestQuarantined(db);
    expect(result.promoted).toBeGreaterThanOrEqual(1);

    const promoted = await db
      .selectFrom('att.swipe_events')
      .select(['employee_id'])
      .where('employee_no', '=', ecode)
      .where('source', '=', `fix-q-${stamp}`)
      .executeTakeFirst();
    expect(promoted?.employee_id).toBe(empId); // matched to the employee, not NULL

    const q = await db.selectFrom('att.quarantined_swipes').select('reviewed').where('source', '=', `fix-q-${stamp}`).executeTakeFirstOrThrow();
    expect(q.reviewed).toBe(true);
  });

  it('F8: a role-queue step is actionable by ANY holder and shows in every holder’s inbox', async () => {
    // A throwaway role held by two users; a definition routing to it.
    const roleCode = `test_rq_${stamp}`;
    const role = await db.insertInto('core.roles').values({ code: roleCode, name: 'RQ test' }).returning('id').executeTakeFirstOrThrow();
    const uA = await db.insertInto('core.users').values({ email: `rq-a-${stamp}@hrms.test`, password_hash: 'x' }).returning('id').executeTakeFirstOrThrow();
    const uB = await db.insertInto('core.users').values({ email: `rq-b-${stamp}@hrms.test`, password_hash: 'x' }).returning('id').executeTakeFirstOrThrow();
    for (const u of [uA, uB]) {
      await db.insertInto('core.user_roles').values({ user_id: u.id, role_id: role.id, scope_org_unit_id: null }).execute();
    }
    await db
      .insertInto('wf.definitions')
      .values({ code: `rq_${stamp}`, name: 'RQ', steps: JSON.stringify([{ step: 1, approver: `role:${roleCode}`, slaHours: 48, onBreach: 'escalate' }]) })
      .execute();

    const requestId = await createRequest(db, {
      definitionCode: `rq_${stamp}`,
      subjectEmployeeId: empId,
      requestedByUserId: uA.id,
      payload: {},
    });

    // The step is notified to the lowest-id holder, but BOTH see it in their inbox.
    expect((await inbox(db, uA.id)).some((r) => r.request_id === requestId)).toBe(true);
    expect((await inbox(db, uB.id)).some((r) => r.request_id === requestId)).toBe(true);

    // The OTHER holder (not necessarily the notified one) can approve.
    const outcome = await act(db, { requestId, actorUserId: uB.id, action: 'approve' });
    expect(outcome).toBe('approved');

    await db.deleteFrom('wf.request_steps').where('request_id', '=', requestId).execute();
    await db.deleteFrom('wf.requests').where('id', '=', requestId).execute();
    await db.deleteFrom('wf.definitions').where('code', '=', `rq_${stamp}`).execute();
    await db.deleteFrom('core.user_roles').where('role_id', '=', role.id).execute();
    await db.updateTable('core.users').set({ is_active: false }).where('id', 'in', [uA.id, uB.id]).execute();
    await db.deleteFrom('core.roles').where('id', '=', role.id).execute();
  });
});
