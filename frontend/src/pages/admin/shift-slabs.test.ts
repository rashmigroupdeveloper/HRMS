import { describe, expect, it } from 'vitest';
import { slabsFromThresholds, thresholdsFromSlabs } from './shift-slabs';

describe('shift late/early slabs (SHF-01)', () => {
  it('builds the 0–15 / 16–30 / >30 half-day example', () => {
    expect(slabsFromThresholds(15, 30)).toEqual([
      { fromMin: 0, toMin: 15, effect: 'late' },
      { fromMin: 16, toMin: 30, effect: 'late' },
      { fromMin: 31, toMin: null, effect: 'half_day' },
    ]);
  });

  it('leaves the processor on hour-thresholds when both numbers are 0', () => {
    expect(slabsFromThresholds(0, 0)).toEqual([]);
  });

  it('round-trips the operator numbers', () => {
    const slabs = slabsFromThresholds(15, 30);
    expect(thresholdsFromSlabs(slabs)).toEqual({ lateUntil: 15, halfDayAfter: 30 });
  });
});
