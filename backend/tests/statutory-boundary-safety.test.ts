/** PAY-09/14/15: explicit enrollment facts, legal contract and safe calendar/money boundaries. */
import { describe, expect, it } from 'vitest';
import { epsEligibility } from '../src/modules/payroll-core/statutory/eps-eligibility.js';
import { isApprentice } from '../src/modules/payroll-core/statutory/apprentice.js';
import { calculateGratuity, calculateServiceTenure } from '../src/modules/payroll-core/fnf/gratuity-calculator.js';
import { computeFnfSettlement } from '../src/modules/payroll-core/fnf/fnf-engine.js';

const gratuity = { basicMonthlyPaise: 3_000_000, doj: '2020-01-31', lastWorkingDay: '2026-03-01' };
const fnf = {employeeId:1,separationId:1,doj:'2020-01-01',approvedLwd:'2026-09-15',daysPayable:7.5,daysInMonth:30,basicMonthlyPaise:1_000_000,grossMonthlyPaise:1_000_000,elBalanceDays:0,shortfallDays:0};
describe('statutory input and calendar safety', () => {
  it('does not replace explicit Form 11 non-membership with an old employment date', () => {
    expect(epsEligibility({monthStart:'2026-06-01',dob:'1990-01-01',doj:'2010-01-01',epsEligible:null,
      memberBeforeSep2014:false,firstEnrolledOn:null,firstEnrolmentPfWagesPaise:null,joiningPfWagesPaise:3_000_000}))
      .toEqual({eligible:false,reason:'new_member_above_ceiling'});
  });
  it.each(['white_collar','blue_collar','trainee'])('uses the designated apprentice contract consistently for %s', category => {
    expect(isApprentice(category,'apprentice')).toBe(true);
    expect(isApprentice(category,'permanent')).toBe(false);
  });
  it('never produces negative residual days around a short month', () => {
    expect(calculateServiceTenure('2020-01-31','2026-03-01')).toMatchObject({years:6,months:1,days:1});
  });
  it.each(['invalid','2026-02-30'])('rejects an invalid gratuity calendar date: %s', date => {
    expect(()=>calculateGratuity({...gratuity,lastWorkingDay:date})).toThrow(/date|calendar/i);
  });
  it.each([NaN,Infinity,-100,1.5,Number.MAX_SAFE_INTEGER])('rejects unsafe gratuity paise: %s', amount => {
    expect(()=>calculateGratuity({...gratuity,basicMonthlyPaise:amount})).toThrow();
  });
  it.each([{daysPayable:Infinity},{daysPayable:-1},{daysPayable:31},{daysInMonth:0},{elBalanceDays:-1},{tdsPaise:-100},{grossMonthlyPaise:1.5}])('rejects invalid final-settlement inputs %j', invalid => {
    expect(()=>computeFnfSettlement({...fnf,...invalid})).toThrow();
  });
  it('retains the approved fractional payable-day arithmetic', () => {
    const result = computeFnfSettlement(fnf);
    expect(result.earnings.proratedSalaryPaise).toBe(250_000); // ₹10,000 × 7.5 / 30
    expect(result.lines.reduce((s,l)=>s+(l.category==='deduction'?-l.amountPaise:l.amountPaise),0)).toBe(result.netPayablePaise);
  });
});
