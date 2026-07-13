/**
 * LC-03 / R24 — the daily boarding & exit report (PP-6/PP-26: the email HR was
 * refused for a year). Every morning, joins and exits of the previous day go
 * to the configured audience — Plant Head, HR, Business Head, CEO Cell — with
 * an R24-shaped Excel attached, and the send happens EVEN WHEN THE DAY IS
 * EMPTY ("runs without exception"), so a silent day is provably a no-movement
 * day, never a broken job.
 *
 * Recipients are DATA: wf.event_subscriptions rows for 'lifecycle.boarding_exit'.
 */
import ExcelJS from 'exceljs';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { addDaysIso, formatDbDate, istDateString } from '../../core/dates.js';
import { enqueueEvent } from '../notifications/index.js';

export interface BoardingRow {
  ecode: string;
  name: string;
  designation: string | null;
  department: string | null;
  company: string;
  reportingManager: string | null;
  costCenter: string | null;
  location: string | null;
  date: string;
}

export interface ExitRow extends BoardingRow {
  exitReason: string | null;
}

export interface BoardingExitReport {
  from: string;
  to: string;
  joins: BoardingRow[];
  exits: ExitRow[];
}

/** R24 columns: joins (name, ecode, designation, dept, RM, cost center, plant,
 *  DOJ) and exits (+ reason, DOL). */
export async function boardingExitReport(db: Kysely<Database>, fromIso: string, toIso: string): Promise<BoardingExitReport> {
  const base = db
    .selectFrom('core.employees as e')
    .innerJoin('core.companies as c', 'c.id', 'e.company_id')
    .leftJoin('core.designations as dg', 'dg.id', 'e.designation_id')
    .leftJoin('core.departments as dp', 'dp.id', 'e.department_id')
    .leftJoin('core.cost_centers as cc', 'cc.id', 'e.cost_center_id')
    .leftJoin('core.locations as loc', 'loc.id', 'e.location_id')
    .leftJoin('core.employees as rm', 'rm.id', 'e.reporting_manager_id')
    .select([
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'e.exit_reason',
      'e.doj',
      'e.dol',
      'c.code as company',
      'dg.name as designation',
      'dp.name as department',
      'cc.code as cost_center',
      'loc.name as location',
      'rm.first_name as rm_first',
      'rm.last_name as rm_last',
    ]);

  const joins = await base
    .where('e.doj', '>=', sql<Date>`${fromIso}::date`)
    .where('e.doj', '<=', sql<Date>`${toIso}::date`)
    .orderBy('c.code')
    .orderBy('e.ecode')
    .execute();
  const exits = await base
    .where('e.dol', '>=', sql<Date>`${fromIso}::date`)
    .where('e.dol', '<=', sql<Date>`${toIso}::date`)
    .orderBy('c.code')
    .orderBy('e.ecode')
    .execute();

  const name = (first: string, last: string | null): string => (last ? `${first} ${last}` : first);
  const rmName = (first: string | null, last: string | null): string | null => (first ? name(first, last) : null);
  const toBase = (r: (typeof joins)[number]): BoardingRow => ({
    ecode: r.ecode,
    name: name(r.first_name, r.last_name),
    designation: r.designation,
    department: r.department,
    company: r.company,
    reportingManager: rmName(r.rm_first, r.rm_last),
    costCenter: r.cost_center,
    location: r.location,
    date: '',
  });

  return {
    from: fromIso,
    to: toIso,
    joins: joins.map((r) => ({ ...toBase(r), date: formatDbDate(r.doj ?? new Date()) })),
    exits: exits.map((r) => ({ ...toBase(r), date: formatDbDate(r.dol ?? new Date()), exitReason: r.exit_reason })),
  };
}

/** R24-shaped workbook (docs/06): Joins + Exits sheets; explicit "none" rows
 *  so an empty day reads as checked, not missing. */
async function buildBoardingExcel(reportDate: string, joins: BoardingRow[], exits: ExitRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Rashmi HRMS';
  wb.created = new Date();

  const joinSheet = wb.addWorksheet('Joins');
  joinSheet.columns = [
    { header: 'Emp ID', key: 'ecode', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Reporting Manager', key: 'reportingManager', width: 22 },
    { header: 'Cost Center', key: 'costCenter', width: 12 },
    { header: 'Plant / Location', key: 'location', width: 18 },
    { header: 'DOJ', key: 'date', width: 12 },
  ];
  for (const j of joins) {
    joinSheet.addRow({ ...j, designation: j.designation ?? '', department: j.department ?? '', reportingManager: j.reportingManager ?? '', costCenter: j.costCenter ?? '', location: j.location ?? '' });
  }
  if (joins.length === 0) {
    joinSheet.addRow({ ecode: '—', name: 'No joins', date: reportDate });
  }

  const exitSheet = wb.addWorksheet('Exits');
  exitSheet.columns = [
    { header: 'Emp ID', key: 'ecode', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Reporting Manager', key: 'reportingManager', width: 22 },
    { header: 'Cost Center', key: 'costCenter', width: 12 },
    { header: 'Plant / Location', key: 'location', width: 18 },
    { header: 'DOL', key: 'date', width: 12 },
    { header: 'Reason', key: 'exitReason', width: 24 },
  ];
  for (const x of exits) {
    exitSheet.addRow({ ...x, designation: x.designation ?? '', department: x.department ?? '', reportingManager: x.reportingManager ?? '', costCenter: x.costCenter ?? '', location: x.location ?? '', exitReason: x.exitReason ?? '' });
  }
  if (exits.length === 0) {
    exitSheet.addRow({ ecode: '—', name: 'No exits', date: reportDate });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** On-demand R24 workbook for a date range (HR download). */
export async function boardingExitExcel(db: Kysely<Database>, fromIso: string, toIso: string): Promise<Buffer> {
  const report = await boardingExitReport(db, fromIso, toIso);
  return buildBoardingExcel(fromIso, report.joins, report.exits);
}

/** The 07:00 IST job body: yesterday's movement + the Excel to the subscribed
 *  audience — queued unconditionally, empty day included. Returns recipients queued. */
export async function sendBoardingExitEmail(db: Kysely<Database>, dateIso?: string): Promise<number> {
  const date = dateIso ?? addDaysIso(istDateString(), -1);
  const report = await boardingExitReport(db, date, date);
  const excel = await buildBoardingExcel(date, report.joins, report.exits);
  return enqueueEvent(db, 'lifecycle.boarding_exit', 'boarding_exit_daily', {
    date,
    joinCount: report.joins.length,
    exitCount: report.exits.length,
    joins: report.joins,
    exits: report.exits,
    attachment: { fileName: `boarding-exit-${date}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: excel.toString('base64') },
  });
}
