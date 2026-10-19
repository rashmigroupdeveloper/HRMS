/** ATT-04/05/18 + SHF-01/02/03: shared stored shift windows, direction-aware FILO, overlap, hours & rest. */
import type { Selectable } from 'kysely';
import type { AttShiftsTable } from '../../core/db/types.js';
import { istDateTime } from '../../core/dates.js';

/**
 * Pure shift-window math (SHF-01/02/03) — overlap, planned hours, rest, slabs.
 * No I/O: unit-tested without a database so roster refusals stay deterministic.
 */
export interface ShiftTiming {
  code: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  breakMinutes: number;
  breakPaid: boolean;
  session2Start: string | null;
  session2End: string | null;
}

export interface MinuteInterval {
  startMin: number;
  endMin: number;
}

const HHMM = /^(\d{2}):(\d{2})(?::\d{2})?$/;

function parseHhmm(time: string): number {
  const match = HHMM.exec(time);
  if (!match) throw new Error(`Invalid time: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Days since Unix epoch for a YYYY-MM-DD calendar date (UTC, TZ-safe). */
function dayIndex(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000;
}

export function mondayOf(isoDate: string): string {
  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  const back = (dow + 6) % 7;
  const monday = new Date(`${isoDate}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - back);
  return monday.toISOString().slice(0, 10);
}

export function quarterKey(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  const year = isoDate.slice(0, 4);
  return `${year}-Q${String(Math.floor((month - 1) / 3) + 1)}`;
}

export function quarterStart(isoDate: string): string {
  const quarter = Number(quarterKey(isoDate).slice(-1));
  const year = isoDate.slice(0, 4);
  const month = String((quarter - 1) * 3 + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function quarterEnd(isoDate: string): string {
  const quarter = Number(quarterKey(isoDate).slice(-1));
  const year = Number(isoDate.slice(0, 4));
  const lastMonth = quarter * 3;
  const lastDay = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  return `${String(year)}-${String(lastMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function absMin(isoDate: string, time: string, extraDays = 0): number {
  return (dayIndex(isoDate) + extraDays) * 1440 + parseHhmm(time);
}

function closedOpen(startMin: number, endMin: number): MinuteInterval {
  if (endMin <= startMin) {
    throw new Error('Shift window end must be after start');
  }
  return { startMin, endMin };
}

/** Planned intervals on `isoDate` as half-open [start, end) in absolute minutes. */
export function shiftIntervals(isoDate: string, spec: ShiftTiming): MinuteInterval[] {
  const start = absMin(isoDate, spec.startTime);
  const end = absMin(isoDate, spec.endTime, spec.crossesMidnight ? 1 : 0);
  const primary = closedOpen(start, end);
  if (spec.session2Start === null || spec.session2End === null) return [primary];
  const s2start = absMin(isoDate, spec.session2Start);
  const s2end = absMin(
    isoDate,
    spec.session2End,
    parseHhmm(spec.session2End) <= parseHhmm(spec.session2Start) ? 1 : 0,
  );
  return [primary, closedOpen(s2start, s2end)];
}

function intervalsOverlap(a: MinuteInterval, b: MinuteInterval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function anyIntervalsOverlap(left: MinuteInterval[], right: MinuteInterval[]): boolean {
  for (const a of left) {
    for (const b of right) {
      if (intervalsOverlap(a, b)) return true;
    }
  }
  return false;
}

export function plannedMinutes(spec: ShiftTiming): number {
  const dummy = '1970-01-01';
  const total = shiftIntervals(dummy, spec).reduce((sum, iv) => sum + (iv.endMin - iv.startMin), 0);
  const unpaid = spec.breakPaid ? 0 : spec.breakMinutes;
  return Math.max(0, total - unpaid);
}

/** Rest between the end of `earlier` and the start of `later`, in hours. Negative = overlap. */
export function restHoursBetween(
  earlierDate: string,
  earlier: ShiftTiming,
  laterDate: string,
  later: ShiftTiming,
): number {
  const left = shiftIntervals(earlierDate, earlier);
  const right = shiftIntervals(laterDate, later);
  const end = Math.max(...left.map((iv) => iv.endMin));
  const start = Math.min(...right.map((iv) => iv.startMin));
  return (start - end) / 60;
}

export class RosterRuleError extends Error {
  constructor(
    readonly rule: string,
    readonly detail: string,
  ) {
    super(`${rule}: ${detail}`);
    this.name = 'RosterRuleError';
  }
}

type Shift = Selectable<AttShiftsTable>;
export interface ShiftInterval {
  start: number;
  end: number;
}
export interface SwipePoint {
  swipeTs: Date;
  direction: string | null;
}
export type AttendanceSwipe = Date | SwipePoint;

/** Separate stored sessions exclude their gap. `session_split` divides one span. */
export function scheduledShiftIntervals(shift: Shift, date: string): ShiftInterval[] {
  const start = istDateTime(date, shift.start_time).getTime();
  const end = istDateTime(date, shift.end_time).getTime() + (shift.crosses_midnight ? 86400000 : 0);
  const result = [{ start, end }];
  if (Boolean(shift.session2_start) !== Boolean(shift.session2_end))
    throw new Error('Incomplete second shift session');
  if (shift.session2_start && shift.session2_end) {
    if (shift.crosses_midnight || shift.session_split)
      throw new Error('Conflicting split shift configuration');
    const second = {
      start: istDateTime(date, shift.session2_start).getTime(),
      end: istDateTime(date, shift.session2_end).getTime(),
    };
    if (second.start < end) throw new Error('Shift sessions overlap');
    result.push(second);
  }
  if (
    result.some(
      (iv) => !Number.isFinite(iv.start) || !Number.isFinite(iv.end) || iv.end <= iv.start,
    )
  ) {
    throw new Error('Invalid shift time window');
  }
  return result;
}

export function shiftSessions(
  shift: Shift,
  date: string,
  intervals = scheduledShiftIntervals(shift, date),
): ShiftInterval[] | null {
  if (intervals.length === 2) return intervals;
  if (!shift.session_split) return null;
  const span = intervals[0];
  if (!span) throw new Error('Missing shift window');
  let split = istDateTime(date, shift.session_split).getTime();
  if (split < span.start && shift.crosses_midnight) split += 86400000;
  if (!Number.isFinite(split) || split <= span.start || split >= span.end)
    throw new Error('Invalid shift half boundary');
  return [
    { start: span.start, end: split },
    { start: split, end: span.end },
  ];
}

export function swipePoints(swipes: readonly AttendanceSwipe[]): SwipePoint[] {
  return swipes.map((swipe) =>
    swipe instanceof Date ? { swipeTs: swipe, direction: null } : swipe,
  );
}

/** A known OUT can never become an IN fallback, nor an IN become an OUT. */
export function selectFilo(swipes: readonly SwipePoint[]): {
  firstIn: Date | null;
  lastOut: Date | null;
} {
  const sorted = [...swipes].sort((a, b) => a.swipeTs.getTime() - b.swipeTs.getTime());
  const kind = (swipe: SwipePoint) => swipe.direction?.toLowerCase();
  const unknown = sorted.filter((swipe) => kind(swipe) !== 'in' && kind(swipe) !== 'out');
  const firstIn =
    sorted.find((swipe) => kind(swipe) === 'in')?.swipeTs ?? unknown[0]?.swipeTs ?? null;
  const last =
    sorted.findLast((swipe) => kind(swipe) === 'out')?.swipeTs ?? unknown.at(-1)?.swipeTs ?? null;
  return { firstIn, lastOut: firstIn && last && last > firstIn ? last : null };
}

/**
 * Pure shift-window math (SHF-01/02/03) — overlap, planned hours, rest, slabs.
 * No I/O: unit-tested without a database so roster refusals stay deterministic.
 */
