/**
 * R1 Attendance Muster Summary (RPT-01, docs/06 §1).
 * Build snapshot into reporting.muster_month; list + Excel export read the snapshot.
 */
import ExcelJS from 'exceljs';
import { sql, type Insertable, type Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate } from '../../core/dates.js';
import { monthStart, nextMonthStart } from '../attendance/index.js';

function fullName(first: string, last: string | null): string {
  return last ? `${first} ${last}` : first;
}

export interface MusterFilters {
  companyId: number;
  month: string; // YYYY-MM or YYYY-MM-01
}

export interface MusterRow {
  ecode: string;
  employeeName: string;
  reportingManager: string | null;
  functionalManager: string | null;
  department: string | null;
  designation: string | null;
  orgUnit: string | null;
  costCenter: string | null;
  contact: string | null;
  category: string | null;
  dayStatuses: Record<string, string>;
  leaveByType: Record<string, number>;
  present: number;
  absent: number;
  halfDays: number;
  weekoffs: number;
  weekoffsUnpaid: number;
  holidays: number;
  leaveDays: number;
  odDays: number;
  coDays: number;
  uabDays: number;
  lopDays: number;
  otHours: number;
}

/** Rebuild muster snapshot for company×month from day_records + master. */
export async function buildMusterMonth(
  db: Kysely<Database>,
  companyId: number,
  month: string,
): Promise<number> {
  const m = monthStart(month);
  const mEnd = nextMonthStart(m);

  const employees = await db
    .selectFrom('core.employees as e')
    .leftJoin('core.designations as d', 'd.id', 'e.designation_id')
    .leftJoin('core.departments as dep', 'dep.id', 'e.department_id')
    .leftJoin('core.org_units as ou', 'ou.id', 'e.org_unit_id')
    .leftJoin('core.cost_centers as cc', 'cc.id', 'e.cost_center_id')
    .leftJoin('core.locations as loc', 'loc.id', 'e.location_id')
    .leftJoin('core.employees as rm', 'rm.id', 'e.reporting_manager_id')
    .leftJoin('core.employees as fm', 'fm.id', 'e.functional_manager_id')
    .where('e.company_id', '=', companyId)
    .where((eb) =>
      eb.and([
        eb('e.status', 'in', ['active', 'on_notice', 'exited']),
        eb.or([eb('e.doj', 'is', null), eb('e.doj', '<', sql<Date>`${mEnd}::date`)]),
        eb.or([eb('e.dol', 'is', null), eb('e.dol', '>=', sql<Date>`${m}::date`)]),
      ]),
    )
    .select([
      'e.id',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      'e.mobile',
      'e.category',
      'd.name as designation',
      'dep.name as department',
      'ou.name as org_unit',
      'cc.code as cost_center',
      'loc.name as location',
      'rm.first_name as rm_first',
      'rm.last_name as rm_last',
      'fm.first_name as fm_first',
      'fm.last_name as fm_last',
    ])
    .execute();

  const employeeIds = employees.map((employee) => employee.id);
  const days = employeeIds.length === 0
    ? []
    : await db
        .selectFrom('att.day_records as dr')
        .leftJoin('lv.leave_types as lt', 'lt.id', 'dr.leave_type_id')
        .select([
          'dr.employee_id',
          'dr.work_date',
          'dr.status',
          'dr.ot_minutes',
          'dr.weekoff_paid',
          'lt.code as leave_code',
        ])
        .where('dr.employee_id', 'in', employeeIds)
        .where('dr.work_date', '>=', sql<Date>`${m}::date`)
        .where('dr.work_date', '<', sql<Date>`${mEnd}::date`)
        .execute();

  const daysByEmployee = new Map<number, typeof days>();
  for (const day of days) {
    const employeeDays = daysByEmployee.get(day.employee_id) ?? [];
    employeeDays.push(day);
    daysByEmployee.set(day.employee_id, employeeDays);
  }

  const values: Insertable<Database['reporting.muster_month']>[] = [];
  for (const emp of employees) {
    const employeeDays = daysByEmployee.get(emp.id) ?? [];

    const dayStatuses: Record<string, string> = {};
    let present = 0;
    let absent = 0;
    let halfDays = 0;
    let weekoffs = 0;
    let weekoffsUnpaid = 0;
    let holidays = 0;
    let leaveDays = 0;
    let lwpDays = 0;
    let odDays = 0;
    let coDays = 0;
    let uabDays = 0;
    let otMinutes = 0;

    for (const d of employeeDays) {
      const dd = formatDbDate(d.work_date).slice(8, 10);
      const st = d.status;
      dayStatuses[dd] = st === 'L' && d.leave_code ? d.leave_code : st;
      otMinutes += d.ot_minutes;
      switch (st) {
        case 'P':
          present += 1;
          break;
        case 'A':
          absent += 1;
          break;
        case 'HD':
          halfDays += 1;
          break;
        case 'WO':
          weekoffs += 1;
          if (d.weekoff_paid === false) weekoffsUnpaid += 1;
          break;
        case 'H':
          holidays += 1;
          break;
        case 'L':
          leaveDays += 1;
          if (d.leave_code === 'LWP') lwpDays += 1;
          break;
        case 'OD':
          odDays += 1;
          break;
        case 'CO':
          coDays += 1;
          break;
        case 'UAB':
          uabDays += 1;
          break;
        default:
          break;
      }
    }

    const lopDays = absent + uabDays + weekoffsUnpaid + lwpDays + halfDays * 0.5;

    values.push({
        company_id: companyId,
        month: sql<Date>`${m}::date` as unknown as Date,
        employee_id: emp.id,
        ecode: emp.ecode,
        employee_name: fullName(emp.first_name, emp.last_name),
        reporting_manager: emp.rm_first ? fullName(emp.rm_first, emp.rm_last) : null,
        functional_manager: emp.fm_first ? fullName(emp.fm_first, emp.fm_last) : null,
        department: emp.department,
        designation: emp.designation,
        org_unit: emp.org_unit,
        cost_center: [emp.cost_center, emp.location].filter(Boolean).join(' / ') || null,
        contact: emp.mobile,
        category: emp.category,
        day_statuses: JSON.stringify(dayStatuses),
        present,
        absent,
        half_days: halfDays,
        weekoffs,
        weekoffs_unpaid: weekoffsUnpaid,
        holidays,
        leave_days: String(leaveDays),
        od_days: odDays,
        co_days: coDays,
        uab_days: uabDays,
        lop_days: String(lopDays),
        ot_hours: String(Math.round((otMinutes / 60) * 100) / 100),
      });
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('reporting.muster_month')
      .where('company_id', '=', companyId)
      .where('month', '=', sql<Date>`${m}::date`)
      .execute();

    const batchSize = 500;
    for (let offset = 0; offset < values.length; offset += batchSize) {
      await trx
        .insertInto('reporting.muster_month')
        .values(values.slice(offset, offset + batchSize))
        .execute();
    }
  });
  return values.length;
}

export async function listMuster(
  db: Kysely<Database>,
  filters: MusterFilters,
): Promise<MusterRow[]> {
  const m = monthStart(filters.month);
  const rows = await db
    .selectFrom('reporting.muster_month')
    .selectAll()
    .where('company_id', '=', filters.companyId)
    .where('month', '=', sql<Date>`${m}::date`)
    .orderBy('ecode')
    .execute();

  return rows.map((r) => {
    const dayStatuses: Record<string, string> =
      typeof r.day_statuses === 'string'
        ? (JSON.parse(r.day_statuses) as Record<string, string>)
        : (r.day_statuses as Record<string, string>);
    const leaveByType: Record<string, number> = {};
    const attendanceCodes = new Set(['P', 'A', 'HD', 'WO', 'H', 'OD', 'CO', 'UAB']);
    for (const status of Object.values(dayStatuses)) {
      if (!attendanceCodes.has(status)) {
        leaveByType[status] = (leaveByType[status] ?? 0) + 1;
      }
    }
    return {
      ecode: r.ecode,
      employeeName: r.employee_name,
      reportingManager: r.reporting_manager,
      functionalManager: r.functional_manager,
      department: r.department,
      designation: r.designation,
      orgUnit: r.org_unit,
      costCenter: r.cost_center,
      contact: r.contact,
      category: r.category,
      dayStatuses,
      leaveByType,
      present: r.present,
      absent: r.absent,
      halfDays: r.half_days,
      weekoffs: r.weekoffs,
      weekoffsUnpaid: r.weekoffs_unpaid,
      holidays: r.holidays,
      leaveDays: Number(r.leave_days),
      odDays: r.od_days,
      coDays: r.co_days,
      uabDays: r.uab_days,
      lopDays: Number(r.lop_days),
      otHours: Number(r.ot_hours),
    };
  });
}

export async function exportMusterExcel(
  db: Kysely<Database>,
  filters: MusterFilters,
): Promise<Buffer> {
  const rows = await listMuster(db, filters);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Muster');
  ws.columns = [
    { header: 'Emp ID', key: 'ecode', width: 12 },
    { header: 'Employee Name', key: 'employeeName', width: 22 },
    { header: 'Reporting Manager', key: 'reportingManager', width: 20 },
    { header: 'Functional Manager', key: 'functionalManager', width: 20 },
    { header: 'Department', key: 'department', width: 16 },
    { header: 'Designation', key: 'designation', width: 18 },
    { header: 'Org Unit', key: 'orgUnit', width: 16 },
    { header: 'Cost Center / Plant', key: 'costCenter', width: 20 },
    { header: 'Contact', key: 'contact', width: 14 },
    { header: 'Category', key: 'category', width: 12 },
    ...Array.from({ length: 31 }, (_, index) => ({
      header: `Day ${String(index + 1)}`,
      key: `day${String(index + 1).padStart(2, '0')}`,
      width: 7,
    })),
    { header: 'P', key: 'present', width: 6 },
    { header: 'A', key: 'absent', width: 6 },
    { header: 'HD', key: 'halfDays', width: 6 },
    { header: 'WO', key: 'weekoffs', width: 6 },
    { header: 'WO unpaid', key: 'weekoffsUnpaid', width: 10 },
    { header: 'H', key: 'holidays', width: 6 },
    { header: 'L', key: 'leaveDays', width: 6 },
    { header: 'OD', key: 'odDays', width: 6 },
    { header: 'CO', key: 'coDays', width: 6 },
    { header: 'UAB', key: 'uabDays', width: 6 },
    { header: 'LOP', key: 'lopDays', width: 8 },
    { header: 'OT hrs', key: 'otHours', width: 8 },
    ...[...new Set(rows.flatMap((row) => Object.keys(row.leaveByType)))].sort().map((code) => ({
      header: `${code} days`,
      key: `leave_${code}`,
      width: 10,
    })),
  ];
  for (const r of rows) {
    ws.addRow({
      ecode: r.ecode,
      employeeName: r.employeeName,
      reportingManager: r.reportingManager ?? '',
      functionalManager: r.functionalManager ?? '',
      department: r.department ?? '',
      designation: r.designation ?? '',
      orgUnit: r.orgUnit ?? '',
      costCenter: r.costCenter ?? '',
      contact: r.contact ?? '',
      category: r.category ?? '',
      ...Object.fromEntries(
        Array.from({ length: 31 }, (_, index) => {
          const day = String(index + 1).padStart(2, '0');
          return [`day${day}`, r.dayStatuses[day] ?? ''];
        }),
      ),
      present: r.present,
      absent: r.absent,
      halfDays: r.halfDays,
      weekoffs: r.weekoffs,
      weekoffsUnpaid: r.weekoffsUnpaid,
      holidays: r.holidays,
      leaveDays: r.leaveDays,
      odDays: r.odDays,
      coDays: r.coDays,
      uabDays: r.uabDays,
      lopDays: r.lopDays,
      otHours: r.otHours,
      ...Object.fromEntries(
        Object.entries(r.leaveByType).map(([code, days]) => [`leave_${code}`, days]),
      ),
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
