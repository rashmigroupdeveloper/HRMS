/**
 * Localized date formatting (docs/05 §10: IST, `DD MMM YYYY`, en-IN).
 * All display dates flow through here so the app never hardcodes a date string.
 */

const IST = 'Asia/Kolkata';

const longDateFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit',
});
const calendarDateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST, day: '2-digit', month: 'short', year: 'numeric',
});

/** e.g. "Tuesday, 07 Jul 2026" — the dashboard greeting date, always live. */
export function todayLongIST(now: Date = new Date()): string {
  return longDateFormatter.format(now);
}

/** Actual calendar date for joining/form boundaries, always IST. */
export function todayISOIST(now: Date = new Date()): string {
  const parts = isoDateFormatter.formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A database calendar date → DD MMM YYYY, without local timezone shifts. */
export function formatCalendarDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return 'Invalid date';
  const date = new Date(isoDate + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate)
    return 'Invalid date';
  return calendarDateFormatter.format(date);
}
