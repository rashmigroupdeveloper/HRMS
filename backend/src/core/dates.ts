/**
 * IST date/time helpers — the ONE place calendar math happens (NFR-09).
 *
 * Two hazards this module eliminates, both flagged in the Phase-1 review:
 *  1. pg parses a DATE column into a JS Date at the SERVER's LOCAL midnight.
 *     `toISOString()` on that value returns the WRONG day on any UTC+ server
 *     (prod is IST). Use `formatDbDate()` — local getters invert pg's own
 *     local-midnight construction on every timezone.
 *  2. Mixing local-time and UTC math (setHours + toISOString) silently shifts
 *     dates. All IST reasoning goes through `istParts()` / the helpers here.
 *
 * IST = UTC+5:30, no DST — a fixed offset, so the arithmetic is exact.
 */
const IST_OFFSET_MS = 5.5 * 3600_000;

/** 'YYYY-MM-DD' + 'HH:MM' or 'HH:MM:SS' interpreted in IST → the UTC instant. */
export function istDateTime(isoDate: string, time: string): Date {
  const hms = time.length === 5 ? `${time}:00` : time;
  return new Date(new Date(`${isoDate}T${hms}Z`).getTime() - IST_OFFSET_MS);
}

/** A UTC instant → its IST calendar date, 'YYYY-MM-DD' (e.g. "now" for windows). */
export function istDateString(instant: Date = new Date()): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * A pg DATE value (local-midnight Date) → 'YYYY-MM-DD', correct on ANY server
 * timezone. Never use toISOString() for this — that is the F6 bug.
 */
export function formatDbDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** `2026-07-08` → `08 Jul 2026` (docs/05 §10). Falls through bad input as-is. */
export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return iso;
  const month = MONTHS_SHORT[m - 1];
  if (month === undefined || !Number.isInteger(y) || !Number.isInteger(d) || d < 1 || d > 31) return iso;
  return `${String(d).padStart(2, '0')} ${month} ${String(y)}`;
}

/**
 * `(2026, 6)` → `Jun 2026` — the R7 register's `PAYROLL MONTH` column.
 *
 * The live sheet stores this as TEXT, not an Excel date serial (docs/06 §2.1),
 * so finance's month filter is a string match. Throws rather than emitting
 * `undefined 2026`: a mislabelled payroll month is a reconciliation incident.
 */
export function formatPayrollMonth(year: number, month: number): string {
  const name = MONTHS_SHORT[month - 1];
  if (!Number.isInteger(month) || name === undefined) {
    throw new RangeError(`formatPayrollMonth: month must be 1-12, got ${String(month)}`);
  }
  if (!Number.isInteger(year) || year < 1900 || year > 2999) {
    throw new RangeError(`formatPayrollMonth: implausible year ${String(year)}`);
  }
  return `${name} ${String(year)}`;
}

/** Add whole days to a 'YYYY-MM-DD' string (calendar-safe, TZ-independent). */
export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (IST) of the week BEFORE the one containing `now` — the just-closed week. */
export function previousWeekStartIso(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + IST_OFFSET_MS); // shift into IST, then use UTC getters
  const mondayIndex = (ist.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  ist.setUTCDate(ist.getUTCDate() - mondayIndex - 7);
  return ist.toISOString().slice(0, 10);
}
