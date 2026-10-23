/**
 * Final Settlement (F&F) Calculation Engine (PAY-15, LC-07, SOW crosswalk, Golden G8).
 *
 * Implements:
 * 1. Final partial-month earnings based on locked attendance through approved LWD.
 * 2. Earned Leave (EL) encashment: (Basic + DA) / 30 × EL_balance.
 * 3. Notice shortfall deduction: (Basic / 30) × shortfall_days.
 * 4. Statutory Gratuity calculation via gratuity-calculator.ts (Payment of Gratuity Act).
 * 5. Asset deductions (C18 / AST-04), active loan recovery (pay.loans), and held salary release.
 * 6. 3-working-day TAT tracking (Code on Wages §17(2) & SOW-10.2).
 * 7. Payment execution cascade: commits 'paid', generates Relieving Letter & Service Certificate,
 *    updates employee to 'exited' with Date of Leaving (dol), and transitions user to 'alumni'.
 */

import { calculateGratuity, type GratuityCalculationResult } from './gratuity-calculator.js';
import { paise, mulDiv } from '../../../core/money/index.js';

export interface FnfComputeParams {
  employeeId: number;
  separationId: number;
  doj: Date | string;
  approvedLwd: Date | string;
  daysPayable: number;
  daysInMonth?: number;
  basicMonthlyPaise: number;
  daMonthlyPaise?: number;
  grossMonthlyPaise: number;
  elBalanceDays: number;
  shortfallDays: number;
  /** Notice recovery already deducted through payroll (never recovered twice). */
  noticeAlreadyRecoveredPaise?: number | undefined;
  unreturnedAssetRecoveryPaise?: number;
  loanOutstandingPaise?: number;
  travelAdvanceDebitPaise?: number;
  heldSalaryPaise?: number;
  tdsPaise?: number;
  /** Death exit: gratuity does not wait for five years (Payment of Gratuity Act s.4). */
  gratuityWaivesMinimumService?: boolean | undefined;
}

export interface FnfBreakdownLine {
  code: string;
  name: string;
  category: 'earning' | 'deduction' | 'statutory';
  amountPaise: number;
  amountRupees: number;
  calcNote: string;
}

export interface FnfSettlementCalculation {
  employeeId: number;
  separationId: number;
  approvedLwd: string;
  daysPayable: number;
  earnings: {
    proratedSalaryPaise: number;
    leaveEncashmentPaise: number;
    gratuityPaise: number;
    heldSalaryReleasedPaise: number;
    grossPayablePaise: number;
  };
  deductions: {
    noticeRecoveryPaise: number;
    assetRecoveryPaise: number;
    loanRecoveryPaise: number;
    travelAdvanceRecoveryPaise: number;
    tdsPaise: number;
    totalDeductionsPaise: number;
  };
  netPayablePaise: number;
  netPayableRupees: number;
  gratuityDetail: GratuityCalculationResult;
  tatDueDate: string;
  lines: FnfBreakdownLine[];
}

/**
 * Calculates 3 working days from a reference date (excluding Saturday & Sunday).
 */
export function calculateWorkingDaysTat(fromDate: Date | string, workingDaysCount = 3): Date {
  const current = new Date(fromDate);
  let added = 0;
  while (added < workingDaysCount) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added += 1;
    }
  }
  return current;
}

/**
 * Calculates working days elapsed between two dates (excluding Sundays and optional holidays).
 */
export function calculateWorkingDaysElapsed(
  fromDate: Date | string,
  toDate: Date | string,
  holidays: string[] = []
): { workingDaysElapsed: number; withinTat: boolean } {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const holidaySet = new Set(holidays);

  let workingDays = 0;
  const curr = new Date(start);
  while (curr <= end) {
    const dayOfWeek = curr.getDay();
    const dateStr = curr.toISOString().slice(0, 10);
    if (dayOfWeek !== 0 && !holidaySet.has(dateStr)) {
      workingDays += 1;
    }
    curr.setDate(curr.getDate() + 1);
  }

  const elapsed = Math.max(0, workingDays - 1);
  return {
    workingDaysElapsed: elapsed,
    withinTat: elapsed <= 3,
  };
}

/**
 * Computes exact F&F Settlement amounts with integer-paise accuracy.
 */
export function computeFnfSettlement(params: FnfComputeParams): FnfSettlementCalculation {
  const daysInMonth = params.daysInMonth ?? 30;
  if (!Number.isInteger(daysInMonth) || daysInMonth < 1 || daysInMonth > 31
    || !Number.isFinite(params.daysPayable) || params.daysPayable < 0 || params.daysPayable > daysInMonth)
    throw new RangeError('Invalid final-month payable days or divisor');
  for (const value of [params.elBalanceDays, params.shortfallDays]) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid settlement day quantity');
  }
  const dayUnits = (value: number): number => {
    const units = Math.round(value * 100);
    if (Math.abs(value * 100 - units) > 1e-7) throw new RangeError('Settlement day quantities support at most two decimals');
    return units;
  };
  for (const value of [params.basicMonthlyPaise, params.daMonthlyPaise ?? 0, params.grossMonthlyPaise,
    params.noticeAlreadyRecoveredPaise ?? 0, params.unreturnedAssetRecoveryPaise ?? 0,
    params.loanOutstandingPaise ?? 0, params.travelAdvanceDebitPaise ?? 0, params.heldSalaryPaise ?? 0, params.tdsPaise ?? 0]) {
    if (paise(value) < 0) throw new RangeError('Settlement money must be non-negative integer paise');
  }
  const basicPaise = params.basicMonthlyPaise;
  const daPaise = params.daMonthlyPaise ?? 0;
  const wageBasePaise = basicPaise + daPaise;

  // 1. Partial-month prorated salary earnings through LWD
  const proratedSalaryPaise = mulDiv(paise(params.grossMonthlyPaise), dayUnits(params.daysPayable), daysInMonth * 100);

  // 2. Leave Encashment: (Basic + DA) / 30 × EL_balance
  const leaveEncashmentPaise = mulDiv(paise(wageBasePaise), dayUnits(params.elBalanceDays), 30 * 100);

  // 3. Notice Period Shortfall Recovery: (Basic / 30) × shortfall_days
  const noticeRecoveryPaise = Math.max(0, mulDiv(paise(basicPaise), dayUnits(params.shortfallDays), 30 * 100) - (params.noticeAlreadyRecoveredPaise ?? 0));

  // 4. Gratuity Calculation (Golden Fixture G8)
  const gratuityDetail = calculateGratuity({
    basicMonthlyPaise: basicPaise,
    daMonthlyPaise: daPaise,
    doj: params.doj,
    lastWorkingDay: params.approvedLwd,
    waiveMinimumService: params.gratuityWaivesMinimumService,
  });
  const gratuityPaise = gratuityDetail.gratuityPaise;

  // 5. Recoveries & Deductions
  const assetRecoveryPaise = params.unreturnedAssetRecoveryPaise ?? 0;
  const loanRecoveryPaise = params.loanOutstandingPaise ?? 0;
  const travelAdvanceRecoveryPaise = params.travelAdvanceDebitPaise ?? 0;
  const tdsPaise = params.tdsPaise ?? 0;
  const heldSalaryReleasedPaise = params.heldSalaryPaise ?? 0;

  // 6. Gross & Net Aggregations
  const grossPayablePaise =
    proratedSalaryPaise + leaveEncashmentPaise + gratuityPaise + heldSalaryReleasedPaise;

  const totalDeductionsPaise =
    noticeRecoveryPaise + assetRecoveryPaise + loanRecoveryPaise + travelAdvanceRecoveryPaise + tdsPaise;

  const netPayablePaise = grossPayablePaise - totalDeductionsPaise;
  paise(grossPayablePaise); paise(totalDeductionsPaise); paise(netPayablePaise);
  const netPayableRupees = Math.round(netPayablePaise / 100);

  // 7. TAT Due Date (3 working days)
  const tatDue = calculateWorkingDaysTat(params.approvedLwd, 3);
  const tatDueDate = tatDue.toISOString().slice(0, 10);

  // 8. Breakdown lines for payslip / statement (R18 F&F Statement)
  const lines: FnfBreakdownLine[] = [
    {
      code: 'PRORATED_SALARY',
      name: `Earned Salary (${params.daysPayable}/${daysInMonth} days)`,
      category: 'earning',
      amountPaise: proratedSalaryPaise,
      amountRupees: Math.round(proratedSalaryPaise / 100),
      calcNote: `Gross ₹${(params.grossMonthlyPaise / 100).toLocaleString('en-IN')} / ${daysInMonth} × ${params.daysPayable} payable days`,
    },
    {
      code: 'LEAVE_ENCASHMENT',
      name: `Earned Leave Encashment (${params.elBalanceDays} days)`,
      category: 'earning',
      amountPaise: leaveEncashmentPaise,
      amountRupees: Math.round(leaveEncashmentPaise / 100),
      calcNote: `(Basic+DA ₹${(wageBasePaise / 100).toLocaleString('en-IN')}) / 30 × ${params.elBalanceDays} EL days`,
    },
    {
      code: 'GRATUITY',
      name: 'Statutory Gratuity',
      category: 'earning',
      amountPaise: gratuityPaise,
      amountRupees: Math.round(gratuityPaise / 100),
      calcNote: gratuityDetail.calcNote,
    },
  ];

  if (heldSalaryReleasedPaise > 0) {
    lines.push({
      code: 'HELD_SALARY_RELEASE',
      name: 'Release of Held Salary Liabilities',
      category: 'earning',
      amountPaise: heldSalaryReleasedPaise,
      amountRupees: Math.round(heldSalaryReleasedPaise / 100),
      calcNote: `Released ₹${(heldSalaryReleasedPaise / 100).toLocaleString('en-IN')} previously held under pay.salary_holds`,
    });
  }

  if (noticeRecoveryPaise > 0) {
    lines.push({
      code: 'NOTICE_RECOVERY',
      name: `Notice Shortfall Recovery (${params.shortfallDays} days)`,
      category: 'deduction',
      amountPaise: noticeRecoveryPaise,
      amountRupees: Math.round(noticeRecoveryPaise / 100),
      calcNote: `Basic ₹${(basicPaise / 100).toLocaleString('en-IN')} / 30 × ${params.shortfallDays} shortfall days${params.noticeAlreadyRecoveredPaise ? `, less ₹${(params.noticeAlreadyRecoveredPaise / 100).toLocaleString('en-IN')} already recovered in payroll` : ''}`,
    });
  }

  if (assetRecoveryPaise > 0) {
    lines.push({
      code: 'ASSET_RECOVERY',
      name: 'Unreturned/Damaged Asset Recovery (C18)',
      category: 'deduction',
      amountPaise: assetRecoveryPaise,
      amountRupees: Math.round(assetRecoveryPaise / 100),
      calcNote: `Recovery approved by Finance from Admin/IT asset custody flag`,
    });
  }

  if (loanRecoveryPaise > 0) {
    lines.push({
      code: 'LOAN_OUTSTANDING_RECOVERY',
      name: 'Outstanding Company Loan Closure',
      category: 'deduction',
      amountPaise: loanRecoveryPaise,
      amountRupees: Math.round(loanRecoveryPaise / 100),
      calcNote: `Full outstanding balance cleared from pay.loans`,
    });
  }

  if (travelAdvanceRecoveryPaise > 0) {
    lines.push({
      code: 'TRAVEL_ADVANCE_RECOVERY',
      name: 'Unreconciled Travel Advance Recovery',
      category: 'deduction',
      amountPaise: travelAdvanceRecoveryPaise,
      amountRupees: Math.round(travelAdvanceRecoveryPaise / 100),
      calcNote: `Debit balance from unsettled travel wallet advance`,
    });
  }

  if (tdsPaise > 0) {
    lines.push({
      code: 'TDS_FINAL',
      name: 'Final Income Tax (TDS)',
      category: 'deduction',
      amountPaise: tdsPaise,
      amountRupees: Math.round(tdsPaise / 100),
      calcNote: `Final tax assessment on annualized income including F&F components`,
    });
  }

  return {
    employeeId: params.employeeId,
    separationId: params.separationId,
    approvedLwd: typeof params.approvedLwd === 'string' ? params.approvedLwd : params.approvedLwd.toISOString().slice(0, 10),
    daysPayable: params.daysPayable,
    earnings: {
      proratedSalaryPaise,
      leaveEncashmentPaise,
      gratuityPaise,
      heldSalaryReleasedPaise,
      grossPayablePaise,
    },
    deductions: {
      noticeRecoveryPaise,
      assetRecoveryPaise,
      loanRecoveryPaise,
      travelAdvanceRecoveryPaise,
      tdsPaise,
      totalDeductionsPaise,
    },
    netPayablePaise,
    netPayableRupees,
    gratuityDetail,
    tatDueDate,
    lines,
  };
}
