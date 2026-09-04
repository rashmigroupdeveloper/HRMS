/**
 * Pure shift-window math (SHF-01/02/03) — overlap, planned hours, rest, slabs.
 * No I/O: unit-tested without a database so roster refusals stay deterministic.
 */
export type TimeSlabEffect = 'none' | 'late' | 'half_day';

export interface TimeSlab {
  fromMin: number;
  toMin: number | null;
  effect: TimeSlabEffect;
}

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

export function parseTimeSlabs(value: unknown): TimeSlab[] {
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const slabs: TimeSlab[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    const fromMin = Number(rec['fromMin']);
    const toRaw = rec['toMin'];
    const toMin = toRaw === null || toRaw === undefined ? null : Number(toRaw);
    const effect = rec['effect'];
    if (!Number.isFinite(fromMin) || fromMin < 0) continue;
    if (toMin !== null && (!Number.isFinite(toMin) || toMin < fromMin)) continue;
    if (effect !== 'none' && effect !== 'late' && effect !== 'half_day') continue;
    slabs.push({ fromMin, toMin, effect });
  }
  return slabs;
}

export function matchingSlab(minutes: number, slabs: TimeSlab[]): TimeSlab | null {
  for (const slab of slabs) {
    if (minutes < slab.fromMin) continue;
    if (slab.toMin !== null && minutes > slab.toMin) continue;
    return slab;
  }
  return null;
}

export function applyAttendanceSlabs(
  status: 'P' | 'A' | 'HD',
  lateMinutes: number,
  earlyExitMinutes: number,
  lateSlabs: TimeSlab[],
  earlySlabs: TimeSlab[],
): 'P' | 'A' | 'HD' {
  if (status === 'A') return status;
  const late = matchingSlab(lateMinutes, lateSlabs);
  const early = matchingSlab(earlyExitMinutes, earlySlabs);
  if (late?.effect === 'half_day' || early?.effect === 'half_day') return 'HD';
  return status;
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
