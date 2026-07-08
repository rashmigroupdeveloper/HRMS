/**
 * Calendar math shared by MonthCalendar and DatePicker — one date-grid
 * implementation so the attendance month and the picker popover can never
 * disagree about what a week looks like.
 *
 * Weeks start Monday (the muster convention). "Today" is resolved in IST
 * (docs/05 §10) — the plant does not live in the browser's timezone.
 * Display format is `DD MMM YYYY` per docs/05 §10.
 */

const IST = 'Asia/Kolkata';

export interface CalendarDay {
  /** `YYYY-MM-DD` — the canonical exchange format with the API. */
  iso: string;
  day: number;
  /** False for the leading/trailing cells that pad the grid to full weeks. */
  inMonth: boolean;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
}

export const WEEKDAYS_MIN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function toISO(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${String(y)}-${mm}-${dd}`;
}

/** Today's `YYYY-MM-DD` in IST regardless of the client's timezone. */
export function todayISOIST(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `2026-07-08` → `08 Jul 2026` (docs/05 §10). Falls through bad input as-is. */
export function formatDateIN(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** `(2026, 7)` → `July 2026` for calendar headers. */
export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Month arithmetic that survives year boundaries. `month` is 1–12. */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + delta;
  return { year: Math.floor(zero / 12), month: (zero % 12 + 12) % 12 + 1 };
}

/**
 * Full-week matrix for a month (`month` 1–12): 4–6 rows of exactly 7
 * `CalendarDay`s, Monday-first, padded with the neighbouring months' dates.
 */
export function monthMatrix(year: number, month: number): CalendarDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  // JS getUTCDay(): 0 = Sunday → shift to 0 = Monday.
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: CalendarDay[] = [];
  const start = new Date(Date.UTC(year, month - 1, 1 - lead));
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;

  for (let i = 0; i < total; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push({
      iso: toISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month - 1 && d.getUTCFullYear() === year,
      weekday: i % 7,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
