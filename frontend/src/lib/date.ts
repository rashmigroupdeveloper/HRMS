/**
 * Localized date formatting (docs/05 §10: IST, `DD MMM YYYY`, en-IN).
 * All display dates flow through here so the app never hardcodes a date string.
 */

const IST = 'Asia/Kolkata';

/** e.g. "Tuesday, 07 Jul 2026" — the dashboard greeting date, always live. */
export function todayLongIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
}
