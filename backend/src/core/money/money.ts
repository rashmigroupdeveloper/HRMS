/**
 * Money — integer paise, branded type (docs/14 §2 Tier-1).
 *
 * THE RULES:
 *  1. Money is ALWAYS an integer number of paise. Floats never represent money.
 *  2. All rounding goes through ONE policy file (./rounding-policy.ts) so every
 *     statutory rule is named, tested, and auditable.
 *  3. Percentages are expressed in BASIS POINTS (1 bp = 0.01%) so rates are
 *     integers too: PF 12% = 1200 bp, ESIC EE 0.75% = 75 bp, EPS 8.33% = 833 bp.
 *
 * Safe range: |amount| ≤ 2^53 / 10^4 paise ≈ ₹9 × 10^9 crore after bp products —
 * far beyond any payroll register. Guarded by assertions anyway.
 */

declare const PAISE_BRAND: unique symbol;
/** An integer amount in paise. Create only via `paise()` / `fromRupees()`. */
export type Paise = number & { readonly [PAISE_BRAND]: true };

/** Rounding modes for converting fractional intermediate values to integers. */
export type RoundingMode = 'half_up' | 'floor' | 'ceil';

const MAX_SAFE_PAISE = Number.MAX_SAFE_INTEGER / 10_000; // headroom for bp products

function assertSafe(n: number, what: string): void {
  if (!Number.isFinite(n)) throw new RangeError(`${what}: not finite (${n})`);
  if (Math.abs(n) > MAX_SAFE_PAISE) throw new RangeError(`${what}: exceeds safe money range (${n})`);
}

/** Assert-and-brand an integer paise value. */
export function paise(n: number): Paise {
  assertSafe(n, 'paise()');
  if (!Number.isInteger(n)) throw new TypeError(`paise(): expected integer paise, got ${n}`);
  return n as Paise;
}

export const ZERO: Paise = paise(0);

/**
 * Convert rupees (max 2 decimal places) to paise.
 * `fromRupees(0.1) + fromRupees(0.2) === fromRupees(0.3)` — guaranteed.
 */
export function fromRupees(rupees: number): Paise {
  assertSafe(rupees * 100, 'fromRupees()');
  const p = Math.round(rupees * 100);
  // Reject inputs that were never representable as paise (e.g. 1.005 of float error is fine;
  // 1.0001 rupees is not money).
  if (Math.abs(rupees * 100 - p) > 1e-6) {
    throw new TypeError(`fromRupees(): ${rupees} has more than 2 decimal places`);
  }
  return p as Paise;
}

/** Display-only conversion. NEVER feed the result back into calculations. */
export function toRupees(amount: Paise): number {
  return amount / 100;
}

export function add(a: Paise, b: Paise): Paise {
  return paise(a + b);
}

export function subtract(a: Paise, b: Paise): Paise {
  return paise(a - b);
}

export function sum(amounts: readonly Paise[]): Paise {
  return paise(amounts.reduce<number>((acc, a) => acc + a, 0));
}

export function isNegative(amount: Paise): boolean {
  return amount < 0;
}

function roundQuotient(numerator: number, denominator: number, mode: RoundingMode): number {
  const q = numerator / denominator;
  switch (mode) {
    case 'half_up':
      return Math.sign(q) * Math.round(Math.abs(q));
    case 'floor':
      return Math.floor(q);
    case 'ceil':
      return Math.ceil(q);
  }
}

/**
 * `rateBp` basis points of `amount` (integer math; one rounding at the end).
 * PF 12% of ₹32,286 → percentBp(fromRupees(32286), 1200) = 387,432 paise (₹3,874.32).
 */
export function percentBp(amount: Paise, rateBp: number, mode: RoundingMode = 'half_up'): Paise {
  if (!Number.isInteger(rateBp)) throw new TypeError(`percentBp(): rateBp must be integer, got ${rateBp}`);
  return paise(roundQuotient(amount * rateBp, 10_000, mode));
}

/**
 * amount × (num / den) with a single rounding — proration, hourly rates, splits.
 * e.g. monthly × payableDays/daysInMonth.
 */
export function mulDiv(amount: Paise, num: number, den: number, mode: RoundingMode = 'half_up'): Paise {
  if (!Number.isInteger(num) || !Number.isInteger(den)) {
    throw new TypeError(`mulDiv(): num/den must be integers, got ${num}/${den}`);
  }
  if (den === 0) throw new RangeError('mulDiv(): division by zero');
  assertSafe(amount * num, 'mulDiv() intermediate');
  return paise(roundQuotient(amount * num, den, mode));
}

/** Round to a whole rupee (result is still paise, a multiple of 100). */
export function roundToRupee(amount: Paise, mode: RoundingMode): Paise {
  return paise(roundQuotient(amount, 100, mode) * 100);
}

export function min(a: Paise, b: Paise): Paise {
  return a <= b ? a : b;
}

export function max(a: Paise, b: Paise): Paise {
  return a >= b ? a : b;
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Indian-grouped display string: 12345678 paise → "₹1,23,456.78" (NFR-09). */
export function formatINR(amount: Paise): string {
  return inrFormatter.format(amount / 100);
}
