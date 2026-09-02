/**
 * `todayLongIST` — the dashboard greeting date (docs/05 §10).
 * Pinned to IST so the greeting never shows yesterday for a user abroad.
 */
import { describe, expect, it } from 'vitest';
import { todayLongIST } from './date';

describe('todayLongIST', () => {
  it('formats as "Weekday, DD MMM YYYY"', () => {
    expect(todayLongIST(new Date('2026-07-07T06:00:00Z'))).toBe('Tuesday, 07 Jul 2026');
  });

  it('uses the IST calendar day, not the UTC one', () => {
    // 20:30Z on the 7th is already 02:00 IST on the 8th.
    expect(todayLongIST(new Date('2026-07-07T20:30:00Z'))).toBe('Wednesday, 08 Jul 2026');
  });
});
