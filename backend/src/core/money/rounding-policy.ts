/**
 * THE single statutory rounding-policy file (docs/14 §2 Tier-1).
 *
 * Every statutory amount is rounded HERE, by name, with its legal source —
 * never ad-hoc at call sites. A rounding dispute with an auditor must be
 * answerable by pointing at one line of this file.
 *
 * Sources: docs/10 (India payroll statutory reference, FY 2025-26).
 */

import { roundToRupee, type Paise } from './money.js';

/**
 * EPF/EPS/EDLI contributions — nearest rupee (EPFO practice; docs/10 §2.2).
 * 12% × ₹32,286 = ₹3,874.32 → ₹3,874.
 */
export function roundPfContribution(amount: Paise): Paise {
  return roundToRupee(amount, 'half_up');
}

/**
 * ESIC contributions — ALWAYS rounded UP to the next rupee (ESIC Act rule;
 * docs/10 §3.2). 0.75% × ₹21,000 = ₹157.50 → ₹158.
 */
export function roundEsicContribution(amount: Paise): Paise {
  return roundToRupee(amount, 'ceil');
}

/**
 * Monthly TDS deduction — nearest rupee (s.288B Income-tax Act rounds tax to
 * the nearest ten rupees ANNUALLY at assessment; monthly deduction practice is
 * nearest rupee — docs/10 §6.3 `round(monthly_tds)`).
 */
export function roundMonthlyTds(amount: Paise): Paise {
  return roundToRupee(amount, 'half_up');
}

/**
 * Gratuity — nearest rupee (docs/10 §13 G8: ₹1,67,007.69 → ₹1,67,008).
 */
export function roundGratuity(amount: Paise): Paise {
  return roundToRupee(amount, 'half_up');
}

/**
 * Net pay on the payslip — nearest rupee is the default Indian payroll
 * practice; paise-precision components are preserved on the lines, the net is
 * rounded once at the end. Configurable later via core.settings if RML's
 * live register shows otherwise (verify in parallel run — R20).
 */
export function roundNetPay(amount: Paise): Paise {
  return roundToRupee(amount, 'half_up');
}

/**
 * OT pay — docs/10 §10.4 leaves rounding "per policy"; default nearest rupee.
 * The policy knob (`pay.ot_rounding`) can override to floor at Phase 2 if the
 * signed policy (P0-T06 #4) says so.
 */
export function roundOtPay(amount: Paise): Paise {
  return roundToRupee(amount, 'half_up');
}
