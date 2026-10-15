/**
 * Payroll Proration Engine (PAY-04, docs/04 §3 B-C, SOW crosswalk).
 *
 * All calculations use integer-paise `Paise` from `core/money`. Zero float arithmetic.
 *
 * Rules:
 *   - `days_in_month`: Calendar days (28, 29, 30, 31) or fixed 30-day divisor per policy.
 *   - `payable_days`: P + HD×0.5 + paid-WO + H + paid-L + OD + CO.
 *   - `lop_days`: days_in_month - payable_days (unpaid week-offs, LWP, UAB).
 *   - For components with `prorate_on_lop: true`:
 *       prorated = mulDiv(component_paise, payable_days × 100, days_in_month × 100)
 *   - For components with `prorate_on_lop: false`:
 *       prorated = component_paise
 */

import { type Paise, paise, mulDiv } from '../../../core/money/index.js';

export interface ProrationInput {
  componentCode: string;
  monthlyAmountPaise: Paise;
  prorateOnLop: boolean;
  daysInMonth: number;
  payableDays: number;
}

export interface ProrationResult {
  componentCode: string;
  baseAmountPaise: Paise;
  proratedAmountPaise: Paise;
  lopDays: number;
  payableRatio: string;
  calcNote: string;
}

export interface AttendanceProrationSummary {
  daysInMonth: number;
  payableDays: number;
  lopDays: number;
  lopReversalDays: number;
  netPayableDays: number;
}

/**
 * Compute attendance days summary for a payroll month.
 */
export function computeAttendanceSummary(
  year: number,
  month: number, // 1-12
  payableDays: number,
  lopReversalDays = 0,
  policyDivisor?: number
): AttendanceProrationSummary {
  const calendarDays = new Date(year, month, 0).getDate();
  const daysInMonth = policyDivisor ?? calendarDays;
  const effectivePayable = Math.min(daysInMonth, Math.max(0, payableDays + lopReversalDays));
  const lopDays = Math.max(0, daysInMonth - effectivePayable);

  return {
    daysInMonth,
    payableDays,
    lopDays,
    lopReversalDays,
    netPayableDays: effectivePayable,
  };
}

/**
 * Prorate a single component amount based on attendance.
 */
export function prorateComponent(input: ProrationInput): ProrationResult {
  const { componentCode, monthlyAmountPaise, prorateOnLop, daysInMonth, payableDays } = input;

  if (!prorateOnLop || payableDays >= daysInMonth) {
    return {
      componentCode,
      baseAmountPaise: monthlyAmountPaise,
      proratedAmountPaise: monthlyAmountPaise,
      lopDays: 0,
      payableRatio: '1.0',
      calcNote: prorateOnLop
        ? `Full attendance (${String(payableDays)}/${String(daysInMonth)} days)`
        : `Non-prorated component (fixed)`,
    };
  }

  if (payableDays <= 0) {
    return {
      componentCode,
      baseAmountPaise: monthlyAmountPaise,
      proratedAmountPaise: paise(0),
      lopDays: daysInMonth,
      payableRatio: '0.0',
      calcNote: `Full month LOP (0/${String(daysInMonth)} payable days)`,
    };
  }

  // Integer-paise scaling: multiply by payableDays*100, divide by daysInMonth*100
  // to preserve half-day precision (e.g. 25.5 days)
  const payableCentidays = Math.round(payableDays * 100);
  const monthCentidays = Math.round(daysInMonth * 100);

  const proratedAmountPaise = mulDiv(monthlyAmountPaise, payableCentidays, monthCentidays);
  const lopDays = Math.max(0, daysInMonth - payableDays);

  return {
    componentCode,
    baseAmountPaise: monthlyAmountPaise,
    proratedAmountPaise,
    lopDays,
    payableRatio: `${String(payableDays)}/${String(daysInMonth)}`,
    calcNote: `Prorated: ₹${(monthlyAmountPaise / 100).toFixed(2)} × ${String(payableDays)}/${String(daysInMonth)} days (${String(lopDays)} LOP days)`,
  };
}

/**
 * Prorate a batch of components for an employee.
 */
export function prorateComponents(
  components: { code: string; monthlyPaise: Paise; prorateOnLop: boolean }[],
  summary: AttendanceProrationSummary
): Map<string, ProrationResult> {
  const results = new Map<string, ProrationResult>();

  for (const comp of components) {
    const res = prorateComponent({
      componentCode: comp.code,
      monthlyAmountPaise: comp.monthlyPaise,
      prorateOnLop: comp.prorateOnLop,
      daysInMonth: summary.daysInMonth,
      payableDays: summary.netPayableDays,
    });
    results.set(comp.code, res);
  }

  return results;
}
