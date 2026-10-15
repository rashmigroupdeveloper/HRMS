/** PAY-02/04: the assignment-to-run boundary must conserve the original paise. */
import { describe, expect, it } from 'vitest';
import { salarySnapshotToPaise } from '../src/modules/payroll-core/salaries/salary-snapshot.js';

describe('Salary snapshot unit contract', () => {
  it('keeps ₹10,000 BASIC as 1,000,000 paise through the run boundary', () => {
    expect(salarySnapshotToPaise({ BASIC: 1000000 })).toEqual({ BASIC: 1000000 });
  });
  it('retains exact paise rather than multiplying a salary by 100', () => {
    expect(salarySnapshotToPaise({ BASIC: 1000001, HRA: 500000 })).toEqual({
      BASIC: 1000001,
      HRA: 500000,
    });
  });
  it('rejects a fractional paise amount instead of guessing a legacy rupee unit', () => {
    expect(() => salarySnapshotToPaise({ BASIC: 10000.25 })).toThrow('integer paise');
  });
});
