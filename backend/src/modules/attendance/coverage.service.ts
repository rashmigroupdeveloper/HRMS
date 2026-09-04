/**
 * Coverage / shortfall (SHF-06) and weekly/quarterly hours meters (SHF-03).
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate } from '../../core/dates.js';
import { getTypedSetting } from '../../core/settings/read.js';
import { mondayOf, plannedMinutes, quarterKey, type ShiftTiming } from './shift-windows.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface CoverageCell {
  date: string;
  shiftCode: string;
  sanctioned: number;
  rostered: number;
  onLeave: number;
  remaining: number;
  shortfall: number;
}

export async function coverageView(
  db: Db,
  params: { employeeIds: number[]; from: string; to: string },
): Promise<CoverageCell[]> {
  if (params.employeeIds.length === 0) return [];
  const minHeadcount = await getTypedSetting(db, 'att.coverage_min_headcount', 'number', 1);

  const roster = await db
    .selectFrom('att.rosters as r')
    .innerJoin('att.shifts as s', 's.id', 'r.shift_id')
    .innerJoin('core.employees as e', 'e.id', 'r.employee_id')
    .select(['r.employee_id', 'r.work_date', 's.code as shift_code', 's.id as shift_id', 'e.location_id', 'e.department_id'])
    .where('r.employee_id', 'in', params.employeeIds)
    .where('r.is_week_off', '=', false)
    .where('r.work_date', '>=', sql<Date>`${params.from}::date`)
    .where('r.work_date', '<=', sql<Date>`${params.to}::date`)
    .execute();

  const leave = await db
    .selectFrom('lv.applications')
    .select(['employee_id', 'from_date', 'to_date'])
    .where('employee_id', 'in', params.employeeIds)
    .where('status', 'in', ['pending', 'approved'])
    .where('from_date', '<=', sql<Date>`${params.to}::date`)
    .where('to_date', '>=', sql<Date>`${params.from}::date`)
    .execute();

  const onLeave = new Set<string>();
  for (const row of leave) {
    const from = formatDbDate(row.from_date);
    const to = formatDbDate(row.to_date);
    for (const r of roster) {
      const iso = formatDbDate(r.work_date);
      if (r.employee_id === row.employee_id && from <= iso && iso <= to) {
        onLeave.add(`${String(r.employee_id)}|${iso}`);
      }
    }
  }

  const targets = await db.selectFrom('att.coverage_targets').selectAll().execute();
  const targetOf = (locationId: number | null, departmentId: number | null, shiftId: number, weekday: number): number => {
    const exact = targets.find(
      (t) =>
        t.location_id === locationId &&
        t.shift_id === shiftId &&
        t.weekday === weekday &&
        t.department_id === departmentId,
    );
    if (exact) return exact.sanctioned;
    const loc = targets.find(
      (t) =>
        t.location_id === locationId &&
        t.shift_id === shiftId &&
        t.weekday === weekday &&
        t.department_id === null,
    );
    return loc?.sanctioned ?? minHeadcount;
  };

  const buckets = new Map<string, CoverageCell & { shiftId: number; locationId: number | null; departmentId: number | null }>();
  for (const row of roster) {
    const iso = formatDbDate(row.work_date);
    const key = `${iso}|${row.shift_code}`;
    const bucket = buckets.get(key) ?? {
      date: iso,
      shiftCode: row.shift_code,
      shiftId: row.shift_id,
      locationId: row.location_id,
      departmentId: row.department_id,
      sanctioned: 0,
      rostered: 0,
      onLeave: 0,
      remaining: 0,
      shortfall: 0,
    };
    bucket.rostered += 1;
    if (onLeave.has(`${String(row.employee_id)}|${iso}`)) bucket.onLeave += 1;
    buckets.set(key, bucket);
  }

  const cells: CoverageCell[] = [];
  for (const bucket of buckets.values()) {
    const weekday = new Date(`${bucket.date}T00:00:00Z`).getUTCDay();
    bucket.sanctioned = targetOf(bucket.locationId, bucket.departmentId, bucket.shiftId, weekday);
    bucket.remaining = Math.max(0, bucket.rostered - bucket.onLeave);
    bucket.shortfall = Math.max(0, bucket.sanctioned - bucket.remaining);
    cells.push({
      date: bucket.date,
      shiftCode: bucket.shiftCode,
      sanctioned: bucket.sanctioned,
      rostered: bucket.rostered,
      onLeave: bucket.onLeave,
      remaining: bucket.remaining,
      shortfall: bucket.shortfall,
    });
  }
  return cells.sort((a, b) => a.date.localeCompare(b.date) || a.shiftCode.localeCompare(b.shiftCode));
}

export interface HoursMeter {
  employeeId: number;
  weekHours: number;
  weekCap: number;
  quarterHours: number;
  quarterCap: number;
}

export async function rosterMeters(
  db: Db,
  params: { employeeIds: number[]; month: string },
): Promise<HoursMeter[]> {
  if (params.employeeIds.length === 0) return [];
  const weekCap = await getTypedSetting(db, 'att.weekly_hours_cap', 'number', 48);
  const quarterCap = await getTypedSetting(db, 'att.quarterly_hours_cap', 'number', 624);
  const monthStart = params.month.length === 7 ? `${params.month}-01` : params.month;
  const [y = 0, mo = 1] = monthStart.split('-').map(Number);
  const monthEnd = `${y}-${String(mo).padStart(2, '0')}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}`;
  const from = mondayOf(monthStart);
  const qStart = String(Math.floor((mo - 1) / 3) * 3 + 1).padStart(2, '0');
  const rangeFrom = from < `${y}-${qStart}-01` ? from : `${y}-${qStart}-01`;

  const rows = await db
    .selectFrom('att.rosters as r')
    .innerJoin('att.shifts as s', 's.id', 'r.shift_id')
    .select([
      'r.employee_id',
      'r.work_date',
      's.code',
      's.start_time',
      's.end_time',
      's.crosses_midnight',
      's.break_minutes',
      's.break_paid',
      's.session2_start',
      's.session2_end',
    ])
    .where('r.employee_id', 'in', params.employeeIds)
    .where('r.is_week_off', '=', false)
    .where('r.work_date', '>=', sql<Date>`${rangeFrom}::date`)
    .where('r.work_date', '<=', sql<Date>`${monthEnd}::date`)
    .execute();

  const todayWeek = mondayOf(monthEnd);
  const todayQ = quarterKey(monthEnd);
  const byEmp = new Map<number, HoursMeter>();
  for (const id of params.employeeIds) {
    byEmp.set(id, { employeeId: id, weekHours: 0, weekCap, quarterHours: 0, quarterCap });
  }
  for (const row of rows) {
    const iso = formatDbDate(row.work_date);
    const timing: ShiftTiming = {
      code: row.code,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
      crossesMidnight: row.crosses_midnight,
      breakMinutes: row.break_minutes,
      breakPaid: row.break_paid,
      session2Start: row.session2_start?.slice(0, 5) ?? null,
      session2End: row.session2_end?.slice(0, 5) ?? null,
    };
    const hours = plannedMinutes(timing) / 60;
    const meter = byEmp.get(row.employee_id);
    if (!meter) continue;
    if (mondayOf(iso) === todayWeek) meter.weekHours += hours;
    if (quarterKey(iso) === todayQ) meter.quarterHours += hours;
  }
  return [...byEmp.values()];
}
