/**
 * SHF-08 leave-planner coverage — lives in leave so apply/preview do not import
 * the attendance barrel (overtime already imports leave; the reverse is a cycle).
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { formatDbDate, formatDisplayDate } from '../../core/dates.js';
import { getTypedSetting } from '../../core/settings/read.js';

type Db = Kysely<Database> | Transaction<Database>;

interface CoverageCell {
  date: string;
  shiftCode: string;
  sanctioned: number;
  remaining: number;
  shortfall: number;
}

export interface LeaveCoverageImpact {
  blocked: boolean;
  warnings: string[];
}

export interface LeaveSpanHalves {
  employeeId: number;
  from: string;
  to: string;
  fromHalf?: boolean;
  toHalf?: boolean;
}

/** 0.5 on a half-day edge, 1 on a full day inside the span, else 0. */
export function leaveWeightOnDate(iso: string, span: Omit<LeaveSpanHalves, 'employeeId'>): number {
  if (iso < span.from || iso > span.to) return 0;
  const half = (iso === span.from && Boolean(span.fromHalf)) || (iso === span.to && Boolean(span.toHalf));
  return half ? 0.5 : 1;
}

export function formatHeadcount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatCoverageWarning(args: {
  shiftCode: string;
  date: string;
  remaining: number;
  sanctioned: number;
  shortfall: number;
  blocked: boolean;
}): string {
  const when = formatDisplayDate(args.date);
  const head = `${args.shiftCode} on ${when} would leave ${formatHeadcount(args.remaining)} against the sanctioned ${formatHeadcount(args.sanctioned)} (shortfall ${formatHeadcount(args.shortfall)}).`;
  return args.blocked ? `${head} Coverage policy is blocking this request.` : `${head} Your manager can still approve.`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function addWeight(weights: Map<string, number>, key: string, amount: number): void {
  if (amount <= 0) return;
  weights.set(key, Math.min(1, (weights.get(key) ?? 0) + amount));
}

async function teamCoverage(
  db: Db,
  params: {
    employeeIds: number[];
    from: string;
    to: string;
    /** Leave not yet in `lv.applications` — apply/preview evaluate before insert. */
    proposed: LeaveSpanHalves;
  },
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
    .select(['employee_id', 'from_date', 'to_date', 'from_half', 'to_half'])
    .where('employee_id', 'in', params.employeeIds)
    .where('status', 'in', ['pending', 'approved'])
    .where('from_date', '<=', sql<Date>`${params.to}::date`)
    .where('to_date', '>=', sql<Date>`${params.from}::date`)
    .execute();

  const onLeave = new Map<string, number>();
  for (const row of leave) {
    const span = {
      from: formatDbDate(row.from_date),
      to: formatDbDate(row.to_date),
      fromHalf: row.from_half,
      toHalf: row.to_half,
    };
    for (const r of roster) {
      if (r.employee_id !== row.employee_id) continue;
      const iso = formatDbDate(r.work_date);
      addWeight(onLeave, `${String(r.employee_id)}|${iso}`, leaveWeightOnDate(iso, span));
    }
  }
  for (const r of roster) {
    if (r.employee_id !== params.proposed.employeeId) continue;
    const iso = formatDbDate(r.work_date);
    addWeight(onLeave, `${String(r.employee_id)}|${iso}`, leaveWeightOnDate(iso, params.proposed));
  }

  const applicantCells = new Set<string>();
  for (const r of roster) {
    if (r.employee_id !== params.proposed.employeeId) continue;
    const iso = formatDbDate(r.work_date);
    if (leaveWeightOnDate(iso, params.proposed) <= 0) continue;
    applicantCells.add(`${iso}|${r.shift_code}`);
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

  const buckets = new Map<
    string,
    CoverageCell & { shiftId: number; locationId: number | null; departmentId: number | null; rostered: number; onLeave: number }
  >();
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
      remaining: 0,
      shortfall: 0,
      rostered: 0,
      onLeave: 0,
    };
    bucket.rostered += 1;
    bucket.onLeave += onLeave.get(`${String(row.employee_id)}|${iso}`) ?? 0;
    buckets.set(key, bucket);
  }

  const cells: CoverageCell[] = [];
  for (const bucket of buckets.values()) {
    if (!applicantCells.has(`${bucket.date}|${bucket.shiftCode}`)) continue;
    const weekday = new Date(`${bucket.date}T00:00:00Z`).getUTCDay();
    bucket.sanctioned = targetOf(bucket.locationId, bucket.departmentId, bucket.shiftId, weekday);
    bucket.remaining = Math.max(0, round1(bucket.rostered - bucket.onLeave));
    bucket.shortfall = Math.max(0, round1(bucket.sanctioned - bucket.remaining));
    cells.push({
      date: bucket.date,
      shiftCode: bucket.shiftCode,
      sanctioned: bucket.sanctioned,
      remaining: bucket.remaining,
      shortfall: bucket.shortfall,
    });
  }
  return cells.sort((a, b) => a.date.localeCompare(b.date) || a.shiftCode.localeCompare(b.shiftCode));
}

export async function evaluateLeaveCoverage(
  db: Db,
  params: { employeeId: number; from: string; to: string; fromHalf?: boolean; toHalf?: boolean },
): Promise<LeaveCoverageImpact> {
  const employee = await db
    .selectFrom('core.employees')
    .select(['id', 'reporting_manager_id'])
    .where('id', '=', params.employeeId)
    .executeTakeFirst();
  if (!employee?.reporting_manager_id) return { blocked: false, warnings: [] };

  const team = await db
    .selectFrom('core.employees')
    .select('id')
    .where('reporting_manager_id', '=', employee.reporting_manager_id)
    .where('status', 'in', ['active', 'on_notice'])
    .execute();
  const cells = await teamCoverage(db, {
    employeeIds: team.map((t) => t.id),
    from: params.from,
    to: params.to,
    proposed: {
      employeeId: params.employeeId,
      from: params.from,
      to: params.to,
      fromHalf: params.fromHalf,
      toHalf: params.toHalf,
    },
  });

  const hard = await getTypedSetting(db, 'att.leave_coverage_hard_block', 'boolean', false);
  const warnings: string[] = [];
  for (const cell of cells) {
    if (cell.shortfall <= 0) continue;
    warnings.push(
      formatCoverageWarning({
        shiftCode: cell.shiftCode,
        date: cell.date,
        remaining: cell.remaining,
        sanctioned: cell.sanctioned,
        shortfall: cell.shortfall,
        blocked: hard,
      }),
    );
  }
  return { blocked: hard && warnings.length > 0, warnings };
}
