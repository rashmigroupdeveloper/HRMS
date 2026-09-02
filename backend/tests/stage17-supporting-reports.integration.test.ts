/**
 * Stage 1.7 — R2–R6 / R24 / R27 list + Excel (RPT-06: export uses same rows as view).
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database } from '../src/core/db/types.js';
import {
  exportR2Excel,
  exportR3Excel,
  exportR6Excel,
  exportR24Excel,
  exportR4Excel,
  exportR5Excel,
  exportR27Excel,
  reportR2Swipes,
  reportR2RawSwipes,
  reportR3Regularizations,
  reportR4Exceptions,
  reportR5Ot,
  reportR6AbsenceCases,
  reportR24Boarding,
  reportR27Headcount,
} from '../src/modules/reports/index.js';
import { istDateString } from '../src/core/dates.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

async function exportedRowCount(buffer: Buffer): Promise<number> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
  const sheet = workbook.worksheets[0];
  return Math.max(0, (sheet?.actualRowCount ?? 1) - 1);
}

run('Stage 1.7 — supporting reports R2–R6/R24/R27', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  const today = istDateString();
  const month = `${today.slice(0, 7)}-01`;
  let companyId: number;
  let empId: number;
  let empEcode: string;
  let ownerUserId: number;

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    const companyCode = `R${stamp.toString(36).toUpperCase().slice(-8)}`;
    companyId = (
      await db
        .insertInto('core.companies')
        .values({
          code: companyCode,
          name: `S17 Reports ${String(stamp)}`,
          ecode_prefix: companyCode,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    const mappedLocationId = (await db.insertInto('core.locations').values({
      company_id: companyId, name: `Mapped Plant ${String(stamp)}`, state_code: 'WB',
    }).returning('id').executeTakeFirstOrThrow()).id;
    const swipeLocationId = (await db.insertInto('core.locations').values({
      company_id: companyId, name: `Swipe Plant ${String(stamp)}`, state_code: 'WB',
    }).returning('id').executeTakeFirstOrThrow()).id;
    await db.insertInto('att.devices').values({
      door_code: 'S17-GATE-A', source: 'kent', location_id: swipeLocationId,
    }).onConflict((oc) => oc.column('door_code').doUpdateSet({ location_id: swipeLocationId })).execute();

    empEcode = `RML7${String(stamp).slice(-6)}`;
    empId = (
      await db
        .insertInto('core.employees')
        .values({
          ecode: empEcode,
          company_id: companyId,
          first_name: 'Report',
          last_name: 'Fixture',
          status: 'active',
          category: 'white_collar',
          gender: 'Male',
          dob: sql<Date>`date '1990-01-01'`,
          doj: sql<Date>`date '2020-01-01'`,
          location_id: mappedLocationId,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    ownerUserId = (await db.insertInto('core.users').values({
      employee_id: empId,
      email: `reports-${String(stamp)}@test.local`,
      password_hash: 'test-only',
    }).returning('id').executeTakeFirstOrThrow()).id;

    await db
      .insertInto('att.day_records')
      .values({
        employee_id: empId,
        work_date: sql<Date>`${month}::date`,
        status: 'P',
        source: 'auto',
        late_minutes: 12,
        early_exit_minutes: 0,
        ot_minutes: 45,
        worked_minutes: 480,
      })
      .onConflict((oc) =>
        oc.columns(['employee_id', 'work_date']).doUpdateSet({
          status: 'P',
          late_minutes: 12,
          ot_minutes: 45,
        }),
      )
      .execute();

    await db
      .insertInto('att.swipe_events')
      .values({
        employee_id: empId,
        employee_no: empEcode,
        swipe_ts: sql<Date>`(${month}::date + time '09:12') AT TIME ZONE 'Asia/Kolkata'`,
        door_code: 'S17-GATE-A',
        received_at: sql<Date>`now()`,
        source: 'kent',
      })
      .onConflict((oc) => oc.columns(['employee_no', 'swipe_ts', 'door_code']).doNothing())
      .execute();

    await db
      .insertInto('att.overtime_entries')
      .values({
        employee_id: empId,
        work_date: sql<Date>`${month}::date`,
        detected_minutes: 45,
        claimed_minutes: 45,
        approved_minutes: 30,
        status: 'approved',
        manager_id: empId,
        deadline_at: sql<Date>`now() + interval '2 days'`,
        decided_at: sql<Date>`now() + interval '1 hour'`,
      })
      .onConflict((oc) =>
        oc.columns(['employee_id', 'work_date']).doUpdateSet({
          status: 'approved',
          approved_minutes: 30,
        }),
      )
      .execute();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('R2 lists identity + reconciliation fields and Excel matches row count', async () => {
    const rows = await reportR2Swipes(db, { companyId, month });
    const mine = rows.find((r) => r.ecode === empEcode);
    expect(mine).toBeTruthy();
    if (!mine) return;
    expect(mine.employeeName).toContain('Report');
    expect(mine.lateMinutes).toBe(12);
    expect(mine.rawSwipeCount).toBeGreaterThanOrEqual(1);
    expect(mine.firstDoor).toBe('S17-GATE-A');
    expect(mine.crossPlantFlag).toBe(true);
    expect(mine.mappedLocation).toContain('Mapped Plant');
    expect(mine.majoritySwipeLocation).toContain('Swipe Plant');
    expect(['match', 'status_without_swipes', 'swipes_without_presence', 'both_absent']).toContain(
      mine.statusVsSwipes,
    );

    const buf = await exportR2Excel(db, { companyId, month });
    expect(buf.byteLength).toBeGreaterThan(500);
    expect(await exportedRowCount(buf)).toBe(rows.length);
    // xlsx magic: PK zip header
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');

    const raw = await reportR2RawSwipes(db, { ecode: empEcode, workDate: month });
    expect(raw).toHaveLength(1);
    expect(raw[0]?.employeeNo).toBe(empEcode);
    expect(raw[0]?.doorCode).toBe('S17-GATE-A');
  });

  it('R2 assigns a night-shift morning exit only to the owning work date', async () => {
    const nightDate = `${month.slice(0, 8)}02`;
    const nextDate = `${month.slice(0, 8)}03`;
    const firstIn = sql<Date>`(${nightDate}::date + time '22:00') AT TIME ZONE 'Asia/Kolkata'`;
    const lastOut = sql<Date>`(${nextDate}::date + time '06:00') AT TIME ZONE 'Asia/Kolkata'`;
    await db
      .insertInto('att.day_records')
      .values([
        {
          employee_id: empId,
          work_date: sql<Date>`${nightDate}::date`,
          status: 'P',
          source: 'auto',
          first_in: firstIn,
          last_out: lastOut,
          worked_minutes: 480,
        },
        {
          employee_id: empId,
          work_date: sql<Date>`${nextDate}::date`,
          status: 'A',
          source: 'auto',
          worked_minutes: 0,
        },
      ])
      .onConflict((oc) => oc.columns(['employee_id', 'work_date']).doNothing())
      .execute();
    await db
      .insertInto('att.swipe_events')
      .values([
        {
          employee_id: empId,
          employee_no: empEcode,
          swipe_ts: firstIn,
          door_code: 'NIGHT-IN',
          received_at: sql<Date>`now()`,
          source: 'kent',
        },
        {
          employee_id: empId,
          employee_no: empEcode,
          swipe_ts: lastOut,
          door_code: 'NIGHT-OUT',
          received_at: sql<Date>`now()`,
          source: 'kent',
        },
      ])
      .onConflict((oc) => oc.columns(['employee_no', 'swipe_ts', 'door_code']).doNothing())
      .execute();

    const rows = await reportR2Swipes(db, { companyId, month });
    const night = rows.find((row) => row.workDate === nightDate && row.ecode === empEcode);
    const following = rows.find((row) => row.workDate === nextDate && row.ecode === empEcode);
    expect(night?.rawSwipeCount).toBe(2);
    expect(night?.lastDoor).toBe('NIGHT-OUT');
    expect(following?.rawSwipeCount).toBe(0);
  });

  it('R4 late exceptions include the fixture and Excel is non-empty', async () => {
    const rows = await reportR4Exceptions(db, companyId, month);
    expect(rows.some((r) => r.ecode === empEcode && r.lateMinutes === 12)).toBe(true);
    expect(rows.find((r) => r.ecode === empEcode)?.monthlyExceptionCount).toBeGreaterThanOrEqual(1);
    const buf = await exportR4Excel(db, companyId, month);
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(await exportedRowCount(buf)).toBe(rows.length);
  });

  it('R5 OT register has manager + latency and export matches list length shape', async () => {
    const rows = await reportR5Ot(db, companyId, month);
    const mine = rows.find((r) => r.ecode === empEcode);
    expect(mine).toBeTruthy();
    if (!mine) return;
    expect(mine.approvedMinutes).toBe(30);
    expect(mine.managerName).toContain('Report');
    expect(mine.within48h).toBe(true);
    expect(mine.decisionLatencyHours).not.toBeNull();
    expect(mine.managerDecisionCount).toBeGreaterThanOrEqual(1);
    expect(mine.managerAverageLatencyHours).not.toBeNull();
    const buf = await exportR5Excel(db, companyId, month);
    expect(buf.byteLength).toBeGreaterThan(400);
    expect(await exportedRowCount(buf)).toBe(rows.length);
  });

  it('R3 exposes the complete approver notification and action timeline', async () => {
    const request = await db.insertInto('wf.requests').values({
      definition_code: 'regularization',
      subject_employee_id: empId,
      requested_by: ownerUserId,
      payload: { fixture: true },
      status: 'approved',
      current_step: 1,
      decided_at: sql<Date>`now()`,
    }).returning('id').executeTakeFirstOrThrow();
    await db.insertInto('wf.request_steps').values({
      request_id: request.id,
      step_no: 1,
      approver_user_id: ownerUserId,
      action: 'approved',
      notified_at: sql<Date>`now() - interval '1 hour'`,
      acted_at: sql<Date>`now()`,
      sla_due_at: sql<Date>`now() + interval '47 hours'`,
    }).execute();
    await db.insertInto('att.regularizations').values({
      employee_id: empId,
      kind: 'AR',
      from_date: sql<Date>`${month}::date`,
      to_date: sql<Date>`${month}::date`,
      reason: 'Timeline fixture',
      requested_status: 'P',
      workflow_request_id: request.id,
      applied: true,
    }).execute();

    const rows = await reportR3Regularizations(db, { companyId });
    const mine = rows.find((row) => row.id > 0 && row.reason === 'Timeline fixture');
    expect(mine?.timeline).toHaveLength(1);
    expect(mine?.timeline[0]?.approverName).toContain('Report');
    expect(mine?.timeline[0]?.action).toBe('approved');
    expect(mine?.timeline[0]?.notifiedAt).toBeTruthy();
    const exportRows = await exportR3Excel(db, { companyId });
    expect(await exportedRowCount(exportRows)).toBe(rows.length);
  });

  it('R6 exposes the HR owner and an issued-letter content link', async () => {
    const letter = await db.insertInto('core.letters').values({
      employee_id: empId,
      template_code: 'show_cause',
      body_rendered: 'Fixture show-cause body',
      status: 'issued',
      issued_by: ownerUserId,
      issued_at: sql<Date>`now()`,
    }).returning('id').executeTakeFirstOrThrow();
    await db.insertInto('att.absence_cases').values({
      employee_id: empId,
      start_date: sql<Date>`${month}::date`,
      days_absent: 7,
      stage: 'show_cause',
      hr_owner_id: ownerUserId,
      letter_id: letter.id,
    }).execute();
    const rows = await reportR6AbsenceCases(db, { companyId, openOnly: true });
    const mine = rows.find((row) => row.letterId === letter.id);
    expect(mine?.ownerName).toContain('Report');
    expect(mine?.letterStatus).toBe('issued');
    expect(mine?.letterContentPath).toBe(`/api/letters/${String(letter.id)}/content`);
    const exportRows = await exportR6Excel(db, { companyId, openOnly: true });
    expect(await exportedRowCount(exportRows)).toBe(rows.length);
  });

  it('R24 returns and exports an inclusive date range', async () => {
    const exitEcode = `RMLX${String(stamp).slice(-6)}`;
    await db.insertInto('core.employees').values({
      ecode: exitEcode,
      company_id: companyId,
      first_name: 'Range',
      last_name: 'Exit',
      status: 'exited',
      doj: sql<Date>`date '2019-01-01'`,
      dol: sql<Date>`date '2020-01-02'`,
      exit_reason: 'Fixture exit',
    }).execute();
    const report = await reportR24Boarding(db, '2020-01-01', '2020-01-02', companyId);
    expect(report.joins.some((row) => row.ecode === empEcode)).toBe(true);
    expect(report.exits.some((row) => row.ecode === exitEcode)).toBe(true);
    const buf = await exportR24Excel(db, '2020-01-01', '2020-01-02', companyId);
    expect(await exportedRowCount(buf)).toBe(report.joins.length + report.exits.length);
  });

  it('R27 supports point-in-time and monthly trend demographic dimensions', async () => {
    const rows = await reportR27Headcount(db, { companyId, asOf: today });
    expect(rows.some((r) => r.status === 'active' && r.count >= 1)).toBe(true);
    expect(rows.some((r) => r.gender === 'Male' && r.ageBand !== 'Unknown')).toBe(true);
    const trend = await reportR27Headcount(db, {
      companyId,
      fromMonth: month.slice(0, 7),
      toMonth: month.slice(0, 7),
    });
    expect(trend[0]?.snapshotDate.startsWith(month.slice(0, 7))).toBe(true);
    const buf = await exportR27Excel(db, { companyId });
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('report queries enforce subtree scope even when another companyId is supplied', async () => {
    const outsideCompany = await db
      .insertInto('core.companies')
      .values({
        code: `O${stamp.toString(36).toUpperCase().slice(-8)}`,
        name: `Outside ${String(stamp)}`,
        ecode_prefix: `O${stamp.toString(36).toUpperCase().slice(-5)}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const scoped = await reportR27Headcount(db, {
      companyId: outsideCompany.id,
      scope: {
        all: false,
        own: false,
        subtree: true,
        orgUnitIds: [],
        actorEmployeeId: empId,
      },
    });
    expect(scoped).toEqual([]);
  });
});
