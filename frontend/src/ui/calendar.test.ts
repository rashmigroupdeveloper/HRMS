/**
 * Calendar + date helpers (docs/05 §10: IST, `DD MMM YYYY`, en-IN).
 *
 * These are pure functions that every attendance surface depends on, and they
 * are exactly where timezone bugs hide: the plant is in IST, the browser may
 * not be, and an off-by-one day here silently mis-attributes a swipe.
 */
import { describe, expect, it } from 'vitest';
import { addMonths, formatDateIN, monthLabel, monthMatrix, todayISOIST, WEEKDAYS_MIN } from './calendar';
import { cn } from './cn';

describe('todayISOIST', () => {
  it('returns the IST date even when the instant is a different day in UTC', () => {
    // 2026-07-07T20:30:00Z is 2026-07-08 02:00 IST — the NEXT day in India.
    expect(todayISOIST(new Date('2026-07-07T20:30:00Z'))).toBe('2026-07-08');
  });

  it('stays on the same IST day just before the rollover', () => {
    // 18:29Z = 23:59 IST on the 7th.
    expect(todayISOIST(new Date('2026-07-07T18:29:00Z'))).toBe('2026-07-07');
  });

  it('always produces YYYY-MM-DD, the API exchange format', () => {
    expect(todayISOIST(new Date('2026-01-05T06:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDateIN', () => {
  it('formats as DD MMM YYYY', () => {
    expect(formatDateIN('2026-07-08')).toBe('08 Jul 2026');
  });

  it('zero-pads single-digit days', () => {
    expect(formatDateIN('2026-12-01')).toBe('01 Dec 2026');
  });

  it('passes malformed input through unchanged rather than inventing a date', () => {
    expect(formatDateIN('not-a-date')).toBe('not-a-date');
    expect(formatDateIN('')).toBe('');
  });
});

describe('monthLabel', () => {
  it('renders the full month and year', () => {
    expect(monthLabel(2026, 7)).toBe('July 2026');
    expect(monthLabel(2026, 1)).toBe('January 2026');
  });
});

describe('addMonths', () => {
  it('moves within a year', () => {
    expect(addMonths(2026, 7, 1)).toEqual({ year: 2026, month: 8 });
    expect(addMonths(2026, 7, -1)).toEqual({ year: 2026, month: 6 });
  });

  it('crosses the year boundary in both directions', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('handles multi-year jumps', () => {
    expect(addMonths(2026, 6, 25)).toEqual({ year: 2028, month: 7 });
    expect(addMonths(2026, 6, -25)).toEqual({ year: 2024, month: 5 });
  });

  it('is the identity for a zero delta', () => {
    expect(addMonths(2026, 3, 0)).toEqual({ year: 2026, month: 3 });
  });
});

describe('monthMatrix', () => {
  it('returns full weeks of exactly 7 days, Monday-first', () => {
    const weeks = monthMatrix(2026, 7);
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    for (const week of weeks) expect(week).toHaveLength(7);
    expect(WEEKDAYS_MIN[0]).toBe('Mo');
    expect(weeks[0]?.[0]?.weekday).toBe(0);
  });

  it('marks padding cells as out-of-month, and every real day as in-month', () => {
    const cells = monthMatrix(2026, 7).flat();
    const inMonth = cells.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31); // July
    expect(inMonth[0]?.iso).toBe('2026-07-01');
    expect(inMonth.at(-1)?.iso).toBe('2026-07-31');
    expect(cells.some((c) => !c.inMonth)).toBe(true);
  });

  it('handles February in a leap year', () => {
    const inMonth = monthMatrix(2024, 2).flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(29);
    expect(inMonth.at(-1)?.iso).toBe('2024-02-29');
  });

  it('handles February in a non-leap year', () => {
    const inMonth = monthMatrix(2026, 2).flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(28);
  });

  it('produces strictly consecutive dates with no gap or repeat across weeks', () => {
    const cells = monthMatrix(2026, 3).flat();
    for (let i = 1; i < cells.length; i++) {
      const prev = new Date(`${cells[i - 1]?.iso ?? ''}T00:00:00Z`).getTime();
      const curr = new Date(`${cells[i]?.iso ?? ''}T00:00:00Z`).getTime();
      expect(curr - prev).toBe(86_400_000);
    }
  });

  it('starts a month that begins on Monday with no leading padding', () => {
    // 1 June 2026 is a Monday.
    const first = monthMatrix(2026, 6)[0]?.[0];
    expect(first?.iso).toBe('2026-06-01');
    expect(first?.inMonth).toBe(true);
  });
});

describe('cn', () => {
  it('joins truthy parts and drops falsy ones', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns an empty string when everything is falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });
});
