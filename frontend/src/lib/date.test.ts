/**
 * `todayLongIST` — the dashboard greeting date (docs/05 §10).
 * Pinned to IST so the greeting never shows yesterday for a user abroad.
 */
import { describe, expect, it } from 'vitest';
import { todayLongIST, todayISOIST, formatCalendarDate } from './date';

describe('todayLongIST', () => {
  it('formats as "Weekday, DD MMM YYYY"', () => {
    expect(todayLongIST(new Date('2026-07-07T06:00:00Z'))).toBe('Tuesday, 07 Jul 2026');
  });

  it('uses the IST calendar day, not the UTC one', () => {
    // 20:30Z on the 7th is already 02:00 IST on the 8th.
    expect(todayLongIST(new Date('2026-07-07T20:30:00Z'))).toBe('Wednesday, 08 Jul 2026');
  });
});

describe('IST joining date boundary', () => {
  it('switches at midnight IST rather than midnight UTC', () => {
    expect(todayISOIST(new Date('2026-10-17T18:29:59Z'))).toBe('2026-10-17');
    expect(todayISOIST(new Date('2026-10-17T18:30:00Z'))).toBe('2026-10-18');
  });
  it('handles the IST year boundary', () => {
    expect(todayISOIST(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
  });
});

describe('database calendar date display', () => {
  it('formats a valid date using the required display convention', () => {
    expect(formatCalendarDate('2026-10-18')).toBe('18 Oct 2026');
  });
  it('does not invent a calendar date from malformed input', () => {
    expect(formatCalendarDate('2026-02-30')).toBe('Invalid date');
    expect(formatCalendarDate('18/10/2026')).toBe('Invalid date');
  });
});
