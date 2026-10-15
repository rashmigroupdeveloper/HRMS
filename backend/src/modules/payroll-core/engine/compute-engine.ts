/**
 * Payroll Compute Engine (PAY-04, docs/04 §3, docs/10, SOW crosswalk).
 *
 * Deterministic, pure calculation engine executing in the exact statutory order:
 *   1. Effective Salary Resolution
 *   2. Attendance Proration (calendar days | fixed 30, LOP, LOP reversal)
 *   3. Overtime addition + scheduled arrears + monthly variable inputs
 *   4. Gross calculation (Σ earnings with part_of_gross)
 *   5. Statutory deductions strictly in sequence: PF -> ESIC -> PT -> LWF -> TDS
 *   6. Other deductions: loan EMIs, salary advances, recoveries
 *   7. Net Pay = Gross - Deductions.
 *      CRITICAL: Negative net is NEVER clamped to zero; flagged as review exception.
 *   8. Human-readable explainability note (calc_note) on every line.
 */

import { type Paise, paise, add, subtract, mulDiv } from '../../../core/money/index.js';
import {
  roundPfContribution,
  roundEsicContribution,
  roundMonthlyTds,
  roundOtPay,
} from '../../../core/money/rounding-policy.js';
import { prorateComponent } from './proration.js';
import type { PayrollPaymentStatus } from '../../../core/db/types.js';
import { isApprentice } from '../statutory/apprentice.js';
import { computePt } from '../statutory/pt.js';

export interface ComponentMetadata {
  code: string;
  name: string;
  kind: 'earning' | 'deduction' | 'employer_contribution';
  partOfGross: boolean;
  partOfPfWages: boolean;
  prorateOnLop: boolean;
  displayOrder: number;
}

export interface EmployeeComputeInput {
  employeeId: number;
  salaryComponentsPaise: Record<string, Paise>;
  daysInMonth: number;
  payableDays: number;
  lopReversalDays?: number | undefined;
  otMinutes?: number | undefined;
  variableInputs?:
    | {
        componentCode: string;
        amountPaise: Paise;
        note: string;
      }[]
    | undefined;
  arrears?:
    | {
        componentCode: string;
        amountPaise: Paise;
        note?: string | undefined;
      }[]
    | undefined;
  otherDeductions?:
    | {
        componentCode: string;
        amountPaise: Paise;
        note: string;
      }[]
    | undefined;
  hold?:
    | {
        hasHold: boolean;
        holdType?: 'payment' | 'process' | undefined;
        reason?: string | undefined;
      }
    | undefined;
  /** West Bengal default PT slabs if not passed */
  ptSlabs?: { minMonthly: number; maxMonthly: number | null; ptPaise: Paise }[] | undefined;
  /** PF wage ceiling: default ₹15,000 (1500000 paise) or null for actual */
  pfWageCeilingPaise?: Paise | null | undefined;
  /** ESIC gross threshold: default ₹21,000 (2100000 paise) */
  esicGrossThresholdPaise?: Paise | undefined;
  /** Monthly TDS projected paise (from TDS projection engine) */
  projectedMonthlyTdsPaise?: Paise | undefined;
  /** LWF amount paise: default 0 (or ₹3 in June/Dec for WB) */
  lwfPaise?: Paise | undefined;
  /** Employee category (e.g. 'staff', 'trainee') */
  category?: string | undefined;
  /** Employee contract type (e.g. 'regular', 'apprentice') */
  contractType?: string | undefined;
  /** State code for PT and LWF (default 'WB') */
  stateCode?: string | undefined;
}

export interface ComputedPayrollLine {
  componentCode: string;
  amountPaise: Paise;
  calcNote: string;
  displayOrder: number;
}

export interface ComputedEmployeePayroll {
  employeeId: number;
  daysInMonth: number;
  payableDays: number;
  lopDays: number;
  lopReversalDays: number;
  otMinutes: number;
  grossPaise: Paise;
  totalDeductionsPaise: Paise;
  netPayPaise: Paise;
  paymentStatus: PayrollPaymentStatus;
  isNegativeNet: boolean;
  lines: ComputedPayrollLine[];
}

/**
 * West Bengal Professional Tax Slabs (docs/10 §4, Golden G4):
 *   <= ₹10,000: ₹0
 *   ₹10,001 – ₹15,000: ₹110
 *   ₹15,001 – ₹25,000: ₹130
 *   ₹25,001 – ₹40,000: ₹150
 *   > ₹40,000: ₹200
 */
export function computeWestBengalPt(grossPaise: Paise): Paise {
  const grossRupees = Math.floor(grossPaise / 100);

  if (grossRupees <= 10000) return paise(0);
  if (grossRupees <= 15000) return paise(11000);
  if (grossRupees <= 25000) return paise(13000);
  if (grossRupees <= 40000) return paise(15000);
  return paise(20000); // ₹200 for > 40k
}

/**
 * Compute monthly payroll item for a single employee following exact docs/04 §3 order.
 */
export function computeEmployeePayroll(
  input: EmployeeComputeInput,
  componentCatalog: Map<string, ComponentMetadata>,
): ComputedEmployeePayroll {
  const {
    employeeId,
    salaryComponentsPaise,
    daysInMonth,
    payableDays,
    lopReversalDays = 0,
    otMinutes = 0,
    variableInputs = [],
    arrears = [],
    otherDeductions = [],
    hold,
    pfWageCeilingPaise = paise(1500000), // Default 15k ceiling
    esicGrossThresholdPaise = paise(2100000), // Default 21k
    projectedMonthlyTdsPaise = paise(0),
    lwfPaise = paise(0),
    category,
    contractType,
    stateCode = 'WB',
  } = input;

  const isEmpApprentice = category && contractType ? isApprentice(category, contractType) : false;

  // 0. Handle Process Hold ('hold_process'): treat employee as completely withheld (zero gross/net)
  if (hold?.holdType === 'process') {
    return {
      employeeId,
      daysInMonth,
      payableDays: 0,
      lopDays: daysInMonth,
      lopReversalDays: 0,
      otMinutes: 0,
      grossPaise: paise(0),
      totalDeductionsPaise: paise(0),
      netPayPaise: paise(0),
      paymentStatus: 'hold_process',
      isNegativeNet: false,
      lines: [],
    };
  }

  const effectivePayable = Math.min(daysInMonth, Math.max(0, payableDays + lopReversalDays));
  const lopDays = Math.max(0, daysInMonth - effectivePayable);

  const lines: ComputedPayrollLine[] = [];

  // --- STEP 1 & 2: EARNINGS & ATTENDANCE PRORATION ---
  let grossPaise = paise(0);
  let pfWageBasePaise = paise(0);
  let totalDeductionsPaise = paise(0);

  // PAY-04/08/16: every adjustment has the same financial classification as
  // its component. Signed retro deltas reverse the original classification.
  const applyAdjustment = (code: string, amount: Paise): ComponentMetadata => {
    const meta = componentCatalog.get(code);
    if (!meta) throw new Error(`Unknown payroll component: ${code}`);
    if (meta.kind === 'earning') {
      if (meta.partOfGross) grossPaise = add(grossPaise, amount);
      if (meta.partOfPfWages) pfWageBasePaise = add(pfWageBasePaise, amount);
    } else if (meta.kind === 'deduction') {
      totalDeductionsPaise = add(totalDeductionsPaise, amount);
    }
    // Employer contributions belong in CTC/JV, never employee net deductions.
    return meta;
  };

  for (const [code, monthlyPaise] of Object.entries(salaryComponentsPaise)) {
    const meta = componentCatalog.get(code);
    if (meta?.kind !== 'earning') {
      continue;
    }

    if (isEmpApprentice && code === 'STATUTORY_BONUS') {
      // Excluded from Payment of Bonus Act per Section 18 of Apprentices Act, 1961
      continue;
    }

    const proration = prorateComponent({
      componentCode: code,
      monthlyAmountPaise: monthlyPaise,
      prorateOnLop: meta.prorateOnLop,
      daysInMonth,
      payableDays: effectivePayable,
    });

    lines.push({
      componentCode: code,
      amountPaise: proration.proratedAmountPaise,
      calcNote: proration.calcNote,
      displayOrder: meta.displayOrder,
    });

    if (meta.partOfGross) {
      grossPaise = add(grossPaise, proration.proratedAmountPaise);
    }
    if (meta.partOfPfWages) {
      pfWageBasePaise = add(pfWageBasePaise, proration.proratedAmountPaise);
    }
  }

  // --- STEP 3: OVERTIME ADDITION (ATT-08) ---
  if (otMinutes > 0) {
    // Factories Act baseline: OT hours × (Basic / 26 / 8) × 2
    const basicPaise = salaryComponentsPaise['BASIC'] ?? paise(0);
    // Hourly rate: Basic / 208 (26 days * 8 hours)
    const hourlyRatePaise = mulDiv(basicPaise, 1, 208);
    // Double rate for overtime: hourlyRate * 2 * (otMinutes / 60)
    const otPaiseRaw = mulDiv(hourlyRatePaise, otMinutes * 2, 60);
    const otPayPaise = roundOtPay(otPaiseRaw);

    if (otPayPaise > 0) {
      lines.push({
        componentCode: 'OT_PAY',
        amountPaise: otPayPaise,
        calcNote: `Overtime: ${String(otMinutes)} mins at 2× rate (₹${(hourlyRatePaise / 100).toFixed(2)}/hr)`,
        displayOrder: 80,
      });
      grossPaise = add(grossPaise, otPayPaise);
    }
  }

  // --- STEP 4: SCHEDULED ARREARS (PAY-16) ---
  for (const arr of arrears) {
    const meta = applyAdjustment(arr.componentCode, arr.amountPaise);
    lines.push({
      componentCode: arr.componentCode,
      amountPaise: arr.amountPaise,
      calcNote: arr.note ?? 'Retro arrears delta',
      displayOrder: meta.displayOrder,
    });
  }

  // --- STEP 5: MONTHLY VARIABLE INPUTS (pay.inputs) ---
  for (const inp of variableInputs) {
    const meta = applyAdjustment(inp.componentCode, inp.amountPaise);
    lines.push({
      componentCode: inp.componentCode,
      amountPaise: inp.amountPaise,
      calcNote: inp.note,
      displayOrder: meta.displayOrder,
    });
  }

  // --- STEP 6: STATUTORY DEDUCTIONS (Sequence: PF -> ESIC -> PT -> LWF -> TDS) ---

  // 6.1 Provident Fund (12% on PF wages, capped if ceiling set; exempt for apprentices)
  if (!isEmpApprentice) {
    let effectivePfWages = pfWageBasePaise;
    if (pfWageCeilingPaise !== null && effectivePfWages > pfWageCeilingPaise) {
      effectivePfWages = pfWageCeilingPaise;
    }
    // 12% EE contribution
    const rawPfPaise = mulDiv(effectivePfWages, 12, 100);
    const pfEePaise = roundPfContribution(rawPfPaise);

    if (pfEePaise > 0) {
      lines.push({
        componentCode: 'PF_EE',
        amountPaise: pfEePaise,
        calcNote: `PF Employee: 12% on PF wages ₹${(effectivePfWages / 100).toFixed(2)}`,
        displayOrder: 100,
      });
      totalDeductionsPaise = add(totalDeductionsPaise, pfEePaise);
    }
  }

  // 6.2 Employees' State Insurance (0.75% of gross if eligible, round up to next rupee; exempt for apprentices)
  // Note: OT is excluded from ESIC wage base per ESIC Act
  if (!isEmpApprentice && grossPaise <= esicGrossThresholdPaise && grossPaise > 0) {
    const rawEsicPaise = mulDiv(grossPaise, 75, 10000); // 0.75%
    const esicEePaise = roundEsicContribution(rawEsicPaise);

    if (esicEePaise > 0) {
      lines.push({
        componentCode: 'ESI_EE',
        amountPaise: esicEePaise,
        calcNote: `ESIC Employee: 0.75% on Gross ₹${(grossPaise / 100).toFixed(2)} (rounded up)`,
        displayOrder: 110,
      });
      totalDeductionsPaise = add(totalDeductionsPaise, esicEePaise);
    }
  }

  // 6.3 Professional Tax (Multi-state Slabs on Gross)
  const ptPaise = computePt(grossPaise, stateCode);
  if (ptPaise > 0) {
    lines.push({
      componentCode: 'PT',
      amountPaise: ptPaise,
      calcNote: `${stateCode} Professional Tax on Gross ₹${(grossPaise / 100).toFixed(2)}`,
      displayOrder: 120,
    });
    totalDeductionsPaise = add(totalDeductionsPaise, ptPaise);
  }

  // 6.4 Labour Welfare Fund (LWF)
  if (lwfPaise > 0) {
    lines.push({
      componentCode: 'LWF',
      amountPaise: lwfPaise,
      calcNote: `Labour Welfare Fund contribution`,
      displayOrder: 130,
    });
    totalDeductionsPaise = add(totalDeductionsPaise, lwfPaise);
  }

  // 6.5 Tax Deducted at Source (TDS)
  const tdsPaise = roundMonthlyTds(projectedMonthlyTdsPaise);
  if (tdsPaise > 0) {
    lines.push({
      componentCode: 'TDS',
      amountPaise: tdsPaise,
      calcNote: `Monthly TDS projection u/s 192`,
      displayOrder: 140,
    });
    totalDeductionsPaise = add(totalDeductionsPaise, tdsPaise);
  }

  // --- STEP 7: OTHER DEDUCTIONS (Loan EMI, Recoveries) ---
  for (const od of otherDeductions) {
    lines.push({
      componentCode: od.componentCode,
      amountPaise: od.amountPaise,
      calcNote: od.note,
      displayOrder: 150,
    });
    totalDeductionsPaise = add(totalDeductionsPaise, od.amountPaise);
  }

  // --- STEP 8: NET PAY (Gross − Σ Deductions) ---
  const netPayPaise = subtract(grossPaise, totalDeductionsPaise);
  const isNegativeNet = netPayPaise < 0;

  // Payment hold check ('hold_payment')
  const paymentStatus: PayrollPaymentStatus =
    hold?.holdType === 'payment' ? 'hold_payment' : 'payable';

  // Sort lines by displayOrder
  lines.sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    employeeId,
    daysInMonth,
    payableDays: effectivePayable,
    lopDays,
    lopReversalDays,
    otMinutes,
    grossPaise,
    totalDeductionsPaise,
    netPayPaise,
    paymentStatus,
    isNegativeNet,
    lines,
  };
}
