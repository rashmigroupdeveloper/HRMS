import { describe, expect, it } from 'vitest';
import { buildWageCheckComponents } from './wage-check';

describe('buildWageCheckComponents (CMP-01 calculator)', () => {
  it('maps Basic + DA + remainder to paise components', () => {
    const result = buildWageCheckComponents(50_000, 0, 100_000);
    expect(result).toEqual({
      ok: true,
      components: [
        { code: 'BASIC', amountPaise: 5_000_000, countsAsBasicDa: true },
        { code: 'OTHER', amountPaise: 5_000_000, countsAsBasicDa: false },
      ],
    });
  });

  it('includes DA when present and balances CTC', () => {
    const result = buildWageCheckComponents(40_000, 10_000, 100_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.components).toEqual([
      { code: 'BASIC', amountPaise: 4_000_000, countsAsBasicDa: true },
      { code: 'DA', amountPaise: 1_000_000, countsAsBasicDa: true },
      { code: 'OTHER', amountPaise: 5_000_000, countsAsBasicDa: false },
    ]);
  });

  it('refuses Basic+DA above CTC', () => {
    const result = buildWageCheckComponents(60_000, 50_000, 100_000);
    expect(result).toEqual({ ok: false, error: 'Basic + DA cannot exceed CTC.' });
  });
});
