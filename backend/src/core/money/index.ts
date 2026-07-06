/**
 * @module core/money — integer-paise money + the one statutory rounding policy.
 * Import money math ONLY from here (docs/14 §2). Floats never represent money.
 */
export {
  type Paise,
  type RoundingMode,
  ZERO,
  paise,
  fromRupees,
  toRupees,
  add,
  subtract,
  sum,
  isNegative,
  percentBp,
  mulDiv,
  roundToRupee,
  min,
  max,
  formatINR,
} from './money.js';

export {
  roundPfContribution,
  roundEsicContribution,
  roundMonthlyTds,
  roundGratuity,
  roundNetPay,
  roundOtPay,
} from './rounding-policy.js';
