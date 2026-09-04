/**
 * Roster save guards (SHF-02/03/05) — overlap, hours caps, rest, post-publish
 * revision. Policy numbers come from core.settings. Refusals name the rule.
 */
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import {
  addDaysIso,
  formatDbDate,
} from '../../core/dates.js';
import { getTypedSetting } from '../../core/settings/read.js';
import {
  anyIntervalsOverlap,
  mondayOf,
  plannedMinutes,
  quarterEnd,
  quarterKey,
  quarterStart,
  restHoursBetween,
  RosterRuleError,
  shiftIntervals,
  type ShiftTiming,
} from './shift-windows.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface RosterGuardEntry {
  employeeId: number;
  date: string;
  shiftId: number | null;
  weekOff: boolean;
}

interface TimingRow {
  id: number;
  code: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  break_minutes: number;
  break_paid: boolean;
  session2_start: string | null;
  session2_end: string | null;
}

function toTiming(row: TimingRow): ShiftTiming {
  return {
    code: row.code,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    crossesMidnight: row.crosses_midnight,
    breakMinutes: row.break_minutes,
    breakPaid: row.break_paid,
    session2Start: row.session2_start?.slice(0, 5) ?? null,
    session2End: row.session2_end?.slice(0, 5) ?? null,
  };
}

interface DayAssign {
  shiftId: number | null;
  weekOff: boolean;
}

export async function assertRosterSaveAllowed(
  db: Db,
  params: {
    actorUserId: number;
    entries: RosterGuardEntry[];
    reason: string | null;
  },
): Promise<void> {
  if (params.entries.length === 0) return;

  const employeeIds = [...new Set(params.entries.map((e) => e.employeeId))];
  const dates = params.entries.map((e) => e.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  if (minDate === undefined || maxDate === undefined) return;

  const fromCandidates = [addDaysIso(minDate, -1), mondayOf(minDate), quarterStart(minDate)];
  const toCandidates = [addDaysIso(maxDate, 1), addDaysIso(mondayOf(maxDate), 6), quarterEnd(maxDate)];
  const from = fromCandidates.sort()[0] ?? minDate;
  const to = toCandidates.sort()[toCandidates.length - 1] ?? maxDate;

  const existing = await db
    .selectFrom('att.rosters')
    .select(['employee_id', 'work_date', 'shift_id', 'is_week_off'])
    .where('employee_id', 'in', employeeIds)
    .where('work_date', '>=', sql<Date>`${from}::date`)
    .where('work_date', '<=', sql<Date>`${to}::date`)
    .execute();

  const state = new Map<number, Map<string, DayAssign>>();
  for (const row of existing) {
    const byDate = state.get(row.employee_id) ?? new Map<string, DayAssign>();
    byDate.set(formatDbDate(row.work_date), { shiftId: row.shift_id, weekOff: row.is_week_off });
    state.set(row.employee_id, byDate);
  }
  for (const entry of params.entries) {
    const byDate = state.get(entry.employeeId) ?? new Map<string, DayAssign>();
    byDate.set(entry.date, { shiftId: entry.shiftId, weekOff: entry.weekOff });
    state.set(entry.employeeId, byDate);
  }

  const shiftIds = new Set<number>();
  for (const byDate of state.values()) {
    for (const day of byDate.values()) {
      if (day.shiftId !== null) shiftIds.add(day.shiftId);
    }
  }
  const shiftRows =
    shiftIds.size === 0
      ? []
      : await db
          .selectFrom('att.shifts')
          .select([
            'id',
            'code',
            'start_time',
            'end_time',
            'crosses_midnight',
            'break_minutes',
            'break_paid',
            'session2_start',
            'session2_end',
          ])
          .where('id', 'in', [...shiftIds])
          .execute();
  const timings = new Map<number, ShiftTiming>();
  for (const row of shiftRows) timings.set(row.id, toTiming(row));

  const weeklyCap = await getTypedSetting(db, 'att.weekly_hours_cap', 'number', 48);
  const quarterlyCap = await getTypedSetting(db, 'att.quarterly_hours_cap', 'number', 624);
  const refuseOverCap = await getTypedSetting(db, 'att.roster_refuse_over_cap', 'boolean', true);
  const minRest = await getTypedSetting(db, 'att.min_rest_hours', 'number', 11);

  for (const employeeId of employeeIds) {
    const byDate = state.get(employeeId);
    if (!byDate) continue;
    const ordered = [...byDate.keys()].sort();
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const d0 = ordered[i];
      const d1 = ordered[i + 1];
      if (d0 === undefined || d1 === undefined) continue;
      if (addDaysIso(d0, 1) !== d1) continue;
      const a = byDate.get(d0);
      const b = byDate.get(d1);
      if (!a || !b || a.weekOff || b.weekOff || a.shiftId === null || b.shiftId === null) continue;
      const ta = timings.get(a.shiftId);
      const tb = timings.get(b.shiftId);
      if (!ta || !tb) continue;
      if (anyIntervalsOverlap(shiftIntervals(d0, ta), shiftIntervals(d1, tb))) {
        throw new RosterRuleError(
          'SHF-02 overlapping-shift block',
          `${ta.code} on ${d0} overlaps ${tb.code} on ${d1}. An employee cannot hold two windows at once — including midnight-crossing. No override: split the days.`,
        );
      }
      const rest = restHoursBetween(d0, ta, d1, tb);
      if (rest >= 0 && rest < minRest) {
        throw new RosterRuleError(
          'SHF-03 rest between shifts',
          `${rest.toLocaleString('en-IN')}h rest between ${ta.code} on ${d0} and ${tb.code} on ${d1} (minimum ${String(minRest)}h, att.min_rest_hours). A plant head cannot override rest; HR can change the setting.`,
        );
      }
    }
  }

  if (refuseOverCap) {
    for (const employeeId of employeeIds) {
      const byDate = state.get(employeeId);
      if (!byDate) continue;
      const weekHours = new Map<string, number>();
      const quarterHours = new Map<string, number>();
      for (const [iso, day] of byDate) {
        if (day.weekOff || day.shiftId === null) continue;
        const timing = timings.get(day.shiftId);
        if (!timing) continue;
        const hours = plannedMinutes(timing) / 60;
        const week = mondayOf(iso);
        weekHours.set(week, (weekHours.get(week) ?? 0) + hours);
        const q = quarterKey(iso);
        quarterHours.set(q, (quarterHours.get(q) ?? 0) + hours);
      }
      for (const [week, hours] of weekHours) {
        if (hours > weeklyCap) {
          throw new RosterRuleError(
            'SHF-03 weekly hours cap',
            `employee ${String(employeeId)} would be rostered ${hours.toLocaleString('en-IN')}h in the week of ${week} (cap ${String(weeklyCap)}h, att.weekly_hours_cap). Reduce the pattern or wait for the CMP-06 override permission.`,
          );
        }
      }
      for (const [quarter, hours] of quarterHours) {
        if (hours > quarterlyCap) {
          throw new RosterRuleError(
            'SHF-03 quarterly hours cap',
            `employee ${String(employeeId)} would be rostered ${hours.toLocaleString('en-IN')}h in ${quarter} (cap ${String(quarterlyCap)}h, att.quarterly_hours_cap).`,
          );
        }
      }
    }
  }

  const changed = params.entries.filter((entry) => {
    const was = existing.find(
      (row) => row.employee_id === entry.employeeId && formatDbDate(row.work_date) === entry.date,
    );
    if (!was) return true;
    return was.shift_id !== entry.shiftId || was.is_week_off !== entry.weekOff;
  });

  if (changed.length === 0) return;

  const pubs = await db
    .selectFrom('att.roster_publications')
    .select(['manager_employee_id', 'period_from', 'period_to'])
    .execute();
  if (pubs.length === 0) return;

  const employees = await db
    .selectFrom('core.employees')
    .select(['id', 'reporting_manager_id'])
    .where('id', 'in', employeeIds)
    .execute();
  const managerOf = new Map(employees.map((e) => [e.id, e.reporting_manager_id]));

  const publishedChange = changed.find((entry) => {
    const managerId = managerOf.get(entry.employeeId);
    if (managerId === null || managerId === undefined) return false;
    return pubs.some((pub) => {
      const fromPub = formatDbDate(pub.period_from);
      const toPub = formatDbDate(pub.period_to);
      return pub.manager_employee_id === managerId && fromPub <= entry.date && entry.date <= toPub;
    });
  });

  if (publishedChange && (params.reason === null || params.reason.trim().length < 5)) {
    throw new RosterRuleError(
      'SHF-05 roster publish',
      `The week covering ${publishedChange.date} is published. A change after publish is a dated revision and needs a reason (min 5 characters).`,
    );
  }
}

export async function recordPublishedRevisions(
  db: Db,
  params: {
    actorUserId: number;
    entries: RosterGuardEntry[];
    reason: string | null;
  },
): Promise<void> {
  if (params.reason === null || params.reason.trim().length < 5) return;
  for (const entry of params.entries) {
    const prior = await db
      .selectFrom('att.rosters')
      .select(['shift_id', 'is_week_off'])
      .where('employee_id', '=', entry.employeeId)
      .where('work_date', '=', sql<Date>`${entry.date}::date`)
      .executeTakeFirst();
    if (!prior) continue;
    if (prior.shift_id === entry.shiftId && prior.is_week_off === entry.weekOff) continue;
    await db
      .insertInto('att.roster_revisions')
      .values({
        employee_id: entry.employeeId,
        work_date: sql<Date>`${entry.date}::date` as unknown as Date,
        old_shift_id: prior.shift_id,
        new_shift_id: entry.shiftId,
        old_week_off: prior.is_week_off,
        new_week_off: entry.weekOff,
        reason: params.reason.trim(),
        changed_by: params.actorUserId,
      })
      .execute();
  }
}
