/**
 * Employees' State Insurance Corporation (ESIC) Engine (PAY-10).
 *
 * Implements contribution period state machine (Apr-Sep / Oct-Mar), ₹21,000 eligibility gate,
 * round-UP contribution rules, and monthly return export.
 * Authoritative source: docs/10 §3, Golden G3.
 * Rounding: ALWAYS round UP to next rupee via roundEsicContribution (docs/14 §2 Tier-1).
 */

import {
  type Paise,
  paise,
  mulDiv,
} from '../../../core/money/money.js';
import { roundEsicContribution } from '../../../core/money/rounding-policy.js';

export type EsicPeriodType = 'H1' | 'H2';

export interface EsicPeriodInfo {
  period: EsicPeriodType;
  periodStartMonth: string; // 'YYYY-MM'
  periodEndMonth: string; // 'YYYY-MM'
  benefitPeriodStart: string;
  benefitPeriodEnd: string;
}

export interface EsicComputeResult {
  isEligible: boolean;
  eeEsicPaise: Paise;
  erEsicPaise: Paise;
  grossWagesPaise: Paise;
}

export interface EsicReturnInput {
  ipNumber: string;
  ipName: string;
  daysWorked: number;
  totalMonthlyWagesPaise: Paise;
  eeContributionPaise: Paise;
  reasonForZeroDays?: string | undefined;
}

export const STATUTORY_ESIC_CEILING_PAISE = paise(2100000); // ₹21,000

/**
 * Resolves the statutory 6-month ESIC contribution period for any date.
 * H1: Apr 1 – Sep 30
 * H2: Oct 1 – Mar 31
 */
export function getEsicPeriod(dateOrMonth: string | Date): EsicPeriodInfo {
  const d = typeof dateOrMonth === 'string' ? new Date(dateOrMonth) : dateOrMonth;
  const month = d.getUTCMonth() + 1; // 1-12
  const year = d.getUTCFullYear();

  if (month >= 4 && month <= 9) {
    return {
      period: 'H1',
      periodStartMonth: `${year}-04`,
      periodEndMonth: `${year}-09`,
      benefitPeriodStart: `${year + 1}-01-01`,
      benefitPeriodEnd: `${year + 1}-06-30`,
    };
  }

  // Oct to Mar
  const startYear = month >= 10 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    period: 'H2',
    periodStartMonth: `${startYear}-10`,
    periodEndMonth: `${endYear}-03`,
    benefitPeriodStart: `${endYear}-07-01`,
    benefitPeriodEnd: `${endYear}-12-31`,
  };
}

/**
 * Evaluates ESIC eligibility at the entry/start of the contribution period.
 * Under ESIC Act, eligibility is frozen at period start.
 */
export function isEsicEligibleAtPeriodStart(
  grossAtStartPaise: Paise,
  ceilingPaise: Paise = STATUTORY_ESIC_CEILING_PAISE
): boolean {
  return grossAtStartPaise <= ceilingPaise;
}

/**
 * Computes monthly EE (0.75%) and ER (3.25%) ESIC deductions.
 * ESIC Act rule: ALWAYS round UP to next rupee.
 */
export function computeEsic(
  grossWagesPaise: Paise,
  isEligibleForPeriod: boolean
): EsicComputeResult {
  if (!isEligibleForPeriod || grossWagesPaise <= 0) {
    return {
      isEligible: isEligibleForPeriod,
      eeEsicPaise: paise(0),
      erEsicPaise: paise(0),
      grossWagesPaise,
    };
  }

  // EE rate = 0.75% = 75 basis points, rounded UP
  const rawEePaise = mulDiv(grossWagesPaise, 75, 10000, 'ceil');
  const eeEsicPaise = roundEsicContribution(rawEePaise);

  // ER rate = 3.25% = 325 basis points, rounded UP
  const rawErPaise = mulDiv(grossWagesPaise, 325, 10000, 'ceil');
  const erEsicPaise = roundEsicContribution(rawErPaise);

  return {
    isEligible: true,
    eeEsicPaise,
    erEsicPaise,
    grossWagesPaise,
  };
}

/**
 * Generates monthly ESIC return file text formatted for the ESIC employer portal.
 */
export function generateEsicMonthlyReturn(records: EsicReturnInput[]): string {
  const header = 'IP Number,IP Name,No of Days Worked,Total Monthly Wages,IP Contribution,Reason';
  const rows = records.map((r) => {
    const wageStr = (r.totalMonthlyWagesPaise / 100).toFixed(2);
    const eeStr = (r.eeContributionPaise / 100).toFixed(2);
    const reason = r.reasonForZeroDays ?? '';
    return `${r.ipNumber},${r.ipName},${r.daysWorked},${wageStr},${eeStr},${reason}`;
  });

  return [header, ...rows].join('\n');
}
