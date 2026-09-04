/**
 * Stage 1.2 API/data-flow proof (ATT-03/04/05/13, CORE-10):
 * own holiday calendars are location-scoped, manager employee-id endpoints
 * cannot jump outside their subtree, and the ESS month contract retains shift,
 * integer minutes, and first/second-half statuses.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import type { Kysely } from 'kysely';
import request from 'supertest';
import { sql } from 'kysely';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { hashPassword } from '../src/modules/auth/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);
const JWT_SECRET = 'stage12-attendance-api-secret-32-chars!';

run('Stage 1.2 — attendance API scope and calendar contract (live Postgres)', () => {
  let db: Kysely<Database>;
  let app: Express;
  const stamp = Date.now();
  const password = 'Attendance-scope-test-1!';
  const holidayPrefix = `S12 API ${String(stamp)}`;
  let companyId: number;
  let firstLocationId: number;
  let secondLocationId: number;
  let managerEmployeeId: number;
  let teamEmployeeId: number;
  let outsiderEmployeeId: number;
  let managerUserId: number;
  let teamUserId: number;
  let adminUserId: number;
  let managerToken: string;
  let teamToken: string;
  let adminToken: string;

  async function addRole(userId: number, code: string): Promise<void> {
    const role = await db.selectFrom('core.roles').select('id').where('code', '=', code).executeTakeFirstOrThrow();
    await db.insertInto('core.user_roles').values({ user_id: userId, role_id: role.id, scope_org_unit_id: null }).execute();
  }

  async function login(email: string): Promise<string> {
    const response = await request(app).post('/api/auth/login').send({ identifier: email, password });
    expect(response.status).toBe(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
    companyId = (await db.selectFrom('core.companies').select('id').where('code', '=', 'RML').executeTakeFirstOrThrow()).id;
    const locations = await db
      .insertInto('core.locations')
      .values([
        { company_id: companyId, name: `S12 location A ${String(stamp)}`, state_code: 'WB' },
        { company_id: companyId, name: `S12 location B ${String(stamp)}`, state_code: 'WB' },
      ])
      .returning('id')
      .execute();
    [firstLocationId = 0, secondLocationId = 0] = locations.map((row) => row.id);

    managerEmployeeId = (
      await db.insertInto('core.employees').values({
        ecode: `S12M${String(stamp).slice(-7)}`,
        company_id: companyId,
        first_name: 'Stage12 Manager',
        location_id: firstLocationId,
        status: 'active',
      }).returning('id').executeTakeFirstOrThrow()
    ).id;
    teamEmployeeId = (
      await db.insertInto('core.employees').values({
        ecode: `S12T${String(stamp).slice(-7)}`,
        company_id: companyId,
        first_name: 'Stage12 Team',
        location_id: firstLocationId,
        reporting_manager_id: managerEmployeeId,
        status: 'active',
      }).returning('id').executeTakeFirstOrThrow()
    ).id;
    outsiderEmployeeId = (
      await db.insertInto('core.employees').values({
        ecode: `S12O${String(stamp).slice(-7)}`,
        company_id: companyId,
        first_name: 'Stage12 Outside',
        location_id: secondLocationId,
        status: 'active',
      }).returning('id').executeTakeFirstOrThrow()
    ).id;
    await db
      .insertInto('core.reporting_tree')
      .values({ manager_id: managerEmployeeId, employee_id: teamEmployeeId, depth: 1 })
      .onConflict((oc) => oc.columns(['manager_id', 'employee_id']).doNothing())
      .execute();

    const passwordHash = await hashPassword(password);
    managerUserId = (await db.insertInto('core.users').values({
      email: `s12-manager-${String(stamp)}@hrms.test`, password_hash: passwordHash, employee_id: managerEmployeeId,
    }).returning('id').executeTakeFirstOrThrow()).id;
    teamUserId = (await db.insertInto('core.users').values({
      email: `s12-team-${String(stamp)}@hrms.test`, password_hash: passwordHash, employee_id: teamEmployeeId,
    }).returning('id').executeTakeFirstOrThrow()).id;
    adminUserId = (await db.insertInto('core.users').values({
      email: `s12-admin-${String(stamp)}@hrms.test`, password_hash: passwordHash,
    }).returning('id').executeTakeFirstOrThrow()).id;
    await addRole(managerUserId, 'manager');
    await addRole(teamUserId, 'employee');
    await addRole(adminUserId, 'super_admin');

    await db.insertInto('att.holidays').values([
      { location_id: null, holiday_date: sql<Date>`'2097-01-01'::date`, name: `${holidayPrefix} global` },
      { location_id: firstLocationId, holiday_date: sql<Date>`'2097-01-02'::date`, name: `${holidayPrefix} own` },
      { location_id: secondLocationId, holiday_date: sql<Date>`'2097-01-03'::date`, name: `${holidayPrefix} other` },
    ]).execute();
    const g5 = await db.selectFrom('att.shifts').select('id').where('code', '=', 'G5').executeTakeFirstOrThrow();
    await db.insertInto('att.day_records').values({
      employee_id: teamEmployeeId,
      work_date: sql<Date>`'2097-01-06'::date` as unknown as Date,
      shift_id: g5.id,
      status: 'HD',
      scheme_code: 'G5',
      first_in: new Date('2097-01-06T03:30:00.000Z'),
      last_out: new Date('2097-01-06T08:00:00.000Z'),
      worked_minutes: 240,
      late_minutes: 0,
      early_exit_minutes: 260,
      session_statuses: JSON.stringify([{ session: 1, status: 'P' }, { session: 2, status: 'A' }]),
    }).execute();

    managerToken = await login(`s12-manager-${String(stamp)}@hrms.test`);
    teamToken = await login(`s12-team-${String(stamp)}@hrms.test`);
    adminToken = await login(`s12-admin-${String(stamp)}@hrms.test`);
  });

  afterAll(async () => {
    await db.deleteFrom('att.recompute_queue').where('employee_id', 'in', [managerEmployeeId, teamEmployeeId, outsiderEmployeeId]).execute();
    await db.deleteFrom('att.day_records').where('employee_id', 'in', [managerEmployeeId, teamEmployeeId, outsiderEmployeeId]).execute();
    await db.deleteFrom('att.employee_shifts').where('employee_id', 'in', [managerEmployeeId, teamEmployeeId, outsiderEmployeeId]).execute();
    await db.deleteFrom('att.holidays').where('name', 'like', `${holidayPrefix}%`).execute();
    await db.deleteFrom('core.user_roles').where('user_id', 'in', [managerUserId, teamUserId, adminUserId]).execute();
    await db.updateTable('core.users').set({ is_active: false, employee_id: null }).where('id', 'in', [managerUserId, teamUserId, adminUserId]).execute();
    await db.deleteFrom('core.employees').where('id', 'in', [teamEmployeeId, outsiderEmployeeId, managerEmployeeId]).execute();
    await db.deleteFrom('core.locations').where('id', 'in', [firstLocationId, secondLocationId]).execute();
    await db.destroy();
  });

  it('returns only global and employee-location holidays to ESS', async () => {
    const response = await request(app)
      .get('/api/attendance/config/holidays?year=2097')
      .set('Authorization', `Bearer ${teamToken}`);
    expect(response.status).toBe(200);
    const names = (response.body as { name: string }[]).map((row) => row.name);
    expect(names).toContain(`${holidayPrefix} global`);
    expect(names).toContain(`${holidayPrefix} own`);
    expect(names).not.toContain(`${holidayPrefix} other`);
  });

  it('retains shift, exact minutes, and both half statuses in the ESS month payload', async () => {
    const response = await request(app)
      .get('/api/my/attendance?month=2097-01')
      .set('Authorization', `Bearer ${teamToken}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        date: '2097-01-06',
        status: 'HD',
        scheme: 'G5',
        workedMinutes: 240,
        earlyExitMinutes: 260,
        sessionStatuses: [{ session: 1, status: 'P' }, { session: 2, status: 'A' }],
      }),
    ]);
  });

  it('blocks manager day reads and scheme writes outside the reporting subtree', async () => {
    const roster = await request(app)
      .get('/api/attendance/roster?month=2097-01&subtree=true')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(roster.status).toBe(200);
    const rosterIds = (roster.body as { employeeId: number }[]).map((row) => row.employeeId);
    expect(rosterIds).toContain(teamEmployeeId);
    expect(rosterIds).not.toContain(outsiderEmployeeId);

    const outsideRead = await request(app)
      .get(`/api/attendance/days?employeeId=${String(outsiderEmployeeId)}&from=2097-01-01&to=2097-01-31`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(outsideRead.status).toBe(403);

    const outsideWrite = await request(app)
      .put(`/api/attendance/config/schemes/${String(outsiderEmployeeId)}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ weekdayShiftCode: 'G5', saturdayShiftCode: 'GCS' });
    expect(outsideWrite.status).toBe(403);

    const teamWrite = await request(app)
      .put(`/api/attendance/config/schemes/${String(teamEmployeeId)}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ weekdayShiftCode: 'G5', saturdayShiftCode: 'GCS' });
    expect(teamWrite.status).toBe(200);
    const queued = await db
      .selectFrom('att.recompute_queue')
      .select('employee_id')
      .where('employee_id', '=', teamEmployeeId)
      .where('work_date', '=', sql<Date>`'2097-01-06'::date`)
      .executeTakeFirst();
    expect(queued?.employee_id).toBe(teamEmployeeId);
  });

  it('upserts a global holiday against the partial unique index and exposes the admin calendar', async () => {
    for (const name of [`${holidayPrefix} revised 1`, `${holidayPrefix} revised 2`]) {
      const write = await request(app)
        .put('/api/attendance/config/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: '2097-01-01', name, locationId: null });
      expect(write.status).toBe(200);
    }
    const response = await request(app)
      .get('/api/attendance/config/holidays/admin?year=2097')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    const rows = (response.body as { date: string; name: string }[]).filter((row) => row.date === '2097-01-01');
    expect(rows.filter((row) => row.name === `${holidayPrefix} revised 2`)).toHaveLength(1);
  });
});
