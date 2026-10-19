/** REQ-003 / RQ-JF-014: EPS membership, age 58, international workers, EPS wage ceiling. */
import { describe, expect, it } from 'vitest';
import { paise, type Paise } from '../src/core/money/index.js';
import { computeEmployeePayroll, type ComponentMetadata } from '../src/modules/payroll-core/index.js';
import { epsEligibility, type EpsEligibilityInput } from '../src/modules/payroll-core/statutory/eps-eligibility.js';
import { computePf } from '../src/modules/payroll-core/statutory/pf.js';

const base: EpsEligibilityInput = { monthStart: '2026-06-01', dob: '1990-05-10', doj: '2020-04-01', epsEligible: null, memberBeforeSep2014: null, firstEnrolledOn: null, firstEnrolmentPfWagesPaise: null };
const rupees = (r: number): Paise => paise(r * 100);

describe('epsEligibility', () => {
  it('derives membership from enrolment date and first PF wages', () => {
    expect(epsEligibility(base)).toEqual({ eligible: true, reason: 'wages_unknown' });
    expect(epsEligibility({ ...base, firstEnrolmentPfWagesPaise: 1_500_100 })).toEqual({ eligible: false, reason: 'new_member_above_ceiling' });
    expect(epsEligibility({ ...base, firstEnrolmentPfWagesPaise: 1_500_000 })).toEqual({ eligible: true, reason: 'new_member_within_ceiling' });
    expect(epsEligibility({ ...base, firstEnrolmentPfWagesPaise: 3_000_000, memberBeforeSep2014: true }).reason).toBe('member_before_sep_2014');
    expect(epsEligibility({ ...base, firstEnrolmentPfWagesPaise: 3_000_000, firstEnrolledOn: '2014-08-31' }).eligible).toBe(true);
    expect(epsEligibility({ ...base, firstEnrolmentPfWagesPaise: 3_000_000, firstEnrolledOn: '2014-09-01' }).eligible).toBe(false);
    expect(epsEligibility({ ...base, doj: '2012-01-01', firstEnrolmentPfWagesPaise: 3_000_000 }).eligible).toBe(true);
    expect(epsEligibility({ ...base, doj: null, firstEnrolmentPfWagesPaise: 3_000_000 }).eligible).toBe(false);
    // Form 11 "not an earlier member": our joining salary is the first-enrolment wage.
    expect(epsEligibility({ ...base, memberBeforeSep2014: false, joiningPfWagesPaise: 2_500_000 })).toEqual({ eligible: false, reason: 'new_member_above_ceiling' });
    expect(epsEligibility({ ...base, memberBeforeSep2014: false, joiningPfWagesPaise: 1_200_000 }).eligible).toBe(true);
    // No Form 11 data: joining wage alone never removes EPS.
    expect(epsEligibility({ ...base, joiningPfWagesPaise: 2_500_000 }).reason).toBe('wages_unknown');
  });
  it('lets an HR decision override the derivation but never the age-58 stop', () => {
    expect(epsEligibility({ ...base, epsEligible: true, firstEnrolmentPfWagesPaise: 3_000_000 })).toEqual({ eligible: true, reason: 'hr_decision' });
    expect(epsEligibility({ ...base, epsEligible: false })).toEqual({ eligible: false, reason: 'hr_decision' });
    expect(epsEligibility({ ...base, dob: '1968-06-01', epsEligible: true })).toEqual({ eligible: false, reason: 'age_58' });
    expect(epsEligibility({ ...base, dob: '1968-06-02', epsEligible: true }).eligible).toBe(true);
    expect(epsEligibility({ ...base, dob: '1968-05-31', epsEligible: true }).eligible).toBe(false);
  });
});

const comp = (code: string, kind: ComponentMetadata['kind'], order: number): [string, ComponentMetadata] => [code, { code, name: code, kind, partOfGross: kind === 'earning', partOfPfWages: code === 'BASIC', prorateOnLop: kind === 'earning', displayOrder: order }];
const catalog = new Map<string, ComponentMetadata>([comp('BASIC', 'earning', 10), comp('HRA', 'earning', 20), comp('PF_EE', 'deduction', 100), comp('PF_ER', 'employer_contribution', 200), comp('EPS_ER', 'employer_contribution', 201), comp('EDLI', 'employer_contribution', 202), comp('PF_ADMIN', 'employer_contribution', 203)]);
const line = (r: ReturnType<typeof computeEmployeePayroll>, code: string): number => (r.lines.find((l) => l.componentCode === code)?.amountPaise ?? 0) / 100;
const run = (pf: Parameters<typeof computeEmployeePayroll>[0]['pf']) => computeEmployeePayroll({ employeeId: 1, salaryComponentsPaise: { BASIC: rupees(30000), HRA: rupees(15000) }, daysInMonth: 30, payableDays: 30, pf }, catalog);

describe('engine EPS split', () => {
  it('moves the whole employer 12% to EPF for a non-member and leaves net pay unchanged', () => {
    const member = run({ applicable: true, wageBasis: 'ACTUAL' });
    const non = run({ applicable: true, wageBasis: 'ACTUAL', epsEligible: false });
    expect([line(member, 'EPS_ER'), line(member, 'PF_ER')]).toEqual([1250, 2350]);
    expect([line(non, 'EPS_ER'), line(non, 'PF_ER')]).toEqual([0, 3600]);
    expect(non.netPayPaise).toBe(member.netPayPaise);
    expect(non.employerCostPaise).toBe(member.employerCostPaise);
  });
  it('ignores the ₹15,000 ceiling for an international worker but caps EPS wages', () => {
    const local = run({ applicable: true, wageBasis: 'CEILING_15000' });
    const iw = run({ applicable: true, wageBasis: 'CEILING_15000', internationalWorker: true });
    expect([line(local, 'PF_EE'), line(local, 'PF_ER'), line(local, 'EPS_ER')]).toEqual([1800, 550, 1250]);
    expect([line(iw, 'PF_EE'), line(iw, 'PF_ER'), line(iw, 'EPS_ER')]).toEqual([3600, 2350, 1250]);
  });
});

describe('computePf (statutory estimate / ECR)', () => {
  it('reports zero EPS wages for a non-member and full wages for an international worker', () => {
    const non = computePf({ pfWagesPaise: rupees(30000), epsEligible: false });
    expect([non.erEpsPaise, non.epsWagesPaise, non.erEpfPaise]).toEqual([0, 0, 360000]);
    const iw = computePf({ pfWagesPaise: rupees(30000), wageBaseMode: 'CEILING_15000', internationalWorker: true });
    expect([iw.eePfPaise, iw.erEpsPaise, iw.epsWagesPaise]).toEqual([360000, 125000, 1500000]);
  });
});
