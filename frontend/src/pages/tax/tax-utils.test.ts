import { describe, expect, it } from 'vitest';
import { currentFy, fyOptions, inr } from './tax-utils';

describe('tax-utils', () => {
  it('maps dates to Indian financial years', () => {
    expect(currentFy(new Date('2026-10-19T00:00:00Z'))).toBe('2026-27');
    expect(currentFy(new Date('2027-02-01T00:00:00Z'))).toBe('2026-27');
    expect(currentFy(new Date('2099-04-01T00:00:00Z'))).toBe('2099-00');
    expect(fyOptions(2, new Date('2026-10-19T00:00:00Z')).map((o) => o.value)).toEqual(['2026-27', '2025-26']);
    expect(inr(150000)).toBe('₹1,50,000');
  });
});
