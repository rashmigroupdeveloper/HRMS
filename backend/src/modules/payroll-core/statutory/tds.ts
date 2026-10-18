/**
 * Income Tax / Tax Deducted at Source (TDS u/s 192) Engine (PAY-13).
 *
 * Implements:
 *  - Budget 2025/2026 New Regime slabs (default, s.115BAC) with ₹75k SD, s.87A rebate up to ₹12L & marginal relief.
 *  - Old Regime slabs with ₹50k SD, Chapter VI-A deductions & location-aware HRA exemption u/s 10(13A).
 *  - Annual taxable run rate projection across remaining FY months.
 *  - GreytHR ESS parity layout (Lines A through R).
 *  - Form 24Q quarterly summary & Form 16 Part B structure.
 *
 * Authoritative sources: docs/10 §6, docs/09 §3, Golden G5.
 * Rounding: Nearest rupee via roundMonthlyTds (docs/14 §2 Tier-1).
 */

import {
  type Paise,
  paise,
  mulDiv,
  min,
} from '../../../core/money/money.js';
import { roundMonthlyTds } from '../../../core/money/rounding-policy.js';

export type TaxRegime = 'new' | 'old';

export interface AnnualTaxResult {
  taxableIncomePaise: Paise;
  baseTaxPaise: Paise;
  rebate87aPaise: Paise;
  surchargePaise: Paise;
  cessPaise: Paise;
  totalTaxWithCessPaise: Paise;
}

export interface MonthlyTdsInput {
  annualTaxPaise: Paise;
  ytdTdsDeductedPaise: Paise;
  remainingMonths: number;
}

export interface HraExemptionInput {
  actualHraReceivedPaise: Paise;
  basicPaise: Paise;
  rentPaidPaise: Paise;
  isMetro?: boolean | undefined;
}

export interface ItStatementInput {
  grossSalaryPaise: Paise;
  standardDeductionPaise?: Paise | undefined;
  perquisitesPaise?: Paise | undefined;
  exemptionsSec10Paise?: Paise | undefined;
  previousEmployerIncomePaise?: Paise | undefined;
  incomeOtherSourcesPaise?: Paise | undefined;
  chapterViADeductionsPaise?: Paise | undefined;
  regime?: TaxRegime | undefined;
  ytdTaxPaidPaise?: Paise | undefined;
  remainingMonths?: number | undefined;
}

export interface ItStatementLayout {
  lineA_Income: Paise;
  lineB_PreTaxDeductions: Paise;
  lineC_Perquisites: Paise;
  lineD_ExcludedIncome: Paise;
  lineE_GrossSalary: Paise;
  lineF_ExemptionSec10: Paise;
  lineG_PreviousEmployerIncome: Paise;
  lineH_IncomeAfterExemption: Paise;
  lineI_StandardDeduction: Paise;
  lineJ_IncomeChargeableSalaries: Paise;
  lineK_OtherIncome: Paise;
  lineL_GrossTotalIncome: Paise;
  lineM_ChapterViADeductions: Paise;
  lineN_TaxableIncome: Paise;
  lineO_AnnualTax: Paise;
  lineP_TaxPaidTillDate: Paise;
  lineQ_BalancePayable: Paise;
  lineR_TdsCurrentMonth: Paise;
}

export interface Form24QRecord {
  pan: string;
  employeeName: string;
  grossSalaryPaise: Paise;
  tdsDeductedPaise: Paise;
  challanBsn?: string | undefined;
}

export interface Form24QSummary {
  financialYear: string;
  quarter: string;
  totalRecords: number;
  totalGrossSalaryPaise: Paise;
  totalTdsPaise: Paise;
  records: Form24QRecord[];
}

export const NEW_REGIME_SD_PAISE = paise(7500000); // ₹75,000
export const OLD_REGIME_SD_PAISE = paise(5000000); // ₹50,000

/**
 * Computes Annual Tax under New Regime (FY 2025-26 Budget 2025, s.115BAC):
 *  - 0 to 4,00,000: Nil
 *  - 4,00,001 to 8,00,000: 5%
 *  - 8,00,001 to 12,00,000: 10%
 *  - 12,00,001 to 16,00,000: 15%
 *  - 16,00,001 to 20,00,000: 20%
 *  - 20,00,001 to 24,00,000: 25%
 *  - Above 24,00,000: 30%
 *
 * Section 87A rebate:
 *  - Up to ₹60,000 if taxable income <= ₹12,00,000 (tax becomes ₹0).
 * Marginal relief:
 *  - If taxable income slightly exceeds ₹12,00,000, tax cannot exceed (taxable income - ₹12,00,000).
 * Cess:
 *  - 4% Health & Education Cess on net tax.
 */
function computeNewRegimeTax(taxableIncomePaise: Paise): AnnualTaxResult {
  if (taxableIncomePaise <= 0) {
    return {
      taxableIncomePaise,
      baseTaxPaise: paise(0),
      rebate87aPaise: paise(0),
      surchargePaise: paise(0),
      cessPaise: paise(0),
      totalTaxWithCessPaise: paise(0),
    };
  }

  let normalTax = 0;
  const slabs: { from: number; to: number; rateBp: number }[] = [
    { from: 0, to: 40000000, rateBp: 0 },
    { from: 40000000, to: 80000000, rateBp: 500 },
    { from: 80000000, to: 120000000, rateBp: 1000 },
    { from: 120000000, to: 160000000, rateBp: 1500 },
    { from: 160000000, to: 200000000, rateBp: 2000 },
    { from: 200000000, to: 240000000, rateBp: 2500 },
    { from: 240000000, to: Number.MAX_SAFE_INTEGER, rateBp: 3000 },
  ];

  for (const s of slabs) {
    if (taxableIncomePaise > s.from) {
      const taxableInSlab = Math.min(taxableIncomePaise, s.to) - s.from;
      if (taxableInSlab > 0 && s.rateBp > 0) {
        normalTax += Math.round((taxableInSlab * s.rateBp) / 10000);
      }
    }
  }

  let baseTaxPaise = paise(normalTax);
  let rebate87aPaise = paise(0);

  // Section 87A rebate & Marginal relief (Budget 2025: threshold ₹12,00,000, max rebate ₹60,000)
  const threshold12L = paise(120000000);
  if (taxableIncomePaise <= threshold12L) {
    rebate87aPaise = min(baseTaxPaise, paise(6000000));
  } else {
    // Marginal relief: if taxable income > 12L, tax cannot exceed the excess income over 12L
    const excessOver12L = paise(taxableIncomePaise - threshold12L);
    if (baseTaxPaise > excessOver12L) {
      baseTaxPaise = excessOver12L;
    }
  }

  const netTaxAfterRebate = Math.max(0, baseTaxPaise - rebate87aPaise);

  // Surcharge (10% > 50L, 15% > 1Cr, 25% > 2Cr)
  let surchargePaise = paise(0);
  const bands: [Paise, number][] = [[paise(2000000000), 25], [paise(1000000000), 15], [paise(500000000), 10]];
  const band = bands.find(([threshold]) => taxableIncomePaise > threshold);
  if (band) {
    const [threshold, pct] = band;
    surchargePaise = mulDiv(paise(netTaxAfterRebate), pct, 100);
    // Marginal relief: tax + surcharge may not exceed the tax at the threshold
    // (with that threshold's lower surcharge) plus the income above it.
    const atThreshold = computeNewRegimeTax(threshold);
    const ceiling = atThreshold.baseTaxPaise - atThreshold.rebate87aPaise + atThreshold.surchargePaise + (taxableIncomePaise - threshold);
    if (netTaxAfterRebate + surchargePaise > ceiling) surchargePaise = paise(Math.max(0, ceiling - netTaxAfterRebate));
  }

  // 4% Health & Education Cess
  const taxBeforeCess = netTaxAfterRebate + surchargePaise;
  const cessPaise = paise(Math.round(taxBeforeCess * 0.04));
  const totalTaxWithCessPaise = paise(taxBeforeCess + cessPaise);

  return {
    taxableIncomePaise,
    baseTaxPaise,
    rebate87aPaise,
    surchargePaise,
    cessPaise,
    totalTaxWithCessPaise,
  };
}

/**
 * Computes Annual Tax under Old Regime:
 *  - 0 to 2,50,000: Nil
 *  - 2,50,001 to 5,00,000: 5%
 *  - 5,00,001 to 10,00,000: 20%
 *  - Above 10,00,000: 30%
 *  - 87A rebate: max ₹12,500 if income <= ₹5,00,000
 *  - Surcharge 10% > ₹50L, 15% > ₹1Cr, 25% > ₹2Cr, 37% > ₹5Cr, with marginal relief
 *  - 4% cess
 */
function computeOldRegimeTax(taxableIncomePaise: Paise): AnnualTaxResult {
  if (taxableIncomePaise <= 0) {
    return {
      taxableIncomePaise,
      baseTaxPaise: paise(0),
      rebate87aPaise: paise(0),
      surchargePaise: paise(0),
      cessPaise: paise(0),
      totalTaxWithCessPaise: paise(0),
    };
  }

  let normalTax = 0;
  const slabs: { from: number; to: number; rateBp: number }[] = [
    { from: 0, to: 25000000, rateBp: 0 },
    { from: 25000000, to: 50000000, rateBp: 500 },
    { from: 50000000, to: 100000000, rateBp: 2000 },
    { from: 100000000, to: Number.MAX_SAFE_INTEGER, rateBp: 3000 },
  ];

  for (const s of slabs) {
    if (taxableIncomePaise > s.from) {
      const taxableInSlab = Math.min(taxableIncomePaise, s.to) - s.from;
      if (taxableInSlab > 0 && s.rateBp > 0) {
        normalTax += Math.round((taxableInSlab * s.rateBp) / 10000);
      }
    }
  }

  const baseTaxPaise = paise(normalTax);
  let rebate87aPaise = paise(0);

  if (taxableIncomePaise <= paise(50000000)) {
    rebate87aPaise = min(baseTaxPaise, paise(1250000));
  }

  const netTaxAfterRebate = Math.max(0, baseTaxPaise - rebate87aPaise);

  // Surcharge (old regime: 10% > 50L, 15% > 1Cr, 25% > 2Cr, 37% > 5Cr) with marginal relief:
  // tax + surcharge may not exceed the tax at the threshold (with its lower surcharge) plus the income above it.
  let surchargePaise = paise(0);
  const bands: [Paise, number][] = [[paise(5000000000), 37], [paise(2000000000), 25], [paise(1000000000), 15], [paise(500000000), 10]];
  const band = bands.find(([threshold]) => taxableIncomePaise > threshold);
  if (band) {
    const [threshold, pct] = band;
    surchargePaise = mulDiv(paise(netTaxAfterRebate), pct, 100);
    const atThreshold = computeOldRegimeTax(threshold);
    const ceiling = atThreshold.baseTaxPaise - atThreshold.rebate87aPaise + atThreshold.surchargePaise + (taxableIncomePaise - threshold);
    if (netTaxAfterRebate + surchargePaise > ceiling) surchargePaise = paise(Math.max(0, ceiling - netTaxAfterRebate));
  }

  const taxBeforeCess = netTaxAfterRebate + surchargePaise;
  const cessPaise = paise(Math.round(taxBeforeCess * 0.04));
  const totalTaxWithCessPaise = paise(taxBeforeCess + cessPaise);

  return {
    taxableIncomePaise,
    baseTaxPaise,
    rebate87aPaise,
    surchargePaise,
    cessPaise,
    totalTaxWithCessPaise,
  };
}

/**
 * Computes Annual Tax for a given taxable income under specified regime.
 */
export function computeAnnualTax(taxableIncomePaise: Paise, regime: TaxRegime = 'new'): AnnualTaxResult {
  return regime === 'new' ? computeNewRegimeTax(taxableIncomePaise) : computeOldRegimeTax(taxableIncomePaise);
}

/**
 * Computes monthly TDS deduction dividing remaining tax liability by remaining FY months.
 */
export function computeMonthlyTds(input: MonthlyTdsInput): Paise {
  const { annualTaxPaise, ytdTdsDeductedPaise, remainingMonths } = input;
  const effectiveMonths = Math.max(1, remainingMonths);
  const remainingTaxPaise = Math.max(0, annualTaxPaise - ytdTdsDeductedPaise);
  const monthlyShareRaw = Math.round(remainingTaxPaise / effectiveMonths);
  return roundMonthlyTds(paise(monthlyShareRaw));
}

/**
 * Computes location-aware HRA exemption u/s 10(13A) (min-of-three rule).
 * Used exclusively for Old Regime tax calculations.
 */
export function computeHraExemption(input: HraExemptionInput): Paise {
  const { actualHraReceivedPaise, basicPaise, rentPaidPaise, isMetro = false } = input;

  // 1. Actual HRA received
  const cond1 = actualHraReceivedPaise;

  // 2. Rent paid minus 10% of basic
  const tenPercentBasic = mulDiv(basicPaise, 10, 100);
  const cond2 = paise(Math.max(0, rentPaidPaise - tenPercentBasic));

  // 3. 50% of basic if metro, 40% if non-metro
  const rateBp = isMetro ? 5000 : 4000;
  const cond3 = mulDiv(basicPaise, rateBp, 10000);

  const minExempt = min(cond1, min(cond2, cond3));
  return roundMonthlyTds(minExempt);
}

/**
 * Generates greytHR ESS parity layout lines A through R (docs/10 §6.2).
 */
export function generateItStatementLines(input: ItStatementInput): ItStatementLayout {
  const {
    grossSalaryPaise,
    perquisitesPaise = paise(0),
    exemptionsSec10Paise = paise(0),
    previousEmployerIncomePaise = paise(0),
    incomeOtherSourcesPaise = paise(0),
    chapterViADeductionsPaise = paise(0),
    regime = 'new',
    ytdTaxPaidPaise = paise(0),
    remainingMonths = 12,
  } = input;
  // P-25: the standard deduction follows the regime (₹75k new, ₹50k old).
  const standardDeductionPaise = input.standardDeductionPaise ?? (regime === 'old' ? OLD_REGIME_SD_PAISE : NEW_REGIME_SD_PAISE);

  const lineA = grossSalaryPaise;
  const lineB = paise(0);
  const lineC = perquisitesPaise;
  const lineD = paise(0);
  const lineE = paise(lineA + lineC - lineD);
  const lineF = exemptionsSec10Paise;
  const lineG = previousEmployerIncomePaise;
  const lineH = paise(lineE - lineF + lineG);
  const lineI = standardDeductionPaise;
  const lineJ = paise(Math.max(0, lineH - lineI));
  const lineK = incomeOtherSourcesPaise;
  const lineL = paise(lineJ + lineK);
  const lineM = chapterViADeductionsPaise;
  const lineN = paise(Math.max(0, lineL - lineM));

  const taxResult = computeAnnualTax(lineN, regime);
  const lineO = taxResult.totalTaxWithCessPaise;
  const lineP = ytdTaxPaidPaise;
  const lineQ = paise(Math.max(0, lineO - lineP));
  const lineR = computeMonthlyTds({
    annualTaxPaise: lineO,
    ytdTdsDeductedPaise: lineP,
    remainingMonths,
  });

  return {
    lineA_Income: lineA,
    lineB_PreTaxDeductions: lineB,
    lineC_Perquisites: lineC,
    lineD_ExcludedIncome: lineD,
    lineE_GrossSalary: lineE,
    lineF_ExemptionSec10: lineF,
    lineG_PreviousEmployerIncome: lineG,
    lineH_IncomeAfterExemption: lineH,
    lineI_StandardDeduction: lineI,
    lineJ_IncomeChargeableSalaries: lineJ,
    lineK_OtherIncome: lineK,
    lineL_GrossTotalIncome: lineL,
    lineM_ChapterViADeductions: lineM,
    lineN_TaxableIncome: lineN,
    lineO_AnnualTax: lineO,
    lineP_TaxPaidTillDate: lineP,
    lineQ_BalancePayable: lineQ,
    lineR_TdsCurrentMonth: lineR,
  };
}

/**
 * Generates Form 24Q quarterly summary for statutory e-TDS filing preparation.
 */
export function generateForm24QSummary(
  financialYear: string,
  quarter: string,
  records: Form24QRecord[]
): Form24QSummary {
  let totalGross = 0;
  let totalTds = 0;

  for (const r of records) {
    totalGross += r.grossSalaryPaise;
    totalTds += r.tdsDeductedPaise;
  }

  return {
    financialYear,
    quarter,
    totalRecords: records.length,
    totalGrossSalaryPaise: paise(totalGross),
    totalTdsPaise: paise(totalTds),
    records,
  };
}
