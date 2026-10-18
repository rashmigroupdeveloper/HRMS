import { describe, expect, it } from 'vitest';
import { policyInterestRate } from '../src/modules/loans/loans.service.js';
import { loanInstalment } from '../src/modules/payroll-core/runs/run-compute.service.js';

describe('Loan policy (P-08 / S-18)', () => {
  it('interest-free loan types never read the interest policy', async () => {
    const noDb = {} as never;
    for (const type of ['emi_no_interest', 'salary_advance', 'travel_advance'] as const) {
      expect(await policyInterestRate(noDb, type)).toBe(0);
    }
  });
  it('instalment never exceeds the outstanding balance and splits diminishing interest', () => {
    expect(loanInstalment({ outstanding: '1200.00', emi: '5000.00', interest_rate: '0', loan_type: 'emi_no_interest' })).toEqual({ principalPaise: 120000, interestPaise: 0 });
    expect(loanInstalment({ outstanding: '12000.00', emi: '1100.00', interest_rate: '12', loan_type: 'loan_diminishing' })).toEqual({ principalPaise: 98000, interestPaise: 12000 });
    expect(loanInstalment({ outstanding: '12000.00', emi: '1100.00', interest_rate: '0', loan_type: 'loan_diminishing' })).toEqual({ principalPaise: 110000, interestPaise: 0 });
  });
});
