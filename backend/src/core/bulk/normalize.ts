/** Header and value normalisation shared by parser, engine and importers. */

/** "Employee No." / "employee_no" / "EMPLOYEE NO" → "employeeno". */
export function normalizeHeader(raw: string | number | boolean | null | undefined): string {
  return (raw === null || raw === undefined ? '' : String(raw)).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${String(y)}-${pad(m)}-${pad(d)}`;
}

/** Excel serial day (1900 system) → yyyy-mm-dd. */
function excelSerialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 120000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Accepts ISO (2026-04-30), Indian day-first (30-04-2026, 30/04/2026),
 * month names (30-Apr-2026, 30 Apr 2026) and Excel serials. Ambiguous
 * month-first input is never guessed: day-first is the documented format.
 */
export function parseDate(raw: string | number): string | null {
  if (typeof raw === 'number') return excelSerialToYmd(raw);
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return validYmd(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/,]+(\d{4})(?:\s.*)?$/.exec(s);
  if (m) {
    const month = MONTHS.indexOf((m[2] ?? '').slice(0, 3).toLowerCase()) + 1;
    return month === 0 ? null : validYmd(Number(m[3]), month, Number(m[1]));
  }
  if (/^\d+(\.\d+)?$/.test(s)) return excelSerialToYmd(Number(s));
  return null;
}

/**
 * Wall-clock date-time "yyyy-mm-dd hh:mm:ss" (no zone — the importer applies
 * the entity's timezone). Accepts "16 Jun 2025 15:03:40", ISO, day-first.
 */
export function parseDateTime(raw: string | number): string | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 1) return null;
    const iso = new Date(Math.round((raw - 25569) * 86400 * 1000)).toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
  }
  const s = raw.trim();
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\s*$/.exec(s);
  if (!time) return null;
  const datePart = s.slice(0, time.index).replace(/[T,\s]+$/, '');
  const ymd = parseDate(datePart);
  if (ymd === null) return null;
  let hour = Number(time[1]);
  const ampm = time[4]?.toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  const minute = Number(time[2]);
  const second = Number(time[3] ?? '0');
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${ymd} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/** "1,23,456.50" / "₹ 500" / "(250)" → number; blank → null; junk → NaN. */
export function parseNumber(raw: string | number): number | null {
  if (typeof raw === 'number') return raw;
  let s = raw.trim().replace(/[₹,\s]/g, '').replace(/^(rs\.?|inr)/i, '');
  if (s === '' || s === '-') return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return Number.NaN;
  const n = Number(s);
  return negative ? -n : n;
}

/** Text that a spreadsheet would execute as a formula when opened. */
export function isFormulaLike(value: string): boolean {
  return /^[=+\-@\t\r]/.test(value);
}

/** Neutralises spreadsheet formula injection for exported text cells. */
export function formulaSafe(value: string): string {
  return isFormulaLike(value) && !/^[+-]?[\d\s().]+$/.test(value) ? `'${value}` : value;
}
