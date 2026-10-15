/**
 * Loan Amortization & Perquisite Valuation Engine (M11, LN-01..04)
 *
 * Implements strict integer-paise loan schedules:
 * 1. Reducing balance (diminishing)
 * 2. Flat rate
 * 3. Equal installments without interest
 * 4. Salary advance (short-term)
 * 5. Section 17(2) SBI benchmark perquisite tax valuation
 *
 * Invariant: Sum of principal repayments in the schedule ALWAYS equals the initial principal to the exact paise.
 */
import {
  type Paise,
  paise,
  add,
  subtract,
  toRupees,
  ZERO,
} from '../../core/money/index.js';

export type ScheduleLoanType =
  | 'loan_diminishing'
  | 'loan_flat'
  | 'emi_no_interest'
  | 'salary_advance'
  | 'travel_advance';

export interface InstallmentScheduleItem {
  installmentNumber: number;
  principalPart: Paise;
  interestPart: Paise;
  totalEmi: Paise;
  closingOutstanding: Paise;
  perquisiteValue: Paise;
}

export interface AmortizationSchedule {
  loanType: ScheduleLoanType;
  principal: Paise;
  annualInterestRate: number;
  tenureMonths: number;
  monthlyEmi: Paise;
  totalInterest: Paise;
  totalPayment: Paise;
  schedule: InstallmentScheduleItem[];
}

export interface PerquisiteParams {
  closingBalance: Paise;
  employerRatePercent: number;
  sbiBenchmarkRatePercent: number;
  originalPrincipal: Paise;
  isMedicalExempt?: boolean;
}

/**
 * Calculates perquisite value under Income Tax Section 17(2) / Rule 3(7)(i).
 * - Exempt if aggregate loan <= Rs 20,000 (2,000,000 paise).
 * - Exempt if for specified diseases (medical exempt).
 * - Otherwise: max(0, closingBalance * (SBI rate - employer rate) / 12).
 */
export function calculateMonthlyPerquisite(params: PerquisiteParams): Paise {
  const {
    closingBalance,
    employerRatePercent,
    sbiBenchmarkRatePercent,
    originalPrincipal,
    isMedicalExempt = false,
  } = params;

  // Rule 3(7)(i) exemption threshold: loans not exceeding Rs 20,000 in aggregate
  const EXEMPT_THRESHOLD = paise(2000000); // Rs 20,000 in paise
  if (originalPrincipal <= EXEMPT_THRESHOLD || isMedicalExempt) {
    return ZERO;
  }

  const rateDiff = sbiBenchmarkRatePercent - employerRatePercent;
  if (rateDiff <= 0 || closingBalance <= ZERO) {
    return ZERO;
  }

  // Monthly rate = rateDiff / 1200
  const perquisitePaise = Math.round((Number(closingBalance) * rateDiff) / 1200);
  return paise(Math.max(0, perquisitePaise));
}

/**
 * Generates exact repayment schedule and perquisite valuation for any loan type.
 */
export function generateAmortizationSchedule(options: {
  loanType: ScheduleLoanType;
  principal: Paise;
  annualInterestRate: number; // e.g., 8.5 for 8.5%
  tenureMonths: number;
  sbiBenchmarkRatePercent?: number; // default 8.5%
  isMedicalExempt?: boolean;
}): AmortizationSchedule {
  const {
    loanType,
    principal,
    annualInterestRate,
    tenureMonths,
    sbiBenchmarkRatePercent = 8.5,
    isMedicalExempt = false,
  } = options;

  if (tenureMonths <= 0) {
    throw new Error('Loan tenure must be at least 1 month');
  }
  if (principal <= ZERO) {
    throw new Error('Loan principal must be greater than zero');
  }

  switch (loanType) {
    case 'loan_diminishing':
      return generateDiminishingSchedule({
        principal,
        annualInterestRate,
        tenureMonths,
        sbiBenchmarkRatePercent,
        isMedicalExempt,
      });

    case 'loan_flat':
      return generateFlatSchedule({
        principal,
        annualInterestRate,
        tenureMonths,
        sbiBenchmarkRatePercent,
        isMedicalExempt,
      });

    case 'emi_no_interest':
    case 'salary_advance':
    case 'travel_advance':
      return generateZeroInterestSchedule({
        loanType,
        principal,
        tenureMonths,
        sbiBenchmarkRatePercent,
        isMedicalExempt,
      });
  }
}

function generateDiminishingSchedule(opts: {
  principal: Paise;
  annualInterestRate: number;
  tenureMonths: number;
  sbiBenchmarkRatePercent: number;
  isMedicalExempt: boolean;
}): AmortizationSchedule {
  const { principal, annualInterestRate, tenureMonths, sbiBenchmarkRatePercent, isMedicalExempt } = opts;

  if (annualInterestRate === 0) {
    return generateZeroInterestSchedule({
      loanType: 'loan_diminishing',
      principal,
      tenureMonths,
      sbiBenchmarkRatePercent,
      isMedicalExempt,
    });
  }

  const monthlyRate = annualInterestRate / 1200;
  // Standard EMI formula: P * r * (1+r)^n / ((1+r)^n - 1)
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const nominalEmiPaise = Math.round((Number(principal) * monthlyRate * factor) / (factor - 1));

  const schedule: InstallmentScheduleItem[] = [];
  let currentOutstanding = principal;
  let totalInterest = ZERO;
  let totalPayment = ZERO;

  for (let m = 1; m <= tenureMonths; m++) {
    const isFinalMonth = m === tenureMonths;
    const interestPaise = Math.round(Number(currentOutstanding) * monthlyRate);
    const interestPart = paise(interestPaise);

    let principalPart: Paise;
    let emi: Paise;

    if (isFinalMonth) {
      // In the final month, clear the exact remaining principal to avoid residual paise
      principalPart = currentOutstanding;
      emi = add(principalPart, interestPart);
      currentOutstanding = ZERO;
    } else {
      principalPart = paise(Math.min(Number(currentOutstanding), nominalEmiPaise - interestPaise));
      emi = add(principalPart, interestPart);
      currentOutstanding = subtract(currentOutstanding, principalPart);
    }

    const perquisiteValue = calculateMonthlyPerquisite({
      closingBalance: currentOutstanding,
      employerRatePercent: annualInterestRate,
      sbiBenchmarkRatePercent,
      originalPrincipal: principal,
      isMedicalExempt,
    });

    schedule.push({
      installmentNumber: m,
      principalPart,
      interestPart,
      totalEmi: emi,
      closingOutstanding: currentOutstanding,
      perquisiteValue,
    });

    totalInterest = add(totalInterest, interestPart);
    totalPayment = add(totalPayment, emi);
  }

  return {
    loanType: 'loan_diminishing',
    principal,
    annualInterestRate,
    tenureMonths,
    monthlyEmi: paise(nominalEmiPaise),
    totalInterest,
    totalPayment,
    schedule,
  };
}

function generateFlatSchedule(opts: {
  principal: Paise;
  annualInterestRate: number;
  tenureMonths: number;
  sbiBenchmarkRatePercent: number;
  isMedicalExempt: boolean;
}): AmortizationSchedule {
  const { principal, annualInterestRate, tenureMonths, sbiBenchmarkRatePercent, isMedicalExempt } = opts;

  // Total Interest = Principal * (annualRate / 100) * (tenureMonths / 12)
  const totalInterestPaise = Math.round(
    (Number(principal) * annualInterestRate * tenureMonths) / 1200
  );
  const totalInterest = paise(totalInterestPaise);

  const basePrincipalPaise = Math.floor(Number(principal) / tenureMonths);
  const principalRemainder = Number(principal) % tenureMonths;

  const baseInterestPaise = Math.floor(totalInterestPaise / tenureMonths);
  const interestRemainder = totalInterestPaise % tenureMonths;

  const schedule: InstallmentScheduleItem[] = [];
  let currentOutstanding = principal;
  let totalPayment = ZERO;

  for (let m = 1; m <= tenureMonths; m++) {
    const isFinalMonth = m === tenureMonths;
    const principalPart = paise(basePrincipalPaise + (isFinalMonth ? principalRemainder : 0));
    const interestPart = paise(baseInterestPaise + (isFinalMonth ? interestRemainder : 0));
    const emi = add(principalPart, interestPart);

    currentOutstanding = subtract(currentOutstanding, principalPart);

    const perquisiteValue = calculateMonthlyPerquisite({
      closingBalance: currentOutstanding,
      employerRatePercent: annualInterestRate,
      sbiBenchmarkRatePercent,
      originalPrincipal: principal,
      isMedicalExempt,
    });

    schedule.push({
      installmentNumber: m,
      principalPart,
      interestPart,
      totalEmi: emi,
      closingOutstanding: currentOutstanding,
      perquisiteValue,
    });

    totalPayment = add(totalPayment, emi);
  }

  const standardEmi = paise(basePrincipalPaise + baseInterestPaise);

  return {
    loanType: 'loan_flat',
    principal,
    annualInterestRate,
    tenureMonths,
    monthlyEmi: standardEmi,
    totalInterest,
    totalPayment,
    schedule,
  };
}

function generateZeroInterestSchedule(opts: {
  loanType: ScheduleLoanType;
  principal: Paise;
  tenureMonths: number;
  sbiBenchmarkRatePercent: number;
  isMedicalExempt: boolean;
}): AmortizationSchedule {
  const { loanType, principal, tenureMonths, sbiBenchmarkRatePercent, isMedicalExempt } = opts;

  const basePrincipalPaise = Math.floor(Number(principal) / tenureMonths);
  const principalRemainder = Number(principal) % tenureMonths;

  const schedule: InstallmentScheduleItem[] = [];
  let currentOutstanding = principal;

  for (let m = 1; m <= tenureMonths; m++) {
    const isFinalMonth = m === tenureMonths;
    const principalPart = paise(basePrincipalPaise + (isFinalMonth ? principalRemainder : 0));
    const interestPart = ZERO;
    const emi = principalPart;

    currentOutstanding = subtract(currentOutstanding, principalPart);

    const perquisiteValue = calculateMonthlyPerquisite({
      closingBalance: currentOutstanding,
      employerRatePercent: 0,
      sbiBenchmarkRatePercent,
      originalPrincipal: principal,
      isMedicalExempt,
    });

    schedule.push({
      installmentNumber: m,
      principalPart,
      interestPart,
      totalEmi: emi,
      closingOutstanding: currentOutstanding,
      perquisiteValue,
    });
  }

  return {
    loanType,
    principal,
    annualInterestRate: 0,
    tenureMonths,
    monthlyEmi: paise(basePrincipalPaise),
    totalInterest: ZERO,
    totalPayment: principal,
    schedule,
  };
}

/** Formatter helper for UI / reports */
export function formatLoanAmount(amount: Paise): string {
  return `₹${toRupees(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
