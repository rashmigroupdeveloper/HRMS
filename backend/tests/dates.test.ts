/**
 * core/dates unit tests (no DB) — the timezone fixes from the Phase-1 review.
 * These run everywhere, independent of the server clock.
 */
import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  formatDbDate,
  formatDisplayDate,
  formatPayrollMonth,
  istDateString,
  istDateTime,
  previousWeekStartIso,
} from '../src/core/dates.js';

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

  it('formatDisplayDate is DD MMM YYYY (docs/05 §10)', () => {
    expect(formatDisplayDate('2026-07-08')).toBe('08 Jul 2026');
    expect(formatDisplayDate('2026-12-01')).toBe('01 Dec 2026');
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatPayrollMonth (R7 PAYROLL MONTH column)', () => {
  it('renders the live register format exactly', () => {
    // docs/06 §2.1 — the Jun-2026 sheet prints text 'Jun 2026', not a date serial.
    expect(formatPayrollMonth(2026, 6)).toBe('Jun 2026');
  });

  it('covers every month boundary', () => {
    expect(formatPayrollMonth(2026, 1)).toBe('Jan 2026');
    expect(formatPayrollMonth(2026, 12)).toBe('Dec 2026');
  });

  it('rejects an out-of-range month rather than printing undefined', () => {
    expect(() => formatPayrollMonth(2026, 0)).toThrow();
    expect(() => formatPayrollMonth(2026, 13)).toThrow();
    expect(() => formatPayrollMonth(2026, 1.5)).toThrow();
  });

  it('rejects a non-integer or implausible year', () => {
    expect(() => formatPayrollMonth(0, 6)).toThrow();
    expect(() => formatPayrollMonth(2026.5, 6)).toThrow();
  });
});

describe('core/dates — edge cases', () => {
  it('formatDbDate is correct on the month and year boundary', () => {
    // pg hands back LOCAL midnight; 31 Dec must not roll into 1 Jan.
    expect(formatDbDate(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(formatDbDate(new Date(2027, 0, 1))).toBe('2027-01-01');
  });

  it('formatDbDate handles a leap day', () => {
    expect(formatDbDate(new Date(2028, 1, 29))).toBe('2028-02-29');
  });

  it('addDaysIso crosses month, year and leap-day boundaries', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29'); // leap
    expect(addDaysIso('2027-02-28', 1)).toBe('2027-03-01'); // non-leap
  });

  it('addDaysIso goes backwards and is exactly reversible', () => {
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysIso(addDaysIso('2026-06-15', 47), -47)).toBe('2026-06-15');
  });

  it('addDaysIso(0) is identity', () => {
    expect(addDaysIso('2026-06-15', 0)).toBe('2026-06-15');
  });

  it('formatDisplayDate rejects an impossible month rather than printing undefined', () => {
    expect(formatDisplayDate('2026-13-01')).toBe('2026-13-01');
    expect(formatDisplayDate('2026-00-10')).toBe('2026-00-10');
  });

  it('formatDisplayDate falls through junk unchanged', () => {
    expect(formatDisplayDate('')).toBe('');
    expect(formatDisplayDate('not-a-date')).toBe('not-a-date');
  });

  it('formatDisplayDate zero-pads a single-digit day', () => {
    // The register and letters both need '05 Jun 2026', never '5 Jun 2026'.
    expect(formatDisplayDate('2026-06-05')).toBe('05 Jun 2026');
  });

  it('istDateString rolls the IST day over at 18:30 UTC, not at UTC midnight', () => {
    // 18:29:59Z is still the same IST day; 18:30:00Z is the next one.
    expect(istDateString(new Date('2026-06-15T18:29:59Z'))).toBe('2026-06-15');
    expect(istDateString(new Date('2026-06-15T18:30:00Z'))).toBe('2026-06-16');
  });

  it('istDateTime maps an IST wall clock to the right UTC instant', () => {
    expect(istDateTime('2026-06-15', '09:00').toISOString()).toBe('2026-06-15T03:30:00.000Z');
    expect(istDateTime('2026-06-15', '00:00').toISOString()).toBe('2026-06-14T18:30:00.000Z');
  });

  it('istDateTime accepts both HH:MM and HH:MM:SS', () => {
    expect(istDateTime('2026-06-15', '09:00').getTime()).toBe(istDateTime('2026-06-15', '09:00:00').getTime());
  });

  it('previousWeekStartIso on a Monday returns the Monday a full week back', () => {
    // Boundary: on Monday itself, "last week" must not mean today.
    const mon = new Date('2026-07-13T10:00:00+05:30');
    expect(previousWeekStartIso(mon)).toBe('2026-07-06');
  });

  it('previousWeekStartIso on a Sunday stays in the week that just closed', () => {
    // Sunday 2026-07-12 belongs to the week of Mon 07-06 → previous is 06-29.
    const sun = new Date('2026-07-12T23:00:00+05:30');
    expect(previousWeekStartIso(sun)).toBe('2026-06-29');
  });

  it('previousWeekStartIso is stable either side of IST midnight', () => {
    // 23:59 IST Tue and 00:01 IST Wed are the same week.
    expect(previousWeekStartIso(new Date('2026-07-14T23:59:00+05:30'))).toBe('2026-07-06');
    expect(previousWeekStartIso(new Date('2026-07-15T00:01:00+05:30'))).toBe('2026-07-06');
  });

  it('formatPayrollMonth pairs with formatDisplayDate on the same month names', () => {
    // One MONTHS_SHORT table — the register month and a payslip date must agree.
    expect(formatPayrollMonth(2026, 6)).toBe('Jun 2026');
    expect(formatDisplayDate('2026-06-30')).toBe('30 Jun 2026');
  });
});
