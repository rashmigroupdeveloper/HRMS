/**
 * Stage 1.7 — the two required muster guarantees (RPT-01, docs/06 §1), live Postgres:
 *  M1 snapshot == raw: every precomputed muster total equals a from-scratch,
 *     hand-authored aggregation of the same day_records. If buildMusterMonth
 *     ever miscounts, payroll (which trusts this snapshot) would be wrong — so
 *     this is a money-adjacent invariant.
 *  M2 export == view: the R1 Excel is generated from the SAME query as the
 *     on-screen list, so a downloaded workbook can never diverge from what HR
 *     sees. Proven by parsing the .xlsx and matching it row-for-row to listMuster.
 *
 * A dedicated throwaway company isolates the snapshot to the fixture employees.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { sql, type Kysely } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import type { Database, DayStatus } from '../src/core/db/types.js';
import { buildMusterMonth, exportMusterExcel, listMuster } from '../src/modules/reports/index.js';

const DB_URL = process.env['DATABASE_URL'];
const run = describe.skipIf(!DB_URL);

const MONTH = '2035-01';

run('Stage 1.7 — muster snapshot equivalence + export parity (live Postgres)', () => {
  let db: Kysely<Database>;
  const stamp = Date.now();
  let companyId: number;
  let richEmpId: number; // full spread of statuses
  let emptyEmpId: number; // no day_records → all zeros

  async function mkEmployee(suffix: string): Promise<number> {
    const r = await db
      .insertInto('core.employees')
      .values({ ecode: `MUS${String(stamp).slice(-6)}${suffix}`, company_id: companyId, first_name: `Muster ${suffix}`, status: 'active', doj: sql<Date>`'2030-01-01'::date` as unknown as Date })
      .returning('id')
      .executeTakeFirstOrThrow();
    return r.id;
  }

  async function setDay(employeeId: number, iso: string, status: DayStatus, extra?: { otMinutes?: number; weekoffPaid?: boolean; leaveCode?: string }): Promise<void> {
    let leaveTypeId: number | null = null;
    if (extra?.leaveCode) {
      leaveTypeId = (await db.selectFrom('lv.leave_types').select('id').where('code', '=', extra.leaveCode).executeTakeFirstOrThrow()).id;
    }
    await db
      .insertInto('att.day_records')
      .values({
        employee_id: employeeId,
        work_date: sql<Date>`${iso}::date` as unknown as Date,
        status,
        ot_minutes: extra?.otMinutes ?? 0,
        weekoff_paid: extra?.weekoffPaid ?? null,
        leave_type_id: leaveTypeId,
        source: 'auto',
        computed_at: new Date(),
      })
      .execute();
  }

  beforeAll(async () => {
    db = createDatabase(DB_URL ?? '');
    const company = await db
      .insertInto('core.companies')
      .values({ code: `MUS${String(stamp).slice(-6)}`, name: `Muster Test Co ${stamp}`, ecode_prefix: 'MUS' })
      .returning('id')
      .executeTakeFirstOrThrow();
    companyId = company.id;

    richEmpId = await mkEmployee('A');
    emptyEmpId = await mkEmployee('B');

    // Hand-authored spread across Jan 2035 (the expected totals below are computed by hand).
    await setDay(richEmpId, '2035-01-01', 'P', { otMinutes: 120 });
    await setDay(richEmpId, '2035-01-02', 'P', { otMinutes: 60 });
    await setDay(richEmpId, '2035-01-03', 'HD');
    await setDay(richEmpId, '2035-01-04', 'A');
    await setDay(richEmpId, '2035-01-05', 'WO', { weekoffPaid: true });
    await setDay(richEmpId, '2035-01-06', 'WO', { weekoffPaid: false });
    await setDay(richEmpId, '2035-01-07', 'H');
    await setDay(richEmpId, '2035-01-08', 'L', { leaveCode: 'CL' });
    await setDay(richEmpId, '2035-01-09', 'L', { leaveCode: 'LWP' });
    await setDay(richEmpId, '2035-01-10', 'OD');
    await setDay(richEmpId, '2035-01-11', 'CO');
    await setDay(richEmpId, '2035-01-12', 'UAB');
  });

  afterAll(async () => {
    const empIds = [richEmpId, emptyEmpId];
    await db.deleteFrom('reporting.muster_month').where('company_id', '=', companyId).execute();
    for (const id of empIds) {
      await sql`DELETE FROM att.day_records WHERE employee_id = ${id} AND is_locked = false`.execute(db);
    }
    await db.deleteFrom('core.employees').where('id', 'in', empIds).execute();
    await db.deleteFrom('core.companies').where('id', '=', companyId).execute();
    await db.destroy();
  });

  it('M1: every muster total equals a hand-authored aggregation of the raw days', async () => {
    const count = await buildMusterMonth(db, companyId, MONTH);
    expect(count).toBe(2); // both employees appear, even the empty one

    const rows = await listMuster(db, { companyId, month: MONTH });
    const rich = rows.find((r) => r.ecode.endsWith('A'));
    const empty = rows.find((r) => r.ecode.endsWith('B'));
    expect(rich).toBeDefined();
    expect(empty).toBeDefined();

    // Hand-computed from the fixture above (the golden expectation).
    expect(rich).toMatchObject({
      present: 2,
      absent: 1,
      halfDays: 1,
      weekoffs: 2,
      weekoffsUnpaid: 1,
      holidays: 1,
      leaveDays: 2, // CL + LWP, both status 'L'
      odDays: 1,
      coDays: 1,
      uabDays: 1,
      lopDays: 4.5, // A(1)+UAB(1)+WOunpaid(1)+LWP(1)+HD(1)*0.5
      otHours: 3, // (120+60)/60
    });
    // Leave days show under their type code in the per-day map + leaveByType.
    expect(rich?.dayStatuses['08']).toBe('CL');
    expect(rich?.dayStatuses['09']).toBe('LWP');
    expect(rich?.leaveByType).toMatchObject({ CL: 1, LWP: 1 });

    // The employee with no attendance is a full row of zeros, not a missing row.
    expect(empty).toMatchObject({ present: 0, absent: 0, lopDays: 0, otHours: 0 });

    // Independent cross-check: aggregate the raw rows straight from SQL and
    // confirm the snapshot's present/absent/OT match (defends against the
    // hand-count and the service drifting together).
    const rawAgg = await db
      .selectFrom('att.day_records')
      .select(({ fn }) => [
        fn.count<string>(sql`CASE WHEN status = 'P' THEN 1 END`).as('present'), // pg COUNT → string
        fn.count<string>(sql`CASE WHEN status = 'A' THEN 1 END`).as('absent'),
        fn.coalesce(fn.sum('ot_minutes'), sql<string>`0`).as('ot_minutes'),
      ])
      .where('employee_id', '=', richEmpId)
      .where('work_date', '>=', sql<Date>`'2035-01-01'::date`)
      .where('work_date', '<', sql<Date>`'2035-02-01'::date`)
      .executeTakeFirstOrThrow();
    expect(Number(rawAgg.present)).toBe(rich?.present);
    expect(Number(rawAgg.absent)).toBe(rich?.absent);
    expect(Math.round((Number(rawAgg.ot_minutes) / 60) * 100) / 100).toBe(rich?.otHours);
  });

  it('M2: the Excel export matches the on-screen list row-for-row', async () => {
    await buildMusterMonth(db, companyId, MONTH);
    const listed = await listMuster(db, { companyId, month: MONTH });
    const buffer = await exportMusterExcel(db, { companyId, month: MONTH });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Muster');
    expect(ws).toBeDefined();
    if (!ws) return;

    const header = ws.getRow(1);
    const colOf = (name: string): number => {
      for (let c = 1; c <= header.cellCount; c++) {
        if (header.getCell(c).value === name) return c;
      }
      throw new Error(`column not found: ${name}`);
    };
    const cEcode = colOf('Emp ID');
    const cPresent = colOf('P');
    const cAbsent = colOf('A');
    const cLop = colOf('LOP');

    const exported = new Map<string, { present: number; absent: number; lop: number }>();
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const ecode = row.getCell(cEcode).text;
      if (!ecode) continue;
      exported.set(ecode, {
        present: Number(row.getCell(cPresent).value ?? 0),
        absent: Number(row.getCell(cAbsent).value ?? 0),
        lop: Number(row.getCell(cLop).value ?? 0),
      });
    }

    // Same population, same numbers — the download IS the view.
    expect(exported.size).toBe(listed.length);
    for (const row of listed) {
      const x = exported.get(row.ecode);
      expect(x).toBeDefined();
      expect(x?.present).toBe(row.present);
      expect(x?.absent).toBe(row.absent);
      expect(x?.lop).toBe(row.lopDays);
    }
  });
});
