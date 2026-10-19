/**
 * Gratuity Calculator — Payment of Gratuity Act, 1972 (PAY-15, Golden G8, docs/10 §13).
 *
 * Rules:
 * 1. Eligibility: Continuous service >= 4 years 240 days (approx 4.66 years / 5 continuous years).
 * 2. Service tenure rounding: Any service fraction >= 6 months rounds UP to next full year.
 *    (e.g., 8 years 7 months -> 9 years).
 * 3. Calculation formula: (15 * (Basic + DA) * completed_years) / 26.
 * 4. Statutory ceiling: Maximum ₹20,00,000 (₹20 Lakhs).
 * 5. Fixture G8 test: Basic ₹32,286, DA ₹0, 8y 7m service -> 9 years:
 *    (32,286 * 15 * 9) / 26 = 1,67,638.846... -> rounds to ₹1,67,639.
 */

export interface GratuityCalculationInput {
  basicMonthlyPaise: number; // in paise
  daMonthlyPaise?: number; // in paise (defaults to 0)
  doj: Date | string; // Date of Joining
  lastWorkingDay: Date | string; // Approved LWD / Date of Leaving
  statutoryCapPaise?: number; // defaults to 20,00,000 * 100 paise
  /** Payment of Gratuity Act s.4 proviso: death does not need five years. */
  waiveMinimumService?: boolean | undefined;
}

export interface GratuityCalculationResult {
  isEligible: boolean;
  serviceYearsExact: number;
  completedYearsRounded: number;
  basicPlusDaMonthlyPaise: number;
  gratuityPaise: number;
  gratuityRupees: number;
  cappedAtCeiling: boolean;
  calcNote: string;
}

const STATUTORY_GRATUITY_CAP_PAISE = 2000000 * 100; // ₹20 Lakhs

export function calculateServiceTenure(dojInput: Date | string, lwdInput: Date | string): {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  exactYears: number;
  completedYearsForGratuity: number;
  isEligible: boolean;
} {
  const doj = new Date(dojInput);
  const lwd = new Date(lwdInput);

  if (lwd < doj) {
    throw new Error('Last working day cannot be before date of joining');
  }

  const diffTime = lwd.getTime() - doj.getTime();
  const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of both ends

  let years = lwd.getFullYear() - doj.getFullYear();
  let months = lwd.getMonth() - doj.getMonth();
  let days = lwd.getDate() - doj.getDate();

  if (days < 0) {
    months -= 1;
    // previous month days
    const prevMonth = new Date(lwd.getFullYear(), lwd.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const exactYears = Number((totalDays / 365.25).toFixed(2));

  // Eligibility rule: >= 4 years 240 days (or 5 years). Total days threshold: (4 * 365) + 240 = 1700 days.
  const isEligible = totalDays >= 1700 || exactYears >= 4.66;

  // Fraction rule: if remaining months >= 6, round UP to next full year
  let completedYearsForGratuity = years;
  if (months >= 6) {
    completedYearsForGratuity += 1;
  }

  return {
    years,
    months,
    days,
    totalDays,
    exactYears,
    completedYearsForGratuity,
    isEligible,
  };
}

export function calculateGratuity(input: GratuityCalculationInput): GratuityCalculationResult {
  const basicPaise = input.basicMonthlyPaise;
  const daPaise = input.daMonthlyPaise ?? 0;
  const wageBasePaise = basicPaise + daPaise;
  const capPaise = input.statutoryCapPaise ?? STATUTORY_GRATUITY_CAP_PAISE;

  const tenure = calculateServiceTenure(input.doj, input.lastWorkingDay);
  const eligible = tenure.isEligible || input.waiveMinimumService === true;

  if (!eligible) {
    return {
      isEligible: false,
      serviceYearsExact: tenure.exactYears,
      completedYearsRounded: tenure.completedYearsForGratuity,
      basicPlusDaMonthlyPaise: wageBasePaise,
      gratuityPaise: 0,
      gratuityRupees: 0,
      cappedAtCeiling: false,
      calcNote: `Ineligible for statutory gratuity: service tenure ${tenure.years}y ${tenure.months}m (${tenure.totalDays} days) is less than statutory threshold of 4 years 240 days.`,
    };
  }

  // Formula: (15 * (Basic + DA) * completed_years) / 26
  // Round to nearest integer rupee per statutory standard
  const unroundedPaise = (15 * wageBasePaise * tenure.completedYearsForGratuity) / 26;
  const roundedRupees = Math.round(unroundedPaise / 100);
  let finalPaise = roundedRupees * 100;

  let cappedAtCeiling = false;
  if (finalPaise > capPaise) {
    finalPaise = capPaise;
    cappedAtCeiling = true;
  }

  const finalRupees = Math.round(finalPaise / 100);

  return {
    isEligible: true,
    serviceYearsExact: tenure.exactYears,
    completedYearsRounded: tenure.completedYearsForGratuity,
    basicPlusDaMonthlyPaise: wageBasePaise,
    gratuityPaise: finalPaise,
    gratuityRupees: finalRupees,
    cappedAtCeiling,
    calcNote: cappedAtCeiling
      ? `Gratuity capped at statutory ceiling of ₹${(capPaise / 100).toLocaleString('en-IN')}`
      : `Gratuity calculated: (15 × ₹${(wageBasePaise / 100).toLocaleString('en-IN')} × ${tenure.completedYearsForGratuity} years) / 26 = ₹${finalRupees.toLocaleString('en-IN')}${input.waiveMinimumService === true && !tenure.isEligible ? ' (five-year rule waived on death)' : ''}`,
  };
}
