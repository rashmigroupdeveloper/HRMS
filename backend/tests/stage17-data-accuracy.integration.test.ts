/**
 * Stage 1.7 — clean-database data-flow accuracy regressions (RPT-02/RPT-03/ATT-15).
 *
 * These cases intentionally exercise data that never reaches a processed day,
 * historical employees whose current status differs from their as-of status,
 * and an organisation-scoped dashboard. They close blind spots that a populated
 * development database can conceal.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import { istDateString } from '../src/core/dates.js';
import { getMonthLockChecklist } from '../src/modules/attendance/index.js';
import {
  buildKpiSnapshot,
  businessUnitDashboard,
  readKpiSnapshot,
  reportR2RawSwipes,
  reportR2Swipes,
} from '../src/modules/reports/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

run('Stage 1.7 — report and dashboard data accuracy', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();

  beforeAll(() => {
    db = createDatabase(DB_URL ?? '');
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('runs only against an explicitly isolated *_test database', async () => {
    const result = await sql<{ database_name: string }>`
      SELECT current_database() AS database_name
    `.execute(db);
    expect(result.rows[0]?.database_name).toMatch(/_test$/);
  });

  it('rejects non-canonical partial-month lock inputs before reading data', async () => {
    await expect(getMonthLockChecklist(db, 1, '2026-09-15')).rejects.toThrow(/YYYY-MM/);
    await expect(getMonthLockChecklist(db, 1, '2026-13')).rejects.toThrow(/YYYY-MM/);
  });

  it('shows a biometric swipe even when processing produced no day record', async () => {
    const month = istDateString().slice(0, 7);
    const workDate = `${month}-02`;
    const code = `R2${stamp.toString(36).toUpperCase()}`;
    const company = await db
      .insertInto('core.companies')
      .values({ code, name: `R2 orphan ${String(stamp)}`, ecode_prefix: code })
      .returning('id')
      .executeTakeFirstOrThrow();
    const employeeNo = `${code}001`;
    const employee = await db
      .insertInto('core.employees')
      .values({
        ecode: employeeNo,
        company_id: company.id,
        first_name: 'Orphan swipe',
        status: 'active',
        doj: sql<Date>`date '2020-01-01'`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await sql`SELECT att.ensure_swipe_partition(${workDate}::date)`.execute(db);
    await db
      .insertInto('att.swipe_events')
      .values({
        employee_id: employee.id,
        employee_no: employeeNo,
        swipe_ts: sql<Date>`(${workDate}::date + time '09:05') AT TIME ZONE 'Asia/Kolkata'`,
        door_code: `${code}-GATE`,
        received_at: sql<Date>`now()`,
        source: 'kent',
      })
      .execute();

    const rows = await reportR2Swipes(db, { companyId: company.id, month });
    const row = rows.find((candidate) => candidate.ecode === employeeNo);
    expect(row).toMatchObject({
      workDate,
      status: null,
      rawSwipeCount: 1,
      statusVsSwipes: 'missing_day_record',
    });

    const raw = await reportR2RawSwipes(db, { ecode: employeeNo, workDate });
    expect(raw).toHaveLength(1);
    expect(raw[0]?.doorCode).toBe(`${code}-GATE`);
  });

  it('computes historical headcount as-of the snapshot date and uses only approved OT', async () => {
    const snapshotDate = '1910-06-30';
    // Remove only fixtures owned by this test. This keeps repeated local runs
    // deterministic without weakening the production append-only tables.
    await sql`
      DELETE FROM att.overtime_entries overtime
       USING core.employees employee, core.companies company
       WHERE overtime.employee_id = employee.id
         AND employee.company_id = company.id
         AND company.name LIKE 'Historical KPI %'
    `.execute(db);
    await sql`
      DELETE FROM att.day_records day_record
       USING core.employees employee, core.companies company
       WHERE day_record.employee_id = employee.id
         AND employee.company_id = company.id
         AND company.name LIKE 'Historical KPI %'
    `.execute(db);
    await sql`
      DELETE FROM core.employees employee
       USING core.companies company
       WHERE employee.company_id = company.id
         AND company.name LIKE 'Historical KPI %'
    `.execute(db);
    await db.deleteFrom('core.companies').where('name', 'like', 'Historical KPI %').execute();
    const companyCode = `KH${stamp.toString(36).toUpperCase()}`;
    const company = await db
      .insertInto('core.companies')
      .values({
        code: companyCode,
        name: `Historical KPI ${String(stamp)}`,
        ecode_prefix: companyCode,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const employees = await db
      .insertInto('core.employees')
      .values([
        {
          ecode: `${companyCode}001`, company_id: company.id, first_name: 'Historical one',
          category: 'white_collar', status: 'exited', dob: sql<Date>`date '1880-01-01'`,
          doj: sql<Date>`date '1900-01-01'`, dol: sql<Date>`date '1911-01-01'`,
        },
        {
          ecode: `${companyCode}002`, company_id: company.id, first_name: 'Historical two',
          category: 'white_collar', status: 'exited', dob: sql<Date>`date '1890-01-01'`,
          doj: sql<Date>`date '1909-01-01'`, dol: sql<Date>`date '1910-07-01'`,
        },
        {
          ecode: `${companyCode}003`, company_id: company.id, first_name: 'Not joined yet',
          category: 'blue_collar', status: 'exited', dob: sql<Date>`date '1890-01-01'`,
          doj: sql<Date>`date '1911-01-01'`, dol: sql<Date>`date '1912-01-01'`,
        },
      ])
      .returning('id')
      .execute();

    const employeeId = employees[0]?.id;
    if (employeeId === undefined) throw new Error('Historical employee fixture was not created');
    await db.insertInto('att.day_records').values({
      employee_id: employeeId,
      work_date: sql<Date>`date '1910-06-15'`,
      status: 'P',
      source: 'auto',
      worked_minutes: 480,
      ot_minutes: 120,
    }).execute();
    await db.insertInto('att.overtime_entries').values({
      employee_id: employeeId,
      work_date: sql<Date>`date '1910-06-15'`,
      detected_minutes: 120,
      claimed_minutes: 60,
      approved_minutes: 30,
      status: 'approved',
      deadline_at: sql<Date>`timestamp '1910-06-17 00:00:00'`,
    }).execute();

    await buildKpiSnapshot(db, { date: snapshotDate });
    const snapshot = await readKpiSnapshot(db, { date: snapshotDate });
    const metric = (name: string, category = 'total') =>
      snapshot?.metrics.find((row) => row.metric === name && row.category === category)?.value;

    expect(metric('manpower_count')).toBe(2);
    expect(metric('manpower_count', 'white_collar')).toBe(2);
    expect(metric('manpower_count', 'blue_collar')).toBe(0);
    expect(metric('average_age')).toBe(25);
    expect(metric('tenure_years')).toBe(5.5);
    expect(metric('overtime_hours')).toBe(0.5);

    await db.deleteFrom('reporting.kpi_daily')
      .where('snapshot_date', '=', sql<Date>`${snapshotDate}::date`)
      .execute();
  });

  it('applies organisation scope to every business-unit metric and counts approved OT', async () => {
    const today = istDateString();
    const companyCode = `KS${stamp.toString(36).toUpperCase()}`;
    const company = await db
      .insertInto('core.companies')
      .values({ code: companyCode, name: `Scoped KPI ${String(stamp)}`, ecode_prefix: companyCode })
      .returning('id')
      .executeTakeFirstOrThrow();
    const units = await db
      .insertInto('core.org_units')
      .values([
        { company_id: company.id, name: `Allowed ${String(stamp)}` },
        { company_id: company.id, name: `Denied ${String(stamp)}` },
      ])
      .returning('id')
      .execute();
    const allowedUnitId = units[0]?.id;
    const deniedUnitId = units[1]?.id;
    if (allowedUnitId === undefined || deniedUnitId === undefined) {
      throw new Error('Organisation fixtures were not created');
    }
    const employees = await db
      .insertInto('core.employees')
      .values([
        {
          ecode: `${companyCode}A`, company_id: company.id, first_name: 'Allowed',
          category: 'white_collar', status: 'active', org_unit_id: allowedUnitId,
          doj: sql<Date>`date '2020-01-01'`,
        },
        {
          ecode: `${companyCode}B`, company_id: company.id, first_name: 'Denied',
          category: 'blue_collar', status: 'active', org_unit_id: deniedUnitId,
          doj: sql<Date>`date '2020-01-01'`,
        },
      ])
      .returning('id')
      .execute();
    const allowedEmployeeId = employees[0]?.id;
    const deniedEmployeeId = employees[1]?.id;
    if (allowedEmployeeId === undefined || deniedEmployeeId === undefined) {
      throw new Error('Employee fixtures were not created');
    }
    await db.insertInto('att.day_records').values([
      {
        employee_id: allowedEmployeeId, work_date: sql<Date>`${today}::date`, status: 'A',
        source: 'auto', ot_minutes: 600,
      },
      {
        employee_id: deniedEmployeeId, work_date: sql<Date>`${today}::date`, status: 'P',
        source: 'auto', ot_minutes: 600,
      },
    ]).execute();
    await db.insertInto('att.overtime_entries').values([
      {
        employee_id: allowedEmployeeId, work_date: sql<Date>`${today}::date`,
        detected_minutes: 600, claimed_minutes: 120, approved_minutes: 60,
        status: 'approved', deadline_at: sql<Date>`now() + interval '2 days'`,
      },
      {
        employee_id: deniedEmployeeId, work_date: sql<Date>`${today}::date`,
        detected_minutes: 600, claimed_minutes: 600, approved_minutes: 600,
        status: 'approved', deadline_at: sql<Date>`now() + interval '2 days'`,
      },
    ]).execute();

    const result = await businessUnitDashboard(db, {
      scope: {
        all: false,
        own: false,
        subtree: false,
        orgUnitIds: [allowedUnitId],
        actorEmployeeId: null,
      },
    });
    expect(result.headcountTotal).toBe(1);
    expect(result.headcount).toEqual([{ category: 'white_collar', count: 1 }]);
    expect(result.absentToday).toBe(1);
    expect(result.scheduledToday).toBe(1);
    expect(result.absenteeismTodayPct).toBe(100);
    expect(result.otHoursMtd).toBe(1);
  });
});
