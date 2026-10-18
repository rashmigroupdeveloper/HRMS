/**
 * Attendance (muster) cycle — C-17 / handover item 4.
 *
 * `att.cycle_start_day` = 1 (default) keeps calendar-month attendance. A value
 * of N in 2..28 makes payroll month M's attendance period run from day N of
 * M-1 to day N-1 of M (e.g. 26 → 26 May … 25 June for June payroll). Days
 * after the cut-off up to month end are paid as assumed-present; LOP found in
 * them is deducted in the next month's period.
 *
 * Month locks stay keyed by the payroll month; every "which lock covers this
 * day" decision goes through periodMonthOf / periodMonthSql so day-level
 * guards and the lock agree.
 */
import { sql, type Kysely, type RawBuilder } from 'kysely';
import type { Database } from './types.js';

const CYCLE_START_SETTING = 'att.cycle_start_day';

export function assertCycleStartDay(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 28)
    throw new Error(`${CYCLE_START_SETTING} must be a whole number from 1 to 28`);
  return value;
}

/** Reads the cycle start straight from core.settings (core cannot import the settings module). */
export async function loadCycleStartDay(db: Kysely<Database>): Promise<number> {
  const row = await db.selectFrom('core.settings').select('value').where('key', '=', CYCLE_START_SETTING).executeTakeFirst();
  if (!row) return 1;
  return assertCycleStartDay(row.value);
}

function shiftMonth(monthIso: string, delta: number): string {
  const [y = 0, m = 0] = monthIso.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${String(Math.floor(idx / 12))}-${String((idx % 12) + 1).padStart(2, '0')}-01`;
}

/** Attendance window [from, until) of payroll month `monthIso` (YYYY-MM-01). */
export function attendanceWindow(monthIso: string, startDay: number): { from: string; until: string } {
  const month = `${monthIso.slice(0, 7)}-01`;
  if (startDay === 1) return { from: month, until: shiftMonth(month, 1) };
  const day = String(startDay).padStart(2, '0');
  return { from: `${shiftMonth(month, -1).slice(0, 8)}${day}`, until: `${month.slice(0, 8)}${day}` };
}

/** Payroll month (YYYY-MM-01) whose attendance period contains `isoDate`. */
export function periodMonthOf(isoDate: string, startDay: number): string {
  const month = `${isoDate.slice(0, 7)}-01`;
  if (startDay > 1 && Number(isoDate.slice(8, 10)) >= startDay) return shiftMonth(month, 1);
  return month;
}

/** SQL twin of periodMonthOf for a date column/expression. */
export function periodMonthSql(dateExpr: RawBuilder<unknown>, startDay: number): RawBuilder<Date> {
  return sql<Date>`(CASE WHEN ${startDay}::int > 1 AND extract(day FROM ${dateExpr}) >= ${startDay}::int
    THEN date_trunc('month', ${dateExpr} + interval '1 month') ELSE date_trunc('month', ${dateExpr}) END)::date`;
}

/** Distinct payroll months touched by an inclusive date span, ascending. */
export function periodMonthsOfSpan(fromDate: string, toDate: string, startDay: number): string[] {
  const first = periodMonthOf(fromDate, startDay);
  const last = periodMonthOf(toDate, startDay);
  const months: string[] = [];
  for (let m = first; m <= last; m = shiftMonth(m, 1)) months.push(m);
  return months;
}

/**
 * Effective attendance window of a company's payroll month. A lock freezes its
 * window; otherwise the window starts where the previous month's lock ended
 * (so changing the cycle start never skips or double-counts days) and ends at
 * the configured cut-off.
 */
export async function resolveAttendanceWindow(
  db: Kysely<Database>, companyId: number, monthIso: string,
): Promise<{ from: string; until: string }> {
  const month = `${monthIso.slice(0, 7)}-01`;
  const own = await db.selectFrom('att.month_locks')
    .select([sql<string | null>`to_char(period_from, 'YYYY-MM-DD')`.as('pf'), sql<string | null>`to_char(period_until, 'YYYY-MM-DD')`.as('pu')])
    .where('company_id', '=', companyId).where('month', '=', sql<Date>`${month}::date`).executeTakeFirst();
  if (own) return own.pf && own.pu ? { from: own.pf, until: own.pu } : attendanceWindow(month, 1);
  const nominal = attendanceWindow(month, await loadCycleStartDay(db));
  const previousMonth = shiftMonth(month, -1);
  const prev = await db.selectFrom('att.month_locks')
    .select(sql<string | null>`to_char(period_until, 'YYYY-MM-DD')`.as('pu'))
    .where('company_id', '=', companyId).where('month', '=', sql<Date>`${previousMonth}::date`).executeTakeFirst();
  if (!prev) return nominal;
  const from = prev.pu ?? month; // pre-cycle lock = calendar month
  if (from >= nominal.until) throw new Error(`Attendance window for ${month} is empty after the cycle change; review ${CYCLE_START_SETTING}`);
  return { from, until: nominal.until };
}
