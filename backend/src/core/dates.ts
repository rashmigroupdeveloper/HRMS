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
