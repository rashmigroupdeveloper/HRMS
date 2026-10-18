/**
 * Payroll Pipeline & Compute Engine Tests (PAY-03, PAY-04, PAY-08, PAY-16, SOW crosswalk).
 *
 * Verifies:
 *   1. 8-state machine transition validation & illegal transition rejection
 *   2. Attendance month-lock requirement (ATT-12/15)
 *   3. Two-person authorization rule (maker != checker)
 *   4. Integer-paise proration engine (zero float arithmetic)
 *   5. Full calculation sequence (Gross -> PF -> ESIC -> PT -> TDS -> Net)
 *   6. Negative net preservation (never clamped to zero)
 *   7. Salary holds (payment hold vs process hold)
 *   8. Retro arrears recompute-and-delta
 *   9. Mid-month joiner (G7 fixture: 17/31 payable days)
 *  10. Net == Gross - Deductions exact property invariant
 */

import { describe, it, expect } from 'vitest';
import {
  validateRunTransition,
  isRunImmutable,
} from '../src/modules/payroll-core/runs/run-state-machine.js';
import {
  computeAttendanceSummary,
  prorateComponent,
} from '../src/modules/payroll-core/engine/proration.js';
import {
  computeEmployeePayroll,
  computeWestBengalPt,
  type ComponentMetadata,
} from '../src/modules/payroll-core/engine/compute-engine.js';
import {
  computeRetroDeltas,
  aggregateArrearsForRun,
} from '../src/modules/payroll-core/engine/arrears.js';
import { paise } from '../src/core/money/index.js';

describe('Payroll Run State Machine (PAY-03)', () => {
  it('allows valid progressive lifecycle transitions', () => {
    // draft -> inputs_locked
    expect(
      validateRunTransition({
        fromStatus: 'draft',
        toStatus: 'inputs_locked',
        actorUserId: 10,
      }).valid
    ).toBe(true);

    // inputs_locked -> computed (with attendance lock)
    expect(
      validateRunTransition({
        fromStatus: 'inputs_locked',
        toStatus: 'computed',
        attendanceLockId: 101,
        actorUserId: 10,
      }).valid
    ).toBe(true);

    // computed -> under_review
    expect(
      validateRunTransition({
        fromStatus: 'computed',
        toStatus: 'under_review',
        actorUserId: 10,
      }).valid
    ).toBe(true);

    // under_review -> approved (with independent checker)
    expect(
      validateRunTransition({
        fromStatus: 'under_review',
        toStatus: 'approved',
        makerUserId: 10,
        actorUserId: 20, // Different user
      }).valid
    ).toBe(true);

    // approved -> finalized (with 0 paise reconciliation diff)
    expect(
      validateRunTransition({
        fromStatus: 'approved',
        toStatus: 'finalized',
        reconciliationDiffPaise: 0,
        actorUserId: 20,
      }).valid
    ).toBe(true);

    // finalized -> paid
    expect(
      validateRunTransition({
        fromStatus: 'finalized',
        toStatus: 'paid',
        actorUserId: 30,
      }).valid
    ).toBe(true);
  });

  it('rejects illegal transition jumps', () => {
    // Cannot jump draft -> computed
    const jumpRes = validateRunTransition({
      fromStatus: 'draft',
      toStatus: 'computed',
      actorUserId: 10,
    });
    expect(jumpRes.valid).toBe(false);
    expect(jumpRes.error).toContain("Illegal state transition from 'draft' to 'computed'");

    // Cannot jump under_review -> finalized
    const unapprovedRes = validateRunTransition({
      fromStatus: 'under_review',
      toStatus: 'finalized',
      actorUserId: 10,
    });
    expect(unapprovedRes.valid).toBe(false);
  });

  it('enforces attendance month lock before moving to computed (ATT-12/15, C11)', () => {
    const withoutLock = validateRunTransition({
      fromStatus: 'inputs_locked',
      toStatus: 'computed',
      attendanceLockId: null,
      actorUserId: 10,
    });
    expect(withoutLock.valid).toBe(false);
    expect(withoutLock.error).toContain('attendance_lock_id is required');
  });

  it('enforces two-person maker-checker rule on run approval (C12)', () => {
    // Maker tries to self-approve
    const selfApprove = validateRunTransition({
      fromStatus: 'under_review',
      toStatus: 'approved',
      makerUserId: 10,
      actorUserId: 10,
    });
    expect(selfApprove.valid).toBe(false);
    expect(selfApprove.error).toContain('Two-person authorization violation');

    // Independent checker succeeds
    const checkerApprove = validateRunTransition({
      fromStatus: 'under_review',
      toStatus: 'approved',
      makerUserId: 10,
      actorUserId: 20,
    });
    expect(checkerApprove.valid).toBe(true);
  });

  it('blocks finalization if reconciliation discrepancy exists (doc 14 §7.7)', () => {
    const mismatched = validateRunTransition({
      fromStatus: 'approved',
      toStatus: 'finalized',
      reconciliationDiffPaise: 150, // 150 paise diff
      actorUserId: 20,
    });
    expect(mismatched.valid).toBe(false);
    expect(mismatched.error).toContain('Independent reconciliation mismatch of 150 paise');
  });

  it('allows reopening only with an audit justification', () => {
    const noReason = validateRunTransition({
      fromStatus: 'approved',
      toStatus: 'reopened',
      reopenReason: '',
      actorUserId: 1,
    });
    expect(noReason.valid).toBe(false);

    const withReason = validateRunTransition({
      fromStatus: 'approved',
      toStatus: 'reopened',
      reopenReason: 'Correcting missed production incentive entries',
      actorUserId: 1,
    });
    expect(withReason.valid).toBe(true);
  });

  it('identifies finalized and paid states as immutable', () => {
    expect(isRunImmutable('draft')).toBe(false);
    expect(isRunImmutable('computed')).toBe(false);
    expect(isRunImmutable('finalized')).toBe(true);
    expect(isRunImmutable('paid')).toBe(true);
  });
});

describe('Attendance Proration Engine (PAY-04)', () => {
  it('computes correct calendar days and LOP days', () => {
    // May 2026 has 31 days
    const summary = computeAttendanceSummary(2026, 5, 26, 0);
    expect(summary.daysInMonth).toBe(31);
    expect(summary.payableDays).toBe(26);
    expect(summary.lopDays).toBe(5);
  });

  it('prorates flagged earnings by payable days down to the paisa', () => {
    // Basic ₹31,000 in a 31-day month, worked 20 days -> exactly ₹20,000
    const res = prorateComponent({
      componentCode: 'BASIC',
      monthlyAmountPaise: paise(3100000), // ₹31,000
      prorateOnLop: true,
      daysInMonth: 31,
      payableDays: 20,
    });

    expect(res.proratedAmountPaise).toBe(paise(2000000)); // Exactly ₹20,000
    expect(res.lopDays).toBe(11);
  });

  it('does not prorate non-lop components', () => {
    const res = prorateComponent({
      componentCode: 'MEDICAL_ALLOW',
      monthlyAmountPaise: paise(125000), // ₹1,250
      prorateOnLop: false,
      daysInMonth: 31,
      payableDays: 15,
    });

    expect(res.proratedAmountPaise).toBe(paise(125000)); // Full ₹1,250
  });

  it('returns zero for full month LOP', () => {
    const res = prorateComponent({
      componentCode: 'BASIC',
      monthlyAmountPaise: paise(5000000),
      prorateOnLop: true,
      daysInMonth: 30,
      payableDays: 0,
    });

    expect(res.proratedAmountPaise).toBe(paise(0));
    expect(res.lopDays).toBe(30);
  });
});

describe('Payroll Compute Engine (docs/04 §3 & docs/10)', () => {
  const catalog = new Map<string, ComponentMetadata>([
    [
      'BASIC',
      {
        code: 'BASIC',
        name: 'Basic Salary',
        kind: 'earning',
        partOfGross: true,
        partOfPfWages: true,
        prorateOnLop: true,
        displayOrder: 10,
      },
    ],
    [
      'HRA',
      {
        code: 'HRA',
        name: 'House Rent Allowance',
        kind: 'earning',
        partOfGross: true,
        partOfPfWages: false,
        prorateOnLop: true,
        displayOrder: 20,
      },
    ],
    [
      'SPECIAL_ALLOW',
      {
        code: 'SPECIAL_ALLOW',
        name: 'Special Allowance',
        kind: 'earning',
        partOfGross: true,
        partOfPfWages: false,
        prorateOnLop: true,
        displayOrder: 30,
      },
    ],
    [
      'MEDICAL_ALLOW',
      {
        code: 'MEDICAL_ALLOW',
        name: 'Medical Allowance',
        kind: 'earning',
        partOfGross: true,
        partOfPfWages: false,
        prorateOnLop: false,
        displayOrder: 40,
      },
    ],
    [
      'MISC_RECOVERY',
      {
        code: 'MISC_RECOVERY',
        name: 'Misc Recovery',
        kind: 'deduction',
        partOfGross: false,
        partOfPfWages: false,
        prorateOnLop: false,
        displayOrder: 160,
      },
    ],
  ]);

  it('computes exact statutory deductions and net pay (G1 Baseline)', () => {
    // Basic ₹32,286 (3228600 p), HRA ₹16,143 (1614300 p), Special ₹16,144 (1614400 p)
    // Gross = ₹64,573
    // PF wages = ₹32,286, PF ceiling = 15,000 -> 12% of 15,000 = ₹1,800 (if capped)
    // WB PT on Gross ₹64,573 (>40k) = ₹200 (20000 p)
    const result = computeEmployeePayroll(
      {
        employeeId: 101,
        salaryComponentsPaise: {
          BASIC: paise(3228600),
          HRA: paise(1614300),
          SPECIAL_ALLOW: paise(1614400),
        },
        daysInMonth: 31,
        payableDays: 31,
        pf: { applicable: true, wageBasis: 'CEILING_15000' }, // ₹15,000 restricted wages
      },
      catalog
    );

    expect(result.grossPaise).toBe(paise(6457300)); // ₹64,573
    // PF 12% on 15,000 = ₹1,800
    // PT = ₹200
    // Total deductions = ₹2,000
    expect(result.totalDeductionsPaise).toBe(paise(200000));
    // Net Pay = 64,573 - 2,000 = ₹62,573
    expect(result.netPayPaise).toBe(paise(6257300));
    expect(result.paymentStatus).toBe('payable');
    expect(result.isNegativeNet).toBe(false);

    // Verify Property: Net == Gross - Deductions
    expect(result.netPayPaise).toBe(result.grossPaise - result.totalDeductionsPaise);
  });

  it('handles mid-month joiner (G7 Fixture: 17/31 days)', () => {
    // Basic ₹31,000 (3100000 p), HRA ₹15,500 (1550000 p), Medical ₹1,250 (not prorated)
    const result = computeEmployeePayroll(
      {
        employeeId: 102,
        salaryComponentsPaise: {
          BASIC: paise(3100000),
          HRA: paise(1550000),
          MEDICAL_ALLOW: paise(125000),
        },
        daysInMonth: 31,
        payableDays: 17, // Joined mid-month
      },
      catalog
    );

    // Prorated Basic = 31,000 * 17 / 31 = ₹17,000 (1700000 p)
    // Prorated HRA = 15,500 * 17 / 31 = ₹8,500 (850000 p)
    // Fixed Medical = ₹1,250 (125000 p)
    // Gross = 17,000 + 8,500 + 1,250 = ₹26,750 (2675000 p)
    expect(result.grossPaise).toBe(paise(2675000));
    expect(result.lopDays).toBe(14);
    // Net == Gross - Deductions
    expect(result.netPayPaise).toBe(result.grossPaise - result.totalDeductionsPaise);
  });

  it('preserves negative net pay without silently clamping to zero (PAY-04)', () => {
    // Employee with massive recovery deduction exceeding earnings
    const result = computeEmployeePayroll(
      {
        employeeId: 103,
        salaryComponentsPaise: {
          BASIC: paise(1000000), // ₹10,000
        },
        daysInMonth: 30,
        payableDays: 10, // Prorated Basic = ₹3,333.33 -> 333333 p
        otherDeductions: [
          {
            componentCode: 'MISC_RECOVERY',
            amountPaise: paise(500000), // ₹5,000 deduction
            note: 'Advance recovery shortfall',
          },
        ],
      },
      catalog
    );

    // Net must be negative and NOT clamped to 0
    expect(result.isNegativeNet).toBe(true);
    expect(result.netPayPaise).toBeLessThan(0);
    expect(result.netPayPaise).toBe(result.grossPaise - result.totalDeductionsPaise);
  });

  it('respects salary payment hold vs process hold (PAY-08)', () => {
    // Payment Hold: calculates full gross and taxes, marks status as hold_payment
    const payHoldResult = computeEmployeePayroll(
      {
        employeeId: 104,
        salaryComponentsPaise: {
          BASIC: paise(3000000),
        },
        daysInMonth: 30,
        payableDays: 30,
        hold: {
          hasHold: true,
          holdType: 'payment',
          reason: 'Bank account validation pending',
        },
      },
      catalog
    );

    expect(payHoldResult.grossPaise).toBe(paise(3000000));
    expect(payHoldResult.paymentStatus).toBe('hold_payment');

    // Process Hold: zeroes out completely
    const procHoldResult = computeEmployeePayroll(
      {
        employeeId: 105,
        salaryComponentsPaise: {
          BASIC: paise(3000000),
        },
        daysInMonth: 30,
        payableDays: 30,
        hold: {
          hasHold: true,
          holdType: 'process',
          reason: 'Absconding investigation',
        },
      },
      catalog
    );

    expect(procHoldResult.grossPaise).toBe(paise(0));
    expect(procHoldResult.netPayPaise).toBe(paise(0));
    expect(procHoldResult.paymentStatus).toBe('hold_process');
  });

  it('computes West Bengal Professional Tax slabs accurately', () => {
    expect(computeWestBengalPt(paise(900000))).toBe(paise(0)); // <= 10k: 0
    expect(computeWestBengalPt(paise(1200000))).toBe(paise(11000)); // 10k-15k: ₹110
    expect(computeWestBengalPt(paise(2000000))).toBe(paise(13000)); // 15k-25k: ₹130
    expect(computeWestBengalPt(paise(3000000))).toBe(paise(15000)); // 25k-40k: ₹150
    expect(computeWestBengalPt(paise(6500000))).toBe(paise(20000)); // > 40k: ₹200
  });
});

describe('Retroactive Arrears Engine (PAY-16)', () => {
  it('computes exact component deltas for past months', () => {
    const historical = {
      BASIC: paise(3000000), // ₹30,000
      HRA: paise(1500000), // ₹15,000
    };
    const revised = {
      BASIC: paise(3500000), // ₹35,000 (+5,000)
      HRA: paise(1750000), // ₹17,500 (+2,500)
    };

    const deltas = computeRetroDeltas('2026-04-01', historical, revised);
    expect(deltas.length).toBe(2);

    const basicDelta = deltas.find((d) => d.componentCode === 'BASIC');
    expect(basicDelta?.deltaPaise).toBe(paise(500000)); // ₹5,000

    const hraDelta = deltas.find((d) => d.componentCode === 'HRA');
    expect(hraDelta?.deltaPaise).toBe(paise(250000)); // ₹2,500
  });

  it('aggregates multi-month arrears into scheduled run totals', () => {
    const items = [
      {
        employeeId: 1,
        sourceSalaryId: 10,
        forMonth: '2026-04-01',
        componentCode: 'BASIC',
        amountPaise: paise(500000),
      },
      {
        employeeId: 1,
        sourceSalaryId: 10,
        forMonth: '2026-05-01',
        componentCode: 'BASIC',
        amountPaise: paise(500000),
      },
      {
        employeeId: 1,
        sourceSalaryId: 10,
        forMonth: '2026-05-01',
        componentCode: 'HRA',
        amountPaise: paise(250000),
      },
    ];

    const agg = aggregateArrearsForRun(items);
    expect(agg.totalArrearsPaise).toBe(paise(1250000)); // ₹12,500 total
    expect(agg.byComponent['BASIC']).toBe(paise(1000000)); // ₹10,000
    expect(agg.byComponent['HRA']).toBe(paise(250000)); // ₹2,500
    expect(agg.itemCount).toBe(3);
  });
});
