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

/** Inclusive bar drawn across a month grid (docs/12 §7 spanning calendar events). */
export interface CalendarSpan {
  id: string;
  /** Inclusive `YYYY-MM-DD`. */
  from: string;
  /** Inclusive `YYYY-MM-DD`. */
  to: string;
  label: string;
  tone: 'holiday' | 'leave' | 'duty';
}

interface PlacedSpan {
  id: string;
  label: string;
  tone: CalendarSpan['tone'];
  /** Column 0–6 inside the week. */
  start: number;
  length: number;
  /** 0 = the lane closest to the day number. Later lanes sit below. */
  lane: number;
}

function nextIso(iso: string): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Merge consecutive days that share a label and tone into inclusive spans.
 * A gap of one day, or a different label, starts a new span.
 */
export function collapseDaySpans(
  days: readonly { iso: string; label: string; tone: CalendarSpan['tone'] }[],
): CalendarSpan[] {
  const sorted = [...days].sort((a, b) => a.iso.localeCompare(b.iso) || a.label.localeCompare(b.label));
  const spans: CalendarSpan[] = [];
  for (const day of sorted) {
    const last = spans.at(-1);
    if (last?.label === day.label && last.tone === day.tone && nextIso(last.to) === day.iso) {
      last.to = day.iso;
      continue;
    }
    spans.push({ id: `${day.tone}:${day.iso}:${day.label}`, from: day.iso, to: day.iso, label: day.label, tone: day.tone });
  }
  return spans;
}

/**
 * Clip spans to one Monday-first week and assign non-overlapping lanes.
 * `week` is the seven ISO dates from `monthMatrix`, padding days included.
 */
export function placeSpans(spans: readonly CalendarSpan[], week: readonly string[]): PlacedSpan[] {
  const start = week[0];
  const end = week[6];
  if (start === undefined || end === undefined) return [];

  const clipped = spans
    .filter((span) => span.to >= start && span.from <= end)
    .map((span) => {
      const from = span.from < start ? start : span.from;
      const to = span.to > end ? end : span.to;
      const startCol = week.indexOf(from);
      const endCol = week.indexOf(to);
      return { span, start: startCol, length: endCol - startCol + 1 };
    })
    .filter((item) => item.start >= 0 && item.length > 0)
    .sort((a, b) => a.start - b.start || b.length - a.length);

  const laneEnds: number[] = [];
  return clipped.map((item) => {
    const endCol = item.start + item.length - 1;
    let lane = laneEnds.findIndex((taken) => taken < item.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(endCol);
    } else {
      laneEnds[lane] = endCol;
    }
    return {
      id: item.span.id,
      label: item.span.label,
      tone: item.span.tone,
      start: item.start,
      length: item.length,
      lane,
    };
  });
}
