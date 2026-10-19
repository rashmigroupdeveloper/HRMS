/**
 * Payroll reconciliation fixtures for the fixed engine (P-01, P-04, P-05,
 * P-06, P-14, P-16, P-17, P-18, P-20, P-21, P-25) against the client's June
 * 2026 register row for RML033625 (net ₹59,124) and docs/10 rules.
 */
import { describe, expect, it } from 'vitest';
import { paise, type Paise } from '../src/core/money/index.js';
import {
  computeEmployeePayroll,
  computeProfessionalTax,
  DOCS10_STATUTORY_RATES,
  type ComponentMetadata,
  type PtSlabRow,
} from '../src/modules/payroll-core/engine/compute-engine.js';
import { computeAnnualTax, generateItStatementLines } from '../src/modules/payroll-core/statutory/tds.js';
import { esicPeriodStart, financialYear, resolvePfWageBasis } from '../src/modules/payroll-core/runs/statutory-context.js';
import { loanInstalment } from '../src/modules/payroll-core/runs/run-compute.service.js';

const comp = (code: string, kind: ComponentMetadata['kind'], order: number, extra: Partial<ComponentMetadata> = {}): [string, ComponentMetadata] => [
  code,
  { code, name: code, kind, partOfGross: kind === 'earning', partOfPfWages: code === 'BASIC', prorateOnLop: kind === 'earning' && !['OT', 'INCENTIVE'].includes(code), displayOrder: order, ...extra },
];
const catalog = new Map<string, ComponentMetadata>([
  comp('BASIC', 'earning', 10), comp('HRA', 'earning', 20), comp('EDUCATION_ALLOW', 'earning', 30), comp('MEDICAL_ALLOW', 'earning', 40),
  comp('STATUTORY_BONUS', 'earning', 50), comp('SPECIAL_ALLOW', 'earning', 60), comp('STIPEND', 'earning', 15), comp('OT', 'earning', 80),
  comp('INCENTIVE', 'earning', 85), comp('PF_EE', 'deduction', 100), comp('ESI_EE', 'deduction', 110), comp('PT', 'deduction', 120),
  comp('TDS', 'deduction', 140), comp('CANTEEN', 'deduction', 170), comp('LOAN_EMI', 'deduction', 175), comp('MISC_RECOVERY', 'deduction', 180),
  comp('PF_ER', 'employer_contribution', 200), comp('EPS_ER', 'employer_contribution', 201), comp('EDLI', 'employer_contribution', 202),
  comp('PF_ADMIN', 'employer_contribution', 203), comp('ESI_ER', 'employer_contribution', 210),
]);
const rupees = (r: number): Paise => paise(r * 100);
const line = (r: ReturnType<typeof computeEmployeePayroll>, code: string): number => (r.lines.find((l) => l.componentCode === code)?.amountPaise ?? 0) / 100;
const SAMPLE = { BASIC: rupees(32286), HRA: rupees(16143), EDUCATION_ALLOW: rupees(200), MEDICAL_ALLOW: rupees(1250), STATUTORY_BONUS: rupees(2689), SPECIAL_ALLOW: rupees(12005) };
const OD: PtSlabRow[] = [
  { minMonthlyPaise: paise(0), maxMonthlyPaise: paise(1333333), amountPaise: paise(0), basis: 'contracted_monthly' },
  { minMonthlyPaise: paise(1333334), maxMonthlyPaise: paise(2500000), amountPaise: paise(12500), basis: 'contracted_monthly' },
  { minMonthlyPaise: paise(2500001), maxMonthlyPaise: null, amountPaise: paise(20000), basis: 'contracted_monthly' },
];

describe('register parity — RML033625, June 2026', () => {
  it('nets exactly ₹59,124 on ACTUAL PF wages (P-01)', () => {
    const r = computeEmployeePayroll({
      employeeId: 1, salaryComponentsPaise: SAMPLE, daysInMonth: 30, payableDays: 30,
      variableInputs: [{ componentCode: 'CANTEEN', amountPaise: rupees(1375), note: 'Canteen' }],
    }, catalog);
    expect(r.grossPaise / 100).toBe(64573);
    expect(line(r, 'PF_EE')).toBe(3874);
    expect(line(r, 'PT')).toBe(200);
    expect(line(r, 'ESI_EE')).toBe(0);
    expect(r.totalDeductionsPaise / 100).toBe(5449);
    expect(r.netPayPaise / 100).toBe(59124);
  });

  it('keeps employer contributions out of net and computes them per docs/10 (P-20)', () => {
    const r = computeEmployeePayroll({ employeeId: 1, salaryComponentsPaise: SAMPLE, daysInMonth: 30, payableDays: 30 }, catalog);
    expect(line(r, 'EPS_ER')).toBe(1250);           // 8.33% of 15,000 capped
    expect(line(r, 'PF_ER')).toBe(3874 - 1250);     // 12% − EPS
    expect(line(r, 'EDLI')).toBe(75);
    expect(line(r, 'PF_ADMIN')).toBe(161);          // 0.5% of 32,286
    expect(r.employerCostPaise / 100).toBe(2624 + 1250 + 75 + 161);
    expect(r.netPayPaise).toBe(r.grossPaise - r.totalDeductionsPaise);
  });

  it('restricts PF to ₹15,000 wages only when the basis says so', () => {
    const r = computeEmployeePayroll({ employeeId: 1, salaryComponentsPaise: SAMPLE, daysInMonth: 30, payableDays: 30, pf: { applicable: true, wageBasis: 'CEILING_15000' } }, catalog);
    expect(line(r, 'PF_EE')).toBe(1800);
    expect(resolvePfWageBasis('ACTUAL', null, null)).toBe('ACTUAL');
    expect(resolvePfWageBasis('CEILING_15000', null, null)).toBe('CEILING_15000');
    expect(resolvePfWageBasis('ACTUAL', 'CEILING_15000', null)).toBe('CEILING_15000');
    expect(resolvePfWageBasis('CEILING_15000', 'CEILING_15000', 'ACTUAL')).toBe('ACTUAL');
  });
});

describe('statutory rules', () => {
  it('prorates every earning including bonus and rounds each line to the rupee (P-16, P-21)', () => {
    const r = computeEmployeePayroll({ employeeId: 2, salaryComponentsPaise: SAMPLE, daysInMonth: 30, payableDays: 15 }, catalog);
    expect(line(r, 'STATUTORY_BONUS')).toBe(1345);   // 2689 × 15/30 = 1344.5 → 1345
    expect(r.lines.every((l) => l.amountPaise % 100 === 0)).toBe(true);
    const zero = computeEmployeePayroll({ employeeId: 3, salaryComponentsPaise: SAMPLE, daysInMonth: 30, payableDays: 0 }, catalog);
    expect(zero.grossPaise).toBe(0);
    expect(zero.netPayPaise).toBe(0);
  });

  it('charges ESIC only to covered employees, on gross excluding OT, rounded up (P-05)', () => {
    const base = { BASIC: rupees(9250), HRA: rupees(4625), SPECIAL_ALLOW: rupees(4625) };
    const notCovered = computeEmployeePayroll({ employeeId: 4, salaryComponentsPaise: base, daysInMonth: 30, payableDays: 30 }, catalog);
    expect(line(notCovered, 'ESI_EE')).toBe(0);
    const covered = computeEmployeePayroll({ employeeId: 4, salaryComponentsPaise: base, daysInMonth: 30, payableDays: 30, esicCovered: true, otMinutes: 240 }, catalog);
    expect(line(covered, 'OT')).toBe(356);             // 9250/208 × 2 × 4 = 355.77
    expect(line(covered, 'ESI_EE')).toBe(139);         // 0.75% of 18,500 = 138.75 ↑
    expect(line(covered, 'ESI_ER')).toBe(602);         // 3.25% of 18,500 = 601.25 ↑
    expect(esicPeriodStart('2026-06-01')).toBe('2026-04-01');
    expect(esicPeriodStart('2026-11-01')).toBe('2026-10-01');
    expect(esicPeriodStart('2027-02-01')).toBe('2026-10-01');
  });

  it('pays OT at BASIC ÷ 208 × 2 per hour (P-06)', () => {
    const r = computeEmployeePayroll({ employeeId: 5, salaryComponentsPaise: { BASIC: rupees(27500), HRA: rupees(27500) }, daysInMonth: 30, payableDays: 30, otMinutes: 240 }, catalog);
    expect(line(r, 'OT')).toBe(1058);
    expect(r.grossPaise / 100).toBe(56058);
  });

  it('exempts apprentices from PF, ESIC and bonus; PT and TDS still apply (PAY-14, docs/10 §9)', () => {
    const r = computeEmployeePayroll({ employeeId: 6, salaryComponentsPaise: { STIPEND: rupees(15000), STATUTORY_BONUS: rupees(1249) }, daysInMonth: 30, payableDays: 30, apprentice: true, esicCovered: true, monthlyTdsPaise: rupees(500) }, catalog);
    expect(r.grossPaise / 100).toBe(15000);
    expect(line(r, 'PF_EE') + line(r, 'ESI_EE')).toBe(0);
    expect(line(r, 'TDS')).toBe(500);
    expect(line(r, 'PT')).toBe(110);
  });

  it('applies Odisha PT on contracted monthly gross and WB PT on earned gross (P-17)', () => {
    expect(computeProfessionalTax(rupees(35000), rupees(35000), OD) / 100).toBe(200);
    expect(computeProfessionalTax(rupees(20000), rupees(20000), OD) / 100).toBe(125);
    expect(computeProfessionalTax(rupees(12000), rupees(12000), OD) / 100).toBe(0);
    expect(computeProfessionalTax(0 as Paise, rupees(35000), OD)).toBe(0);
    const r = computeEmployeePayroll({ employeeId: 7, salaryComponentsPaise: { BASIC: rupees(17500), HRA: rupees(17500) }, daysInMonth: 30, payableDays: 30, ptSlabs: OD, stateCode: 'OD' }, catalog);
    expect(line(r, 'PT')).toBe(200);
  });

  it('never lets recoveries push net below zero under carry-forward; flags it otherwise (P-14)', () => {
    const input = {
      employeeId: 8, salaryComponentsPaise: { BASIC: rupees(6000), HRA: rupees(6000) }, daysInMonth: 30, payableDays: 7, esicCovered: true,
      variableInputs: [{ componentCode: 'CANTEEN', amountPaise: rupees(1375), note: 'Canteen' }],
      otherDeductions: [{ componentCode: 'LOAN_EMI', amountPaise: rupees(6000), note: 'Loan #9', source: { kind: 'loan' as const, loanId: 9 } }],
    };
    const flagged = computeEmployeePayroll(input, catalog);
    expect(flagged.isNegativeNet).toBe(true);
    const carried = computeEmployeePayroll({ ...input, negativeNetPolicy: 'carry_forward' }, catalog);
    expect(carried.netPayPaise).toBe(0);
    expect(line(carried, 'PF_EE')).toBe(168);           // statutory lines are never trimmed
    expect(line(carried, 'ESI_EE')).toBe(21);
    // Shortfall 168 + 21 + 1,375 + 6,000 − 2,800 = 4,764 comes off the loan first.
    expect(line(carried, 'LOAN_EMI')).toBe(6000 - 4764);
    expect(line(carried, 'CANTEEN')).toBe(1375);
    expect(carried.carryForward).toEqual([{ componentCode: 'LOAN_EMI', amountPaise: rupees(4764), source: { kind: 'loan', loanId: 9 } }]);
  });
});

describe('TDS projection (P-04, P-25)', () => {
  const annualTax = (annual: number, regime: 'new' | 'old', deductions = 0) =>
    computeAnnualTax(rupees(annual - (regime === 'new' ? 75000 : 50000) - deductions), regime).totalTaxWithCessPaise / 100;
  it('matches the payroll-test expectations per month', () => {
    expect(Math.round(annualTax(110000 * 12, 'new') / 12)).toBe(3900);
    expect(Math.round(annualTax(450000 * 12, 'new') / 12)).toBe(112255);
    expect(Math.round(annualTax(120000 * 12, 'old', 150000 + 2400) / 12)).toBe(15928);
    expect(annualTax(75000 * 12, 'new')).toBe(0);         // 87A up to ₹12L
  });
  it('limits tax + surcharge just above ₹50L to the income over ₹50L (marginal relief)', () => {
    const at50 = computeAnnualTax(rupees(5000000), 'new');
    const just = computeAnnualTax(rupees(5010000), 'new');
    const preCess = (t: typeof at50) => t.baseTaxPaise - t.rebate87aPaise + t.surchargePaise;
    expect(preCess(just) - preCess(at50)).toBeLessThanOrEqual(rupees(10000));
  });
  it('uses the ₹50,000 standard deduction in the old-regime IT statement', () => {
    expect(generateItStatementLines({ grossSalaryPaise: rupees(1440000), regime: 'old' }).lineI_StandardDeduction).toBe(rupees(50000));
    expect(generateItStatementLines({ grossSalaryPaise: rupees(1440000) }).lineI_StandardDeduction).toBe(rupees(75000));
    expect(financialYear('2026-06-01')).toBe('2026-27');
    expect(financialYear('2027-01-01')).toBe('2026-27');
  });
});

describe('loan instalments (P-08)', () => {
  it('recovers principal only for interest-free loans and reducing-balance interest otherwise', () => {
    expect(loanInstalment({ outstanding: '60000.00', emi: '5000.00', interest_rate: '0', loan_type: 'emi_no_interest' })).toEqual({ principalPaise: 500000, interestPaise: 0 });
    expect(loanInstalment({ outstanding: '3000.00', emi: '5000.00', interest_rate: '0', loan_type: 'salary_advance' }).principalPaise).toBe(300000);
    const i = loanInstalment({ outstanding: '120000.00', emi: '10000.00', interest_rate: '12', loan_type: 'loan_diminishing' });
    expect(i.interestPaise).toBe(120000);
    expect(i.principalPaise).toBe(880000);
  });
  it('rates object mirrors docs/10', () => {
    expect(DOCS10_STATUTORY_RATES.esicCeilingPaise).toBe(rupees(21000));
  });
});
