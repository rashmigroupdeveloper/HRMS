/**
 * Payable-day evaluator (PAY-04, C-16/C-17/C-28, handover item 4). Pure: the
 * caller supplies the locked day facts of the attendance window and the planned
 * off days of the pay month.
 *
 * Divisor policy `pay.lop_divisor`:
 *  - CALENDAR (default): divisor = calendar days of the pay month; payable =
 *    employed days in the month − unpaid day-equivalents in the window.
 *  - FIXED_30: divisor 30; payable = 30 − days of the month outside employment − unpaid.
 *  - FIXED_26: divisor 26; payable = 26 − working days outside employment − unpaid
 *    working days (week-offs/holidays excluded on both sides).
 *  - WORKING_DAYS: divisor = working days of the pay month; payable = working days
 *    employed − unpaid working days.
 *
 * Unpaid day-equivalent per day: P/OD/CO/H = 0; paid WO = 0, unpaid WO = 1;
 * paid L = 0, unpaid L = 1; HD = 0.5, except a half-day of PAID leave whose other
 * half was worked = 0 and a half-day of UNPAID leave not worked = 1; A/UAB = 1.
 *
 * Sandwich (`att.sandwich_rule` = true, calendar-type divisors only): a run of
 * week-offs/holidays whose nearest days on both sides are full unpaid absences
 * becomes unpaid too.
 *
 * Attendance cycle: facts cover the attendance window (e.g. 26 May–25 June);
 * pay-month days after the cut-off carry no facts and are paid as assumed present.
 */
import type { DayStatus } from '../../../core/db/types.js';
import { addDaysIso } from '../../../core/dates.js';

export const LOP_DIVISORS = ['CALENDAR', 'FIXED_30', 'FIXED_26', 'WORKING_DAYS'] as const;
export type LopDivisor = (typeof LOP_DIVISORS)[number];

export function parseLopDivisor(value: string): LopDivisor {
  const found = LOP_DIVISORS.find((d) => d === value);
  if (!found) throw new Error(`pay.lop_divisor must be one of ${LOP_DIVISORS.join(', ')}`);
  return found;
}

export interface DayFact {
  iso: string;
  status: DayStatus;
  /** null when the day carries no leave type. */
  leavePaid: boolean | null;
  weekoffPaid: boolean | null;
  /** HD with a leave type: the non-leave half was worked (session P/OD or half-day hours). */
  otherHalfWorked: boolean;
}

export interface PayableInput {
  divisor: LopDivisor;
  sandwich: boolean;
  /** Calendar pay month [monthFrom, monthUntil). */
  monthFrom: string;
  monthUntil: string;
  /** Employment inside the pay month [employedFrom, employedUntil). */
  employedFrom: string;
  employedUntil: string;
  /** Locked facts of the attendance window, clipped to employment. */
  facts: readonly DayFact[];
  /** Planned week-offs/holidays of the pay month (used where no fact exists). */
  plannedOffDays: ReadonlySet<string>;
}

export interface PayableResult {
  daysInMonth: number;
  payableDays: number;
  lopDays: number;
  sandwichDays: number;
}

const OFF: readonly DayStatus[] = ['WO', 'H'];

export function unpaidWeight(f: DayFact): number {
  switch (f.status) {
    case 'P': case 'OD': case 'CO': case 'H': return 0;
    case 'WO': return f.weekoffPaid === true ? 0 : 1;
    case 'L': return f.leavePaid === true ? 0 : 1;
    case 'HD':
      if (f.leavePaid === true) return f.otherHalfWorked ? 0 : 0.5;
      if (f.leavePaid === false) return f.otherHalfWorked ? 0.5 : 1;
      return 0.5;
    default: return 1;
  }
}

function dayCount(from: string, until: string): number {
  return Math.max(0, Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));
}

/** Indices of off days that the sandwich rule turns unpaid. */
function sandwichedDays(facts: readonly DayFact[], weights: number[]): Set<number> {
  const out = new Set<number>();
  let i = 0;
  while (i < facts.length) {
    const fact = facts[i];
    if (!fact || !OFF.includes(fact.status)) { i++; continue; }
    let j = i;
    while (j + 1 < facts.length && OFF.includes(facts[j + 1]?.status ?? 'P')) j++;
    const before = facts[i - 1];
    const after = facts[j + 1];
    const contiguous = before !== undefined && addDaysIso(before.iso, j - i + 2) === after?.iso;
    if (contiguous && weights[i - 1] === 1 && weights[j + 1] === 1) {
      for (let k = i; k <= j; k++) if ((weights[k] ?? 0) < 1) out.add(k);
    }
    i = j + 1;
  }
  return out;
}

export function evaluatePayableDays(input: PayableInput): PayableResult {
  const facts = [...input.facts].sort((a, b) => a.iso.localeCompare(b.iso));
  const weights = facts.map(unpaidWeight);
  const calendarDivisor = input.divisor === 'CALENDAR' || input.divisor === 'FIXED_30';
  const sandwich = input.sandwich && calendarDivisor ? sandwichedDays(facts, weights) : new Set<number>();
  for (const k of sandwich) weights[k] = 1;

  const isOff = (iso: string): boolean => {
    const fact = facts.find((f) => f.iso === iso);
    return fact ? OFF.includes(fact.status) : input.plannedOffDays.has(iso);
  };
  const workingDays = (from: string, until: string): number => {
    let n = 0;
    for (let d = from; d < until; d = addDaysIso(d, 1)) if (!isOff(d)) n++;
    return n;
  };
  const unpaidAll = weights.reduce((s, w) => s + w, 0);
  const unpaidWorking = facts.reduce((s, f, k) => (OFF.includes(f.status) ? s : s + (weights[k] ?? 0)), 0);

  const calendarDays = dayCount(input.monthFrom, input.monthUntil);
  const employedDays = dayCount(input.employedFrom, input.employedUntil);
  let daysInMonth: number;
  let payable: number;
  switch (input.divisor) {
    case 'CALENDAR':
      daysInMonth = calendarDays;
      payable = employedDays - unpaidAll;
      break;
    case 'FIXED_30':
      daysInMonth = 30;
      payable = 30 - (calendarDays - employedDays) - unpaidAll;
      break;
    case 'FIXED_26': {
      daysInMonth = 26;
      const outside = workingDays(input.monthFrom, input.monthUntil) - workingDays(input.employedFrom, input.employedUntil);
      payable = 26 - outside - unpaidWorking;
      break;
    }
    case 'WORKING_DAYS':
      daysInMonth = workingDays(input.monthFrom, input.monthUntil);
      payable = workingDays(input.employedFrom, input.employedUntil) - unpaidWorking;
      break;
  }
  const payableDays = Math.min(daysInMonth, Math.max(0, payable));
  return { daysInMonth, payableDays, lopDays: daysInMonth - payableDays, sandwichDays: sandwich.size };
}
