import { describe, expect, it } from 'vitest';
import { parseSlabs } from './PayrollSettingsPage';

describe('parseSlabs', () => {
  it('reads min-max:amount lists and open-ended tops', () => {
    expect(parseSlabs('0-10000:0, 10001-15000:110\n15001-:200')).toEqual([
      { minMonthly: 0, maxMonthly: 10000, amount: 0 }, { minMonthly: 10001, maxMonthly: 15000, amount: 110 }, { minMonthly: 15001, maxMonthly: null, amount: 200 },
    ]);
    expect(() => parseSlabs('abc')).toThrow(/Cannot read slab/);
  });
});
