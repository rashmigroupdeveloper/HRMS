/**
 * Payment of Bonus Act, 1965 Annual True-up Engine (PAY-17, doc 10 §7, SOW crosswalk).
 *
 * Implements statutory annual bonus computation:
 * - Eligibility: Basic + DA <= ₹21,000/month & >= 30 working days in accounting year.
 * - Calculation Wage: min(Basic, max(₹7,000, State Minimum Wage)).
 * - Statutory Entitlement: between 8.33% (minimum) and 20.00% (maximum) based on Allocable Surplus.
 * - Monthly Advances Offset: 12 months of paid monthly advances offset.
 * - Net True-up: Net payable or recoverable balance.
 * - Section 15: Set-on and Set-off reserve accounting across up to 4 accounting years.
 */

import { fromRupees, toRupees, ZERO, add, subtract, paise, type Paise } from '../../../core/money/index.js';

export interface EmployeeBonusInput {
  employeeId: number;
  ecode: string;
  name: string;
  monthlyBasicRupees: number;
  workingDaysInYear: number;
  totalWorkingDaysInYear: number; // typically 365 or 300
  monthlyAdvancesPaidRupees: number; // 8.33% advance paid across the year
}

export interface EmployeeBonusResult {
  employeeId: number;
  ecode: string;
  name: string;
  isEligible: boolean;
  ineligibilityReason?: string;
  calculationBaseMonthlyPaise: Paise;
  annualCalculationWagePaise: Paise;
  bonusRatePercent: number;
  annualEntitlementPaise: Paise;
  advancesPaidPaise: Paise;
  netTrueupPaise: Paise; // positive = payable, negative = recoverable
  action: 'payable' | 'recoverable' | 'settled';
}

export interface SetOnSetOffLedger {
  accountingYear: string;
  allocableSurplusPercent: number;
  setOnCarriedForwardPaise: Paise;
  setOffCarriedForwardPaise: Paise;
  yearExpiry: number; // 4-year limit
}

export interface BonusTrueupSummary {
  accountingYear: string;
  declaredSurplusRatePercent: number;
  minimumWageMonthlyRupees: number;
  calculationCeilingMonthlyRupees: number;
  totalEmployeesEvaluated: number;
  eligibleEmployeesCount: number;
  totalAnnualEntitlementRupees: number;
  totalAdvancesPaidRupees: number;
  netPayableRupees: number;
  netRecoverableRupees: number;
  setOnReserveRupees: number;
  setOffReserveRupees: number;
  results: EmployeeBonusResult[];
}

export const BonusTrueupEngine = {
  // Statutory limits per Payment of Bonus Act, 1965
  ELIGIBILITY_CEILING_MONTHLY_PAISE: paise(2100000), // ₹21,000
  STATUTORY_CALC_CEILING_MONTHLY_PAISE: paise(700000), // ₹7,000
  MINIMUM_BONUS_PERCENT: 8.33,
  MAXIMUM_BONUS_PERCENT: 20.0,
  MINIMUM_WORKING_DAYS: 30,

  /**
   * Computes statutory annual bonus true-up for an establishment.
   */
  computeBonusTrueup(
    accountingYear: string,
    declaredSurplusPercent: number,
    stateMinimumWageMonthlyRupees: number,
    employees: EmployeeBonusInput[],
    priorSetOnSetOff?: SetOnSetOffLedger
  ): BonusTrueupSummary {
    // 1. Determine effective calculation rate (clamped to 8.33% - 20.00%)
    let effectiveRate = declaredSurplusPercent;
    if (effectiveRate < this.MINIMUM_BONUS_PERCENT) effectiveRate = this.MINIMUM_BONUS_PERCENT;
    if (effectiveRate > this.MAXIMUM_BONUS_PERCENT) effectiveRate = this.MAXIMUM_BONUS_PERCENT;

    const minWagePaise = fromRupees(stateMinimumWageMonthlyRupees);
    // Calculation ceiling is max(₹7,000, state min wage)
    const effectiveCalcCeilingPaise =
      minWagePaise > this.STATUTORY_CALC_CEILING_MONTHLY_PAISE
        ? minWagePaise
        : this.STATUTORY_CALC_CEILING_MONTHLY_PAISE;

    const results: EmployeeBonusResult[] = [];
    let eligibleCount = 0;
    let sumEntitlement: Paise = ZERO;
    let sumAdvances: Paise = ZERO;
    let sumPayable: Paise = ZERO;
    let sumRecoverable: Paise = ZERO;

    for (const emp of employees) {
      const basicPaise = fromRupees(emp.monthlyBasicRupees);
      const advancesPaise = fromRupees(emp.monthlyAdvancesPaidRupees);

      // Check eligibility:
      // a) Minimum 30 working days in the accounting year (Sec 8)
      if (emp.workingDaysInYear < this.MINIMUM_WORKING_DAYS) {
        results.push({
          employeeId: emp.employeeId,
          ecode: emp.ecode,
          name: emp.name,
          isEligible: false,
          ineligibilityReason: `Less than 30 working days (${emp.workingDaysInYear} days)`,
          calculationBaseMonthlyPaise: ZERO,
          annualCalculationWagePaise: ZERO,
          bonusRatePercent: 0,
          annualEntitlementPaise: ZERO,
          advancesPaidPaise: advancesPaise,
          netTrueupPaise: subtract(ZERO, advancesPaise),
          action: advancesPaise > ZERO ? 'recoverable' : 'settled',
        });
        if (advancesPaise > ZERO) {
          sumRecoverable = add(sumRecoverable, advancesPaise);
        }
        continue;
      }

      // b) Monthly Basic + DA <= ₹21,000 (Sec 2(13))
      if (basicPaise > this.ELIGIBILITY_CEILING_MONTHLY_PAISE) {
        results.push({
          employeeId: emp.employeeId,
          ecode: emp.ecode,
          name: emp.name,
          isEligible: false,
          ineligibilityReason: `Monthly Basic ₹${emp.monthlyBasicRupees} exceeds statutory eligibility ceiling ₹21,000`,
          calculationBaseMonthlyPaise: ZERO,
          annualCalculationWagePaise: ZERO,
          bonusRatePercent: 0,
          annualEntitlementPaise: ZERO,
          advancesPaidPaise: advancesPaise,
          netTrueupPaise: subtract(ZERO, advancesPaise),
          action: advancesPaise > ZERO ? 'recoverable' : 'settled',
        });
        if (advancesPaise > ZERO) {
          sumRecoverable = add(sumRecoverable, advancesPaise);
        }
        continue;
      }

      eligibleCount++;

      // Calculation wage per month: min(actual Basic, calculation ceiling)
      const monthlyCalcWagePaise =
        basicPaise < effectiveCalcCeilingPaise ? basicPaise : effectiveCalcCeilingPaise;

      // Annual calculation wage prorated by days worked
      const daysRatio =
        emp.totalWorkingDaysInYear > 0
          ? emp.workingDaysInYear / emp.totalWorkingDaysInYear
          : 1.0;
      const annualizedCalcWagePaise = paise(
        Math.round(monthlyCalcWagePaise * 12 * Math.min(daysRatio, 1.0))
      );

      // Annual entitlement = Annual wage * effective rate
      const entitlementPaise = paise(
        Math.round((annualizedCalcWagePaise * effectiveRate) / 100)
      );

      // Net True-up = Entitlement - Advances Paid
      const netTrueupPaise = subtract(entitlementPaise, advancesPaise);

      let action: 'payable' | 'recoverable' | 'settled' = 'settled';
      if (netTrueupPaise > ZERO) {
        action = 'payable';
        sumPayable = add(sumPayable, netTrueupPaise);
      } else if (netTrueupPaise < ZERO) {
        action = 'recoverable';
        sumRecoverable = add(sumRecoverable, subtract(ZERO, netTrueupPaise));
      }

      sumEntitlement = add(sumEntitlement, entitlementPaise);
      sumAdvances = add(sumAdvances, advancesPaise);

      results.push({
        employeeId: emp.employeeId,
        ecode: emp.ecode,
        name: emp.name,
        isEligible: true,
        calculationBaseMonthlyPaise: monthlyCalcWagePaise,
        annualCalculationWagePaise: annualizedCalcWagePaise,
        bonusRatePercent: effectiveRate,
        annualEntitlementPaise: entitlementPaise,
        advancesPaidPaise: advancesPaise,
        netTrueupPaise,
        action,
      });
    }

    // Section 15 Set-on / Set-off Reserve Calculation:
    let setOnReservePaise: Paise = ZERO;
    let setOffReservePaise: Paise = ZERO;

    if (declaredSurplusPercent > this.MAXIMUM_BONUS_PERCENT) {
      // Surplus above 20% is carried forward as Set-On (capped at 20% of wages)
      const excessRate = Math.min(declaredSurplusPercent - this.MAXIMUM_BONUS_PERCENT, this.MAXIMUM_BONUS_PERCENT);
      setOnReservePaise = paise(
        Math.round((sumEntitlement / effectiveRate) * excessRate)
      );
    } else if (declaredSurplusPercent < this.MINIMUM_BONUS_PERCENT) {
      // Deficit below 8.33% is carried forward as Set-Off
      const deficitRate = this.MINIMUM_BONUS_PERCENT - declaredSurplusPercent;
      setOffReservePaise = paise(
        Math.round((sumEntitlement / effectiveRate) * deficitRate)
      );
    }

    // Offset against prior year reserve if exists
    if (priorSetOnSetOff) {
      if (priorSetOnSetOff.setOnCarriedForwardPaise > ZERO && setOffReservePaise > ZERO) {
        if (priorSetOnSetOff.setOnCarriedForwardPaise >= setOffReservePaise) {
          setOffReservePaise = ZERO;
        } else {
          setOffReservePaise = subtract(setOffReservePaise, priorSetOnSetOff.setOnCarriedForwardPaise);
        }
      }
    }

    return {
      accountingYear,
      declaredSurplusRatePercent: effectiveRate,
      minimumWageMonthlyRupees: stateMinimumWageMonthlyRupees,
      calculationCeilingMonthlyRupees: toRupees(effectiveCalcCeilingPaise),
      totalEmployeesEvaluated: employees.length,
      eligibleEmployeesCount: eligibleCount,
      totalAnnualEntitlementRupees: toRupees(sumEntitlement),
      totalAdvancesPaidRupees: toRupees(sumAdvances),
      netPayableRupees: toRupees(sumPayable),
      netRecoverableRupees: toRupees(sumRecoverable),
      setOnReserveRupees: toRupees(setOnReservePaise),
      setOffReserveRupees: toRupees(setOffReservePaise),
      results,
    };
  }
}
