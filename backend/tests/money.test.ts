/**
 * Money module tests — expected values HAND-COMPUTED from docs/10
 * (India Payroll Statutory Reference), never derived by running the code.
 */
import { describe, expect, it } from 'vitest';
import {
  ZERO,
  add,
  formatINR,
  fromRupees,
  isNegative,
  max,
  min,
  mulDiv,
  paise,
  percentBp,
  roundEsicContribution,
  roundGratuity,
  roundOtPay,
  roundPfContribution,
  roundToRupee,
  subtract,
  sum,
  toRupees,
} from '../src/core/money/index.js';

describe('construction guards — floats never become money', () => {
  it('rejects fractional paise', () => {
    expect(() => paise(100.5)).toThrow(TypeError);
  });

  it('rejects rupee amounts with more than 2 decimals', () => {
    expect(() => fromRupees(1.001)).toThrow(TypeError);
  });

  it('kills the classic float bug: 0.1 + 0.2 === 0.3 in paise', () => {
    expect(add(fromRupees(0.1), fromRupees(0.2))).toBe(fromRupees(0.3));
  });

  it('rejects non-finite and absurdly large values', () => {
    expect(() => paise(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => paise(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });
});

describe('arithmetic', () => {
  it('add / subtract / sum are exact', () => {
    expect(add(fromRupees(99.99), fromRupees(0.01))).toBe(fromRupees(100));
    expect(subtract(fromRupees(100), fromRupees(0.01))).toBe(fromRupees(99.99));
    expect(sum([fromRupees(1.11), fromRupees(2.22), fromRupees(3.33)])).toBe(fromRupees(6.66));
    expect(sum([])).toBe(ZERO);
  });

  it('negative amounts are representable (deltas/recoveries) and detectable', () => {
    const delta = subtract(fromRupees(100), fromRupees(150));
    expect(toRupees(delta)).toBe(-50);
    expect(isNegative(delta)).toBe(true);
  });

  it('min / max', () => {
    expect(min(fromRupees(1), fromRupees(2))).toBe(fromRupees(1));
    expect(max(fromRupees(1), fromRupees(2))).toBe(fromRupees(2));
  });
});

describe('PF — docs/10 §2 (G1 fixture, live RML payslip parity)', () => {
  const basic = fromRupees(32_286);

  it('EE PF 12% on ACTUAL basic: ₹32,286 → ₹3,874 (G1)', () => {
    const raw = percentBp(basic, 1200); // 387,432 paise = ₹3,874.32
    expect(toRupees(raw)).toBeCloseTo(3874.32, 2);
    expect(roundPfContribution(raw)).toBe(fromRupees(3874));
  });

  it('ER EPS 8.33% capped at ₹15,000 wages → ₹1,250 (docs/10 §2.2)', () => {
    const epsWages = min(basic, fromRupees(15_000));
    const eps = roundPfContribution(percentBp(epsWages, 833)); // ₹1,249.50 → ₹1,250
    expect(eps).toBe(fromRupees(1250));
  });

  it('ER EPF = 12% of actual − EPS: ₹3,874 − ₹1,250 = ₹2,624 (docs/10 §2.2 table)', () => {
    const erTotal = roundPfContribution(percentBp(basic, 1200));
    const eps = fromRupees(1250);
    expect(subtract(erTotal, eps)).toBe(fromRupees(2624));
  });

  it('G2 ceiling mode: basic ₹22,000 capped at ₹15,000 → EE ₹1,800', () => {
    const capped = min(fromRupees(22_000), fromRupees(15_000));
    expect(roundPfContribution(percentBp(capped, 1200))).toBe(fromRupees(1800));
  });

  it('EDLI 0.5% of ₹15,000 → ₹75 (docs/10 §2.2)', () => {
    expect(roundPfContribution(percentBp(fromRupees(15_000), 50))).toBe(fromRupees(75));
  });
});

describe('ESIC — docs/10 §3 (round UP is the law)', () => {
  it('EE 0.75% of ₹21,000 = ₹157.50 → ₹158 (ceil)', () => {
    const raw = percentBp(fromRupees(21_000), 75);
    expect(toRupees(raw)).toBe(157.5);
    expect(roundEsicContribution(raw)).toBe(fromRupees(158));
  });

  it('ER 3.25% of ₹21,000 = ₹682.50 → ₹683 (ceil)', () => {
    expect(roundEsicContribution(percentBp(fromRupees(21_000), 325))).toBe(fromRupees(683));
  });

  it('never rounds an exact rupee up further', () => {
    expect(roundEsicContribution(fromRupees(150))).toBe(fromRupees(150));
  });
});

describe('Gratuity — docs/10 §8 (G8 fixture, CORRECTED)', () => {
  it('₹32,286 × 15/26 × 9 years = ₹1,67,638.85 → ₹1,67,639', () => {
    // Hand-check: 32,286 × 15 × 9 = 4,358,610; ÷ 26 = 1,67,638.846…
    // NOTE: doc 10 §13 G8 originally printed ₹1,67,007.69 — an arithmetic slip
    // caught by this test; the doc has been corrected (see doc 10 change log).
    const oneStep = mulDiv(fromRupees(32_286), 15 * 9, 26);
    expect(toRupees(oneStep)).toBeCloseTo(167_638.85, 2);
    expect(roundGratuity(oneStep)).toBe(fromRupees(167_639));
  });
});

describe('OT — docs/10 §10.4 (G10 fixture)', () => {
  it('(28,000 / 208) × 2 × 4h = ₹1,076.92 → ₹1,077 default policy', () => {
    const otBase = fromRupees(28_000);
    // one rounding at the end: 28000×8/208 = 1076.923... (4h at 2× = ×8 hours-equivalent)
    const pay = mulDiv(otBase, 8, 208);
    expect(toRupees(pay)).toBeCloseTo(1076.92, 2);
    expect(roundOtPay(pay)).toBe(fromRupees(1077));
  });
});

describe('proration — mulDiv (G7 mid-month join pattern)', () => {
  it('₹64,573 × 17/31 = exactly ₹35,411.00 (calendar-day proration; 64,573×17 = 1,097,741 = 31×35,411)', () => {
    const prorated = mulDiv(fromRupees(64_573), 17, 31);
    expect(toRupees(prorated)).toBe(35_411);
  });

  it('rejects zero denominator and non-integer factors', () => {
    expect(() => mulDiv(fromRupees(100), 1, 0)).toThrow(RangeError);
    expect(() => mulDiv(fromRupees(100), 1.5, 2)).toThrow(TypeError);
  });
});

describe('rounding modes', () => {
  it('half_up at exactly .50 rupees goes up', () => {
    expect(roundToRupee(paise(150), 'half_up')).toBe(paise(200));
  });
  it('floor truncates', () => {
    expect(roundToRupee(paise(199), 'floor')).toBe(paise(100));
  });
  it('negative half_up rounds away from zero symmetric (−₹1.50 → −₹2)', () => {
    expect(roundToRupee(paise(-150), 'half_up')).toBe(paise(-200));
  });
});

describe('INR formatting — NFR-09 lakh/crore grouping', () => {
  it('₹1,23,456.78', () => {
    expect(formatINR(paise(12_345_678))).toBe('₹1,23,456.78');
  });
  it('₹1,00,00,000.00 (one crore)', () => {
    expect(formatINR(fromRupees(10_000_000))).toBe('₹1,00,00,000.00');
  });
});
