/**
 * Payroll Compute Engine (PAY-04, docs/04 §3, docs/10, SOW crosswalk).
 *
 * Deterministic and pure. Order of work:
 *   1. Attendance proration (calendar days, LOP, LOP reversal); every earned
 *      line is rounded half-up to the rupee (P-21).
 *   2. Approved overtime: BASIC ÷ divisor × multiplier × hours (ATT-08, P-06).
 *   3. Scheduled arrears and monthly variable inputs.
 *   4. Gross = Σ earnings flagged part_of_gross.
 *   5. Statutory deductions in sequence PF → ESIC → PT → LWF → TDS, with the
 *      rates passed in from pay.statutory_rates / pay.pt_slabs (never hardcoded
 *      policy): PF on ACTUAL or CEILING wages per company/employee (P-01), ESIC
 *      only for covered employees (P-05), PT by work-location state (P-17).
 *   6. Other deductions: loan EMIs (P-08), carried-forward recoveries.
 *   7. Employer contributions (EPF/EPS/EDLI/admin/ESIC) as separate lines that
 *      never touch employee net (P-20).
 *   8. Net = Gross − Deductions. Under the 'carry_forward' policy, recoveries
 *      (never statutory lines) are trimmed so net is not negative and the
 *      trimmed part is carried to the next run (P-14); under 'flag' a negative
 *      net is preserved and flagged for review.
 */

import { type Paise, paise, add, subtract, mulDiv, roundToRupee, min } from '../../../core/money/index.js';
import { roundEsicContribution, roundPfContribution, roundMonthlyTds } from '../../../core/money/rounding-policy.js';
import { prorateComponent } from './proration.js';
import type { PayrollPaymentStatus } from '../../../core/db/types.js';

export interface ComponentMetadata {
  code: string;
  name: string;
  kind: 'earning' | 'deduction' | 'employer_contribution';
  partOfGross: boolean;
  partOfPfWages: boolean;
  prorateOnLop: boolean;
  displayOrder: number;
}

/** Statutory parameters, loaded from pay.statutory_rates for the run month. Rates in basis points. */
export interface StatutoryRates {
  pfEeBp: number;
  pfErBp: number;
  epsBp: number;
  pfWageCeilingPaise: Paise;
  epsCapPaise: Paise;
  edliBp: number;
  edliCapPaise: Paise;
  pfAdminBp: number;
  esicEeBp: number;
  esicErBp: number;
  esicCeilingPaise: Paise;
  otDivisor: number;
  otMultiplier: number;
}

/** docs/10 values — used by unit tests and as the shape reference for the DB seed. */
export const DOCS10_STATUTORY_RATES: StatutoryRates = {
  pfEeBp: 1200,
  pfErBp: 1200,
  epsBp: 833,
  pfWageCeilingPaise: paise(1500000),
  epsCapPaise: paise(125000),
  edliBp: 50,
  edliCapPaise: paise(7500),
  pfAdminBp: 50,
  esicEeBp: 75,
  esicErBp: 325,
  esicCeilingPaise: paise(2100000),
  otDivisor: 208,
  otMultiplier: 2,
};

export type PfWageBasis = 'ACTUAL' | 'CEILING_15000';
export type PtBasis = 'earned_monthly' | 'contracted_monthly';

export interface PtSlabRow {
  minMonthlyPaise: Paise;
  maxMonthlyPaise: Paise | null;
  amountPaise: Paise;
  basis: PtBasis;
}

/** West Bengal PT (docs/10 §4) — the unit-test default; runs read pay.pt_slabs. */
const WB_PT_SLABS: PtSlabRow[] = [
  { minMonthlyPaise: paise(0), maxMonthlyPaise: paise(1000000), amountPaise: paise(0), basis: 'earned_monthly' },
  { minMonthlyPaise: paise(1000001), maxMonthlyPaise: paise(1500000), amountPaise: paise(11000), basis: 'earned_monthly' },
  { minMonthlyPaise: paise(1500001), maxMonthlyPaise: paise(2500000), amountPaise: paise(13000), basis: 'earned_monthly' },
  { minMonthlyPaise: paise(2500001), maxMonthlyPaise: paise(4000000), amountPaise: paise(15000), basis: 'earned_monthly' },
  { minMonthlyPaise: paise(4000001), maxMonthlyPaise: null, amountPaise: paise(20000), basis: 'earned_monthly' },
];

export interface AdjustmentInput {
  componentCode: string;
  amountPaise: Paise;
  note?: string | undefined;
}

/** A non-statutory recovery. `source` lets the run post it (loan ledger, carry-forward) after finalize. */
export interface RecoveryInput {
  componentCode: string;
  amountPaise: Paise;
  note: string;
  source?: { kind: 'loan'; loanId: number } | { kind: 'carry_forward'; carryId: number } | { kind: 'input' } | undefined;
}

export interface EmployeeComputeInput {
  employeeId: number;
  salaryComponentsPaise: Record<string, Paise>;
  daysInMonth: number;
  payableDays: number;
  lopReversalDays?: number | undefined;
  otMinutes?: number | undefined;
  variableInputs?: AdjustmentInput[] | undefined;
  arrears?: AdjustmentInput[] | undefined;
  otherDeductions?: RecoveryInput[] | undefined;
  hold?: { hasHold: boolean; holdType?: 'payment' | 'process' | undefined; reason?: string | undefined } | undefined;
  rates?: StatutoryRates | undefined;
  /** PF membership and wage basis (company/employee policy). Default: member, ACTUAL wages. */
  /** epsEligible (default true): REQ-003 EPS membership for the month; internationalWorker: PF on full wages, no ceiling. */
  pf?: { applicable: boolean; wageBasis: PfWageBasis; epsEligible?: boolean | undefined; internationalWorker?: boolean | undefined } | undefined;
  /** ESIC coverage for the current contribution period, decided by the caller. Default false. */
  esicCovered?: boolean | undefined;
  ptSlabs?: PtSlabRow[] | undefined;
  stateCode?: string | undefined;
  monthlyTdsPaise?: Paise | undefined;
  lwfPaise?: Paise | undefined;
  /** Apprentices (Apprentices Act 1961): no PF, ESIC, bonus or TDS on stipend. */
  apprentice?: boolean | undefined;
  negativeNetPolicy?: 'carry_forward' | 'flag' | undefined;
}

export interface ComputedPayrollLine {
  componentCode: string;
  kind: ComponentMetadata['kind'];
  amountPaise: Paise;
  calcNote: string;
  displayOrder: number;
  source?: RecoveryInput['source'];
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
  employerCostPaise: Paise;
  pfWagesPaise: Paise;
  esicWagesPaise: Paise;
  paymentStatus: PayrollPaymentStatus;
  isNegativeNet: boolean;
  lines: ComputedPayrollLine[];
  /** Recoveries trimmed by the carry-forward policy, to recover next run. */
  carryForward: { componentCode: string; amountPaise: Paise; source?: RecoveryInput['source'] }[];
}

const rupees = (p: Paise): string => (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const roundHalfUp = (p: Paise): Paise => roundToRupee(p, 'half_up');

/** PT for a slab table: earned-gross basis (WB) or contracted-gross basis (Odisha annual slabs). */
export function computeProfessionalTax(earnedGrossPaise: Paise, contractedGrossPaise: Paise, slabs: PtSlabRow[]): Paise {
  if (earnedGrossPaise <= 0) return paise(0);
  for (const s of slabs) {
    const base = s.basis === 'contracted_monthly' ? contractedGrossPaise : earnedGrossPaise;
    if (base >= s.minMonthlyPaise && (s.maxMonthlyPaise === null || base <= s.maxMonthlyPaise)) return s.amountPaise;
  }
  return paise(0);
}

/** Backwards-compatible WB helper (docs/10 G4). */
export function computeWestBengalPt(grossPaise: Paise): Paise {
  return computeProfessionalTax(roundToRupee(grossPaise, 'floor'), roundToRupee(grossPaise, 'floor'), WB_PT_SLABS);
}

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
    rates = DOCS10_STATUTORY_RATES,
    pf = { applicable: true, wageBasis: 'ACTUAL' as PfWageBasis },
    esicCovered = false,
    ptSlabs = WB_PT_SLABS,
    stateCode = 'WB',
    monthlyTdsPaise = paise(0),
    lwfPaise = paise(0),
    apprentice = false,
    negativeNetPolicy = 'flag',
  } = input;

  const empty = (status: PayrollPaymentStatus): ComputedEmployeePayroll => ({
    employeeId, daysInMonth, payableDays: 0, lopDays: daysInMonth, lopReversalDays: 0, otMinutes: 0,
    grossPaise: paise(0), totalDeductionsPaise: paise(0), netPayPaise: paise(0), employerCostPaise: paise(0),
    pfWagesPaise: paise(0), esicWagesPaise: paise(0), paymentStatus: status, isNegativeNet: false, lines: [], carryForward: [],
  });
  if (hold?.holdType === 'process') return empty('hold_process');

  const effectivePayable = Math.min(daysInMonth, Math.max(0, payableDays + lopReversalDays));
  const lopDays = Math.max(0, daysInMonth - effectivePayable);
  const lines: ComputedPayrollLine[] = [];
  let grossPaise = paise(0);
  let pfWagesPaise = paise(0);
  let otPaise = paise(0);
  let contractedGrossPaise = paise(0);

  const meta = (code: string): ComponentMetadata => {
    const m = componentCatalog.get(code);
    if (!m) throw new Error(`Unknown payroll component: ${code}`);
    return m;
  };
  const pushEarning = (m: ComponentMetadata, amount: Paise, note: string): void => {
    lines.push({ componentCode: m.code, kind: m.kind, amountPaise: amount, calcNote: note, displayOrder: m.displayOrder });
    if (m.kind !== 'earning') return;
    if (m.partOfGross) grossPaise = add(grossPaise, amount);
    if (m.partOfPfWages) pfWagesPaise = add(pfWagesPaise, amount);
  };

  // 1. Earnings with attendance proration, rounded to the rupee.
  for (const [code, monthlyPaise] of Object.entries(salaryComponentsPaise)) {
    const m = componentCatalog.get(code);
    if (m?.kind !== 'earning') continue;
    if (m.partOfGross) contractedGrossPaise = add(contractedGrossPaise, monthlyPaise);
    if (apprentice && code === 'STATUTORY_BONUS') continue; // Apprentices Act s.18: no bonus
    const proration = prorateComponent({ componentCode: code, monthlyAmountPaise: monthlyPaise, prorateOnLop: m.prorateOnLop, daysInMonth, payableDays: effectivePayable });
    pushEarning(m, roundHalfUp(proration.proratedAmountPaise), proration.calcNote);
  }

  // 2. Approved overtime (ATT-08): (BASIC ÷ divisor) × multiplier × hours, on the contracted BASIC.
  if (otMinutes > 0) {
    const basic = salaryComponentsPaise['BASIC'] ?? paise(0);
    otPaise = roundHalfUp(mulDiv(basic, otMinutes * rates.otMultiplier, rates.otDivisor * 60));
    if (otPaise > 0) {
      pushEarning(meta('OT'), otPaise, `Overtime ${String(otMinutes / 60)} h × ₹${rupees(mulDiv(basic, 1, rates.otDivisor))}/h × ${String(rates.otMultiplier)}`);
    }
  }

  // 3. Arrears and variable inputs carry their component's classification.
  const deductionLines: ComputedPayrollLine[] = [];
  const adjust = (adj: AdjustmentInput, fallbackNote: string, source?: RecoveryInput['source']): void => {
    const m = meta(adj.componentCode);
    const amount = roundHalfUp(adj.amountPaise);
    if (m.kind === 'deduction') {
      deductionLines.push({ componentCode: m.code, kind: m.kind, amountPaise: amount, calcNote: adj.note ?? fallbackNote, displayOrder: m.displayOrder, source });
    } else {
      pushEarning(m, amount, adj.note ?? fallbackNote);
    }
  };
  for (const a of arrears) adjust(a, 'Retro arrears delta');
  for (const v of variableInputs) adjust(v, 'Monthly input', { kind: 'input' });

  // 4/5. Statutory deductions.
  const statutory: ComputedPayrollLine[] = [];
  const employer: ComputedPayrollLine[] = [];
  const stat = (code: string, amount: Paise, note: string, order: number): void => {
    if (amount > 0) statutory.push({ componentCode: code, kind: 'deduction', amountPaise: amount, calcNote: note, displayOrder: order });
  };
  const er = (code: string, amount: Paise, note: string, order: number): void => {
    if (amount > 0) employer.push({ componentCode: code, kind: 'employer_contribution', amountPaise: amount, calcNote: note, displayOrder: order });
  };

  const pfMember = pf.applicable && !apprentice;
  if (pfMember && pfWagesPaise > 0) {
    const ceiling = rates.pfWageCeilingPaise;
    // International workers (para 83): PF on the full wages, no ₹15,000 ceiling.
    const actual = pf.internationalWorker === true || pf.wageBasis !== 'CEILING_15000';
    const eeBase = actual ? pfWagesPaise : min(pfWagesPaise, ceiling);
    const ee = roundPfContribution(mulDiv(eeBase, rates.pfEeBp, 10000));
    stat('PF_EE', ee, `PF ${String(rates.pfEeBp / 100)}% of ${pf.internationalWorker === true ? 'full (international worker)' : actual ? 'actual' : 'ceiling-restricted'} PF wages ₹${rupees(eeBase)}`, 100);
    const statutoryBase = min(pfWagesPaise, ceiling);
    // REQ-003: EPS only for EPS members (not a post-Sep-2014 joiner above the ceiling, not 58+);
    // EPS wages never exceed the ceiling. A non-member's whole employer share goes to EPF.
    const epsMember = pf.epsEligible !== false;
    const eps = epsMember ? min(roundPfContribution(mulDiv(statutoryBase, rates.epsBp, 10000)), rates.epsCapPaise) : paise(0);
    const erTotal = roundPfContribution(mulDiv(eeBase, rates.pfErBp, 10000));
    er('PF_ER', paise(Math.max(0, erTotal - eps)), epsMember ? `Employer EPF ${String(rates.pfErBp / 100)}% − EPS on ₹${rupees(eeBase)}` : `Employer EPF ${String(rates.pfErBp / 100)}% on ₹${rupees(eeBase)} (not an EPS member)`, 200);
    er('EPS_ER', eps, `EPS ${String(rates.epsBp / 100)}% of ₹${rupees(statutoryBase)} (cap ₹${rupees(rates.epsCapPaise)})`, 201);
    er('EDLI', min(roundPfContribution(mulDiv(statutoryBase, rates.edliBp, 10000)), rates.edliCapPaise), `EDLI ${String(rates.edliBp / 100)}% of ₹${rupees(statutoryBase)}`, 202);
    er('PF_ADMIN', roundPfContribution(mulDiv(eeBase, rates.pfAdminBp, 10000)), `EPF admin ${String(rates.pfAdminBp / 100)}%`, 203);
  }

  // ESIC wages exclude overtime (ESI Act s.2(22)); coverage is decided per contribution period.
  const esicWagesPaise = subtract(grossPaise, otPaise);
  const esicOn = esicCovered && !apprentice && esicWagesPaise > 0;
  if (esicOn) {
    stat('ESI_EE', roundEsicContribution(mulDiv(esicWagesPaise, rates.esicEeBp, 10000)), `ESIC ${String(rates.esicEeBp / 100)}% of ₹${rupees(esicWagesPaise)} (rounded up)`, 110);
    er('ESI_ER', roundEsicContribution(mulDiv(esicWagesPaise, rates.esicErBp, 10000)), `Employer ESIC ${String(rates.esicErBp / 100)}%`, 210);
  }

  const pt = computeProfessionalTax(grossPaise, contractedGrossPaise, ptSlabs);
  stat('PT', pt, `${stateCode} professional tax`, 120);
  stat('LWF_EE', lwfPaise, `${stateCode} labour welfare fund`, 130);
  if (!apprentice) stat('TDS', roundMonthlyTds(monthlyTdsPaise), 'Monthly TDS u/s 192 (annual projection ÷ 12)', 140);

  // 6. Other recoveries (loan EMI, carried-forward balances).
  for (const od of otherDeductions) {
    const m = meta(od.componentCode);
    deductionLines.push({ componentCode: m.code, kind: 'deduction', amountPaise: roundHalfUp(od.amountPaise), calcNote: od.note, displayOrder: m.displayOrder, source: od.source });
  }

  const statutoryTotal = statutory.reduce((s, l) => add(s, l.amountPaise), paise(0));
  let recoveryTotal = deductionLines.reduce((s, l) => add(s, l.amountPaise), paise(0));
  const carryForward: ComputedEmployeePayroll['carryForward'] = [];

  // 8. Carry-forward: trim recoveries (loans first, then the latest-added) so net ≥ 0.
  let shortfall = subtract(add(statutoryTotal, recoveryTotal), grossPaise);
  if (negativeNetPolicy === 'carry_forward' && shortfall > 0) {
    const order = [...deductionLines].sort((a, b) => Number(b.source?.kind === 'loan') - Number(a.source?.kind === 'loan'));
    for (const line of order) {
      if (shortfall <= 0) break;
      const cut = min(line.amountPaise, shortfall);
      line.amountPaise = subtract(line.amountPaise, cut);
      line.calcNote += ` — ₹${rupees(cut)} carried forward (net pay cannot go negative)`;
      carryForward.push({ componentCode: line.componentCode, amountPaise: cut, source: line.source });
      shortfall = subtract(shortfall, cut);
      recoveryTotal = subtract(recoveryTotal, cut);
    }
  }

  const totalDeductionsPaise = add(statutoryTotal, recoveryTotal);
  const netPayPaise = subtract(grossPaise, totalDeductionsPaise);
  const employerCostPaise = employer.reduce((s, l) => add(s, l.amountPaise), paise(0));
  lines.push(...statutory, ...deductionLines.filter((l) => l.amountPaise !== 0 || l.source?.kind === 'loan'), ...employer);
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
    employerCostPaise,
    pfWagesPaise: pfMember ? pfWagesPaise : paise(0),
    esicWagesPaise: esicOn ? esicWagesPaise : paise(0),
    paymentStatus: hold?.holdType === 'payment' ? 'hold_payment' : 'payable',
    isNegativeNet: netPayPaise < 0,
    lines,
    carryForward,
  };
}
