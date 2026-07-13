/**
 * Daily boarding & exit report email (LC-03, PP-6/26, docs/06 R24).
 * Runs at 07:00 IST; sends EVEN WHEN EMPTY so silence never means success.
 * Recipients = wf.event_subscriptions('daily.boarding_report') — data, not code.
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
  reportingManager: string | null;
  costCenter: string | null;
  location: string | null;
  doj: string | null;
  dol: string | null;
  exitReason: string | null;
  kind: 'join' | 'exit';
}

export interface BoardingReportResult {
  reportDate: string;
  joins: BoardingRow[];
  exits: BoardingRow[];
  notificationsQueued: number;
  excelBase64: string;
}

function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first;
}

/** Query joins (DOJ = reportDate) and exits (DOL = reportDate). */
export async function loadBoardingExitRows(
  db: Kysely<Database>,
  reportDate: string,
  companyId?: number,
): Promise<{ joins: BoardingRow[]; exits: BoardingRow[] }> {
  let joinsQuery = db
    .selectFrom('core.employees as e')
    .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
    .leftJoin('core.departments as dep', 'dep.id', 'e.department_id')
    .leftJoin('core.cost_centers as cc', 'cc.id', 'e.cost_center_id')
    .leftJoin('core.locations as loc', 'loc.id', 'e.location_id')
    .leftJoin('core.employees as rm', 'rm.id', 'e.reporting_manager_id')
    .where('e.doj', '=', sql<Date>`${reportDate}::date`)
    .where('e.status', 'in', ['active', 'onboarding', 'on_notice']);
  if (companyId !== undefined) joinsQuery = joinsQuery.where('e.company_id', '=', companyId);
  const joinsRaw = await joinsQuery
    .select([
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'd.name as designation',
      'dep.name as department',
      'cc.code as cost_center',
      'loc.name as location',
      'rm.first_name as rm_first',
      'rm.last_name as rm_last',
      'e.doj',
    ])
    .execute();

  let exitsQuery = db
    .selectFrom('core.employees as e')
    .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
    .leftJoin('core.departments as dep', 'dep.id', 'e.department_id')
    .leftJoin('core.cost_centers as cc', 'cc.id', 'e.cost_center_id')
    .leftJoin('core.locations as loc', 'loc.id', 'e.location_id')
    .leftJoin('core.employees as rm', 'rm.id', 'e.reporting_manager_id')
    .where('e.dol', '=', sql<Date>`${reportDate}::date`);
  if (companyId !== undefined) exitsQuery = exitsQuery.where('e.company_id', '=', companyId);
  const exitsRaw = await exitsQuery
    .select([
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'd.name as designation',
      'dep.name as department',
      'cc.code as cost_center',
      'loc.name as location',
      'rm.first_name as rm_first',
      'rm.last_name as rm_last',
      'e.dol',
      'e.exit_reason',
    ])
    .execute();

  const joins: BoardingRow[] = joinsRaw.map((r) => ({
    ecode: r.ecode,
    name: fullName(r.first_name, r.last_name),
    designation: r.designation,
    department: r.department,
    reportingManager: r.rm_first ? fullName(r.rm_first, r.rm_last) : null,
    costCenter: r.cost_center,
    location: r.location,
    doj: r.doj ? formatDbDate(r.doj) : reportDate,
    dol: null,
    exitReason: null,
    kind: 'join',
  }));

  const exits: BoardingRow[] = exitsRaw.map((r) => ({
    ecode: r.ecode,
    name: fullName(r.first_name, r.last_name),
    designation: r.designation,
    department: r.department,
    reportingManager: r.rm_first ? fullName(r.rm_first, r.rm_last) : null,
    costCenter: r.cost_center,
    location: r.location,
    doj: null,
    dol: r.dol ? formatDbDate(r.dol) : reportDate,
    exitReason: r.exit_reason,
    kind: 'exit',
  }));

  return { joins, exits };
}

/** Build R24-shaped workbook (docs/06). */
export async function buildBoardingExcel(
  reportDate: string,
  joins: BoardingRow[],
  exits: BoardingRow[],
): Promise<Buffer> {
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
    { header: 'DOJ', key: 'doj', width: 12 },
  ];
  for (const j of joins) {
    joinSheet.addRow({
      ecode: j.ecode,
      name: j.name,
      designation: j.designation ?? '',
      department: j.department ?? '',
      reportingManager: j.reportingManager ?? '',
      costCenter: j.costCenter ?? '',
      location: j.location ?? '',
      doj: j.doj ?? '',
    });
  }
  if (joins.length === 0) {
    joinSheet.addRow({ ecode: '—', name: 'No joins', designation: '', department: '', reportingManager: '', costCenter: '', location: '', doj: reportDate });
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
    { header: 'DOL', key: 'dol', width: 12 },
    { header: 'Reason', key: 'exitReason', width: 24 },
  ];
  for (const x of exits) {
    exitSheet.addRow({
      ecode: x.ecode,
      name: x.name,
      designation: x.designation ?? '',
      department: x.department ?? '',
      reportingManager: x.reportingManager ?? '',
      costCenter: x.costCenter ?? '',
      location: x.location ?? '',
      dol: x.dol ?? '',
      exitReason: x.exitReason ?? '',
    });
  }
  if (exits.length === 0) {
    exitSheet.addRow({
      ecode: '—',
      name: 'No exits',
      designation: '',
      department: '',
      reportingManager: '',
      costCenter: '',
      location: '',
      dol: reportDate,
      exitReason: '',
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Run the daily report for `reportDate` (defaults to yesterday IST).
 * Always fans out notifications — empty day still says "no changes".
 */
export async function runDailyBoardingExitReport(
  db: Kysely<Database>,
  reportDate?: string,
): Promise<BoardingReportResult> {
  const today = istDateString();
  const date = reportDate ?? addDaysIso(today, -1);
  const { joins, exits } = await loadBoardingExitRows(db, date);
  const excel = await buildBoardingExcel(date, joins, exits);
  const excelBase64 = excel.toString('base64');

  const empty = joins.length === 0 && exits.length === 0;
  const queued = await enqueueEvent(db, 'daily.boarding_report', 'daily_boarding_exit', {
    reportDate: date,
    joinCount: joins.length,
    exitCount: exits.length,
    empty,
    message: empty
      ? `Boarding/exit report ${date}: no changes`
      : `Boarding/exit report ${date}: ${String(joins.length)} join(s), ${String(exits.length)} exit(s)`,
    // Excel attachment as base64 in payload — SMTP transport can attach later
    excelFilename: `boarding-exit-${date}.xlsx`,
    excelBase64,
  });

  return {
    reportDate: date,
    joins,
    exits,
    notificationsQueued: queued,
    excelBase64,
  };
}
