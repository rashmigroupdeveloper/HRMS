/**
 * core/dates unit tests (no DB) — the timezone fixes from the Phase-1 review.
 * These run everywhere, independent of the server clock.
 */
import { describe, expect, it } from 'vitest';
import { addDaysIso, formatDbDate, istDateString, istDateTime, previousWeekStartIso } from '../src/core/dates.js';

describe('core/dates', () => {
  it('formatDbDate returns the calendar date of a pg local-midnight DATE (F6)', () => {
    // pg builds a DATE as new Date(y, m-1, d) = LOCAL midnight; local getters invert it.
    const pgDate = new Date(2026, 6, 6); // 2026-07-06 local midnight
    expect(formatDbDate(pgDate)).toBe('2026-07-06');
  });

  it('previousWeekStartIso returns a MONDAY, one full week back (F3)', () => {
    // 2026-07-15 is a Wednesday (IST) → previous week's Monday = 2026-07-06.
    const wed = new Date('2026-07-15T08:00:00+05:30');
    const start = previousWeekStartIso(wed);
    expect(start).toBe('2026-07-06');
    expect(new Date(`${start}T00:00:00Z`).getUTCDay()).toBe(1); // Monday
  });

  it('previousWeekStartIso is a Monday for a Monday-02:00-IST cron fire (the F3 trigger)', () => {
    const mondayEarly = new Date('2026-07-13T02:00:00+05:30'); // Mon 02:00 IST
    const start = previousWeekStartIso(mondayEarly);
    expect(start).toBe('2026-07-06'); // the just-finished week's Monday, NOT Sunday
    expect(new Date(`${start}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it('istDateString maps a late-UTC instant to the correct IST calendar day (tz3)', () => {
    // 2026-07-09 20:00 UTC = 2026-07-10 01:30 IST.
    expect(istDateString(new Date('2026-07-09T20:00:00Z'))).toBe('2026-07-10');
  });

  it('istDateTime + addDaysIso round-trip', () => {
    expect(istDateTime('2026-07-06', '09:00').toISOString()).toBe('2026-07-06T03:30:00.000Z');
    expect(istDateTime('2026-07-06', '13:30:00').toISOString()).toBe('2026-07-06T08:00:00.000Z');
    expect(addDaysIso('2026-07-06', -1)).toBe('2026-07-05');
    expect(addDaysIso('2026-07-31', 1)).toBe('2026-08-01');
  });
});
