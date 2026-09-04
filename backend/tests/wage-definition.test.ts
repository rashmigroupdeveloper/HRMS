/**
 * CMP-01 goldens — amounts are paise. Percents are hand-computed from the
 * rupee figures in docs/09 (RML033903) and six structure shapes. Never
 * produced by running the checker first.
 */
import { describe, expect, it } from 'vitest';
import { assertWageDefinition, type WageComponent } from '../src/modules/compliance/wage-definition.js';

const rupees = (n: number): number => n * 100;

describe('assertWageDefinition (CMP-01)', () => {
  it('1. 50/25/25 exactly meets the floor', () => {
    expect(
      assertWageDefinition(
        [
          { code: 'BASIC', amountPaise: rupees(50_000), countsAsBasicDa: true },
          { code: 'HRA', amountPaise: rupees(25_000), countsAsBasicDa: false },
          { code: 'SPECIAL', amountPaise: rupees(25_000), countsAsBasicDa: false },
        ],
        50,
      ),
    ).toBeNull();
  });

  it('2. RML033903 live shape (docs/09) — Basic 32,286 of gross 64,573 is just under 50%', () => {
    const rows: WageComponent[] = [
      { code: 'BASIC', amountPaise: rupees(32_286), countsAsBasicDa: true },
      { code: 'HRA', amountPaise: rupees(16_143), countsAsBasicDa: false },
      { code: 'MEDICAL', amountPaise: rupees(1_250), countsAsBasicDa: false },
      { code: 'SPECIAL', amountPaise: rupees(12_005), countsAsBasicDa: false },
      { code: 'EDUCATION', amountPaise: rupees(200), countsAsBasicDa: false },
      { code: 'BONUS', amountPaise: rupees(2_689), countsAsBasicDa: false },
    ];
    // Hand: 32286 / 64573 = 49.999225…% — fails the Code floor by a hair.
    const violation = assertWageDefinition(rows, 50);
    expect(violation).not.toBeNull();
    expect(violation?.actualPct).toBeCloseTo((32_286 * 100) / 64_573, 10);
    expect(violation?.requiredPct).toBe(50);
  });

  it('3. DA-heavy: Basic 20k + DA 30k of 100k CTC passes', () => {
    expect(
      assertWageDefinition(
        [
          { code: 'BASIC', amountPaise: rupees(20_000), countsAsBasicDa: true },
          { code: 'DA', amountPaise: rupees(30_000), countsAsBasicDa: true },
          { code: 'HRA', amountPaise: rupees(20_000), countsAsBasicDa: false },
          { code: 'SPECIAL', amountPaise: rupees(30_000), countsAsBasicDa: false },
        ],
        50,
      ),
    ).toBeNull();
  });

  it('4. 40% basic fails with actualPct 40', () => {
    const violation = assertWageDefinition(
      [
        { code: 'BASIC', amountPaise: rupees(40_000), countsAsBasicDa: true },
        { code: 'HRA', amountPaise: rupees(20_000), countsAsBasicDa: false },
        { code: 'SPECIAL', amountPaise: rupees(40_000), countsAsBasicDa: false },
      ],
      50,
    );
    expect(violation).not.toBeNull();
    expect(violation?.actualPct).toBe(40);
    expect(violation?.requiredPct).toBe(50);
    expect(violation?.basicDaPaise).toBe(rupees(40_000));
    expect(violation?.ctcPaise).toBe(rupees(100_000));
  });

  it('5. 45% basic fails (hand: 45_000 / 100_000)', () => {
    const violation = assertWageDefinition(
      [
        { code: 'BASIC', amountPaise: rupees(45_000), countsAsBasicDa: true },
        { code: 'HRA', amountPaise: rupees(20_000), countsAsBasicDa: false },
        { code: 'SPECIAL', amountPaise: rupees(35_000), countsAsBasicDa: false },
      ],
      50,
    );
    expect(violation).not.toBeNull();
    expect(violation?.actualPct).toBe(45);
  });

  it('6. zero CTC is a violation, not a pass', () => {
    const violation = assertWageDefinition([], 50);
    expect(violation).toEqual({ actualPct: 0, requiredPct: 50, basicDaPaise: 0, ctcPaise: 0 });
  });
});
