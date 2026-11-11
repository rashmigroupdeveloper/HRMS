/**
 * DEEP AND EXTENSIVE BUG TESTING SUITE FOR RASHMI GROUP HRMS
 * Covers edge cases, boundary conditions, financial calculations, statutory compliance,
 * security boundaries, state machine transitions, and cross-module workflows.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Kysely, Selectable } from 'kysely';
import type { Database, AttShiftsTable, DayStatus } from '../src/core/db/types.js';
import { createDatabase } from '../src/core/db/database.js';
import { createApp } from '../src/app.js';
import { httpRequest } from './http-client.js';
import { signAccessToken } from '../src/core/auth/jwt.js';
import { paise } from '../src/core/money/index.js';
import { roundPfContribution, roundEsicContribution, roundMonthlyTds } from '../src/core/money/rounding-policy.js';
import { computeDayStatus, type AttendancePolicy } from '../src/modules/attendance/day-status.service.js';
import { scheduledShiftIntervals, shiftSessions, selectFilo } from '../src/modules/attendance/shift-windows.js';
import { calculateGratuity, calculateServiceTenure } from '../src/modules/payroll-core/fnf/gratuity-calculator.js';
import { computeFnfSettlement } from '../src/modules/payroll-core/fnf/fnf-engine.js';
import { computeEmployeePayroll, DOCS10_STATUTORY_RATES, type ComponentMetadata } from '../src/modules/payroll-core/engine/compute-engine.js';
import { generateAmortizationSchedule } from '../src/modules/loans/amortization.js';
import { WalletService } from '../src/modules/travel/wallet.service.js';
import { OnboardingService } from '../src/modules/lifecycle/onboarding/onboarding.service.js';
import { validateLeaveApplication, computeLeaveSpan } from '../src/modules/leave/leave-validation.js';
import { unpaidDayEquivalents, type DayFact } from '../src/modules/payroll-core/runs/payable-days.js';
import { upsertMyDeclaration, addChallan } from '../src/modules/tds/tds.service.js';
import { act } from '../src/modules/workflows/workflow.service.js';

const DB_URL = process.env['DATABASE_URL'];
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'integration-test-secret-at-least-32-chars!';
const run = describe.skipIf(!DB_URL);

run('HRMS Deep & Extensive Bug Testing & Usecase Matrix', () => {
  let db: Kysely<Database>;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    db = createDatabase(DB_URL ?? '');
    app = createApp({ db, jwtSecret: JWT_SECRET, secureCookies: false });
  });

  afterAll(async () => {
    await db.destroy();
  });

  // =========================================================================
  // 1. STATUTORY FORMULAS & MONEY DISCIPLINE EDGE CASES (DOC 10 / DOC 14)
  // =========================================================================
  describe('Statutory Formulas & Rounding Rules', () => {
    it('PF rounding: strictly to nearest rupee (0.50 rounds up, 0.49 rounds down)', () => {
      // 12% on ₹15,000 ceiling = ₹1,800
      expect(roundPfContribution(paise(180000))).toBe(paise(180000));

      // 12% on ₹12,345 = 1481.40 rupees -> 148140 paise -> nearest rupee is 1481
      expect(roundPfContribution(paise(148140))).toBe(paise(148100));

      // 12% on ₹12,346 = 1481.52 rupees -> 148152 paise -> nearest rupee is 1482
      expect(roundPfContribution(paise(148152))).toBe(paise(148200));

      // Boundary: exact 50 paise rounds up
      expect(roundPfContribution(paise(10050))).toBe(paise(10100));
      // Boundary: 49 paise rounds down
      expect(roundPfContribution(paise(10049))).toBe(paise(10000));
    });

    it('ESIC rounding: strictly ROUND UP to the next rupee (0.01 paise rounds up to 100 paise)', () => {
      // 0.75% of ₹10,001 = 75.0075 rupees -> 7501 paise -> MUST round up to 76 rupees (7600 paise)
      expect(roundEsicContribution(paise(7501))).toBe(paise(7600));

      // Exact rupee amount does not round up further
      expect(roundEsicContribution(paise(7500))).toBe(paise(7500));

      // 1 paise above exact rupee rounds up to next rupee
      expect(roundEsicContribution(paise(1))).toBe(paise(100));
      expect(roundEsicContribution(paise(100))).toBe(paise(100));
      expect(roundEsicContribution(paise(101))).toBe(paise(200));
    });

    it('TDS Monthly rounding: rounds to nearest rupee', () => {
      expect(roundMonthlyTds(paise(154049))).toBe(paise(154000));
      expect(roundMonthlyTds(paise(154050))).toBe(paise(154100));
    });

    it('Safe paise math rejects floats, infinite and unsafe numbers', () => {
      expect(() => paise(10.5)).toThrow(TypeError);
      expect(() => paise(NaN)).toThrow(RangeError);
      expect(() => paise(Infinity)).toThrow(RangeError);
    });
  });

  // =========================================================================
  // 2. ATTENDANCE PROCESSOR & BIOMETRIC EDGE CASES (DOC 04 §1, ATT-01..18)
  // =========================================================================
  describe('Attendance Engine Edge Cases', () => {
    const policy: AttendancePolicy = {
      earlyMarginMs: 4 * 3600_000,
      lateMarginMs: 8 * 3600_000,
      sessionPresentFraction: 0.5,
      otMinMinutes: 30,
      otDecisionHours: 48,
    };

    const generalShift: Selectable<AttShiftsTable> = {
      id: 9999,
      code: 'GEN',
      name: 'General Shift',
      is_active: true,
      start_time: '09:00',
      end_time: '18:00',
      crosses_midnight: false,
      grace_in_minutes: 15,
      grace_out_minutes: 15,
      min_full_day_hours: '8.00',
      min_half_day_hours: '4.00',
      break_minutes: 60,
      break_paid: false,
      session_split: '13:00',
      session2_start: null,
      session2_end: null,
      allowance_component_code: null,
      late_slabs: '[]',
      early_exit_slabs: '[]',
      ot_start_offset_minutes: 30,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('Debouncing / multiple punches: extracts absolute first in and last out', () => {
      const punches = [
        { swipeTs: new Date('2026-06-15T09:00:10Z'), direction: 'in' },
        { swipeTs: new Date('2026-06-15T09:00:45Z'), direction: 'in' },
        { swipeTs: new Date('2026-06-15T09:01:30Z'), direction: 'in' },
        { swipeTs: new Date('2026-06-15T18:00:00Z'), direction: 'out' },
        { swipeTs: new Date('2026-06-15T18:00:50Z'), direction: 'out' },
      ];
      const filo = selectFilo(punches);
      expect(filo.firstIn?.toISOString()).toBe('2026-06-15T09:00:10.000Z');
      expect(filo.lastOut?.toISOString()).toBe('2026-06-15T18:00:50.000Z');
    });

    it('Incomplete punch (IN only): marked absent until regularized', () => {
      const date = '2026-06-15';
      const punches = [
        { swipeTs: new Date('2026-06-15T03:30:00Z'), direction: 'in' }, // 09:00 IST
      ];
      const filo = selectFilo(punches);
      expect(filo.firstIn).not.toBeNull();
      expect(filo.lastOut).toBeNull();

      const computed = computeDayStatus(
        { shift: generalShift, isWeekOff: false, isHoliday: false },
        date,
        punches,
        policy
      );
      expect(computed.status).toBe('A');
      expect(computed.workedMinutes).toBe(0);
    });

    it('Incomplete punch (OUT only): marked absent until regularized', () => {
      const date = '2026-06-15';
      const punches = [
        { swipeTs: new Date('2026-06-15T12:30:00Z'), direction: 'out' }, // 18:00 IST
      ];
      const filo = selectFilo(punches);
      expect(filo.firstIn).toBeNull();
      expect(filo.lastOut).toBeNull();

      const computed = computeDayStatus(
        { shift: generalShift, isWeekOff: false, isHoliday: false },
        date,
        punches,
        policy
      );
      expect(computed.status).toBe('A');
    });

    it('Night shift crossing midnight (22:00 to 06:00): intervals correctly span across days', () => {
      const nightShift: Selectable<AttShiftsTable> = {
        ...generalShift,
        code: 'NIGHT',
        start_time: '22:00',
        end_time: '06:00',
        crosses_midnight: true,
        session_split: '02:00',
      };
      const intervals = scheduledShiftIntervals(nightShift, '2026-06-15');
      expect(intervals.length).toBe(1);
      const firstInterval = intervals[0];
      expect(firstInterval).toBeDefined();
      if (!firstInterval) return;
      const durationHours = (firstInterval.end - firstInterval.start) / 3600_000;
      expect(durationHours).toBe(8);

      const sessions = shiftSessions(nightShift, '2026-06-15', intervals);
      expect(sessions).not.toBeNull();
      if (!sessions) return;
      expect(sessions.length).toBe(2);
      const s0 = sessions[0];
      const s1 = sessions[1];
      expect(s0).toBeDefined();
      expect(s1).toBeDefined();
      if (!s0 || !s1) return;
      expect((s0.end - s0.start) / 3600_000).toBe(4);
      expect((s1.end - s1.start) / 3600_000).toBe(4);
    });

    it('Overtime detection respects minimum noise threshold (30 minutes)', () => {
      const date = '2026-06-15';
      const punchUnder = [
        new Date('2026-06-15T03:30:00.000Z'), // 09:00 IST
        new Date('2026-06-15T12:55:00.000Z'), // 18:25 IST
      ];
      const computedUnder = computeDayStatus(
        { shift: generalShift, isWeekOff: false, isHoliday: false },
        date,
        punchUnder,
        policy
      );
      expect(computedUnder.otMinutes).toBe(0);

      const punchOver = [
        new Date('2026-06-15T03:30:00.000Z'), // 09:00 IST
        new Date('2026-06-15T13:45:00.000Z'), // 19:15 IST
      ];
      const computedOver = computeDayStatus(
        { shift: generalShift, isWeekOff: false, isHoliday: false },
        date,
        punchOver,
        policy
      );
      expect(computedOver.otMinutes).toBe(45);
    });

    it('Holiday and Week-Off work is 100% captured as overtime minutes', () => {
      const date = '2026-06-21'; // Sunday (Week-Off)
      const punches = [
        new Date('2026-06-21T04:30:00.000Z'), // 10:00 IST
        new Date('2026-06-21T10:30:00.000Z'), // 16:00 IST (6 hours = 360 mins)
      ];
      const computed = computeDayStatus(
        { shift: null, isWeekOff: true, isHoliday: false },
        date,
        punches,
        policy
      );
      expect(computed.status).toBe('WO');
      expect(computed.workedMinutes).toBe(360);
      expect(computed.otMinutes).toBe(360);
    });
  });

  // =========================================================================
  // 3. LEAVE VALIDATION & LEDGER INTEGRITY EDGE CASES (LV-01..11)
  // =========================================================================
  describe('Leave Management Edge Cases', () => {
    it('Sandwich rule exclude vs include accurately counts span days', async () => {
      const emp = await db.selectFrom('core.employees').select(['id', 'location_id']).limit(1).executeTakeFirst();
      if (!emp) return;

      const excludeResult = await computeLeaveSpan(
        db,
        emp,
        { sandwich_rule: 'exclude' },
        '2026-06-12',
        '2026-06-16',
        false,
        false
      );
      const sundayExcluded = excludeResult.span.find(d => d.iso === '2026-06-14');
      expect(sundayExcluded?.counted).toBe(false);

      const includeResult = await computeLeaveSpan(
        db,
        emp,
        { sandwich_rule: 'include' },
        '2026-06-12',
        '2026-06-16',
        false,
        false
      );
      const sundayIncluded = includeResult.span.find(d => d.iso === '2026-06-14');
      expect(sundayIncluded?.counted).toBe(true);
    });

    it('Rejects invalid date bounds where fromDate > toDate', async () => {
      await expect(
        validateLeaveApplication(db, {
          employeeId: 1,
          requestedByUserId: 1,
          leaveTypeCode: 'CL',
          fromDate: '2026-06-20',
          toDate: '2026-06-15',
        })
      ).rejects.toThrow(/fromDate must be on or before toDate/);
    });

    it('Rejects two halves on a single calendar day', async () => {
      await expect(
        validateLeaveApplication(db, {
          employeeId: 1,
          requestedByUserId: 1,
          leaveTypeCode: 'CL',
          fromDate: '2026-06-15',
          toDate: '2026-06-15',
          fromHalf: true,
          toHalf: true,
        })
      ).rejects.toThrow(/A single day cannot be two halves/);
    });
  });

  // =========================================================================
  // 4. PAYROLL ENGINE & RECOVERY CARRY-FORWARD EDGE CASES (PAY-01..26)
  // =========================================================================
  describe('Payroll Engine & Negative Net Recovery Edge Cases', () => {
    const catalog = new Map<string, ComponentMetadata>([
      ['BASIC', { code: 'BASIC', name: 'Basic', kind: 'earning', partOfGross: true, partOfPfWages: true, prorateOnLop: true, displayOrder: 1 }],
      ['HRA', { code: 'HRA', name: 'HRA', kind: 'earning', partOfGross: true, partOfPfWages: false, prorateOnLop: true, displayOrder: 2 }],
      ['SPL_ALW', { code: 'SPL_ALW', name: 'Special Allowance', kind: 'earning', partOfGross: true, partOfPfWages: false, prorateOnLop: true, displayOrder: 3 }],
      ['LOAN_EMI', { code: 'LOAN_EMI', name: 'Loan EMI', kind: 'deduction', partOfGross: false, partOfPfWages: false, prorateOnLop: false, displayOrder: 10 }],
    ]);

    it('Full Month LOP (0 payable days): Earnings are 0, statutory deductions are 0, no negative net without deductions', () => {
      const computed = computeEmployeePayroll(
        {
          employeeId: 1,
          salaryComponentsPaise: {
            BASIC: paise(2000000),
            HRA: paise(1000000),
          },
          daysInMonth: 30,
          payableDays: 0,
          otMinutes: 0,
          variableInputs: [],
          arrears: [],
          otherDeductions: [],
          rates: DOCS10_STATUTORY_RATES,
          pf: { applicable: true, wageBasis: 'CEILING_15000', internationalWorker: false, epsEligible: true },
          esicCovered: false,
          ptSlabs: [],
          stateCode: 'WB',
          monthlyTdsPaise: paise(0),
          lwfPaise: paise(0),
          apprentice: false,
          negativeNetPolicy: 'carry_forward',
        },
        catalog
      );

      expect(computed.grossPaise).toBe(paise(0));
      expect(computed.totalDeductionsPaise).toBe(paise(0));
      expect(computed.netPayPaise).toBe(paise(0));
      expect(computed.isNegativeNet).toBe(false);
    });

    it('High Deductions Exceeding Gross: Negative net pay is handled with carry_forward policy', () => {
      // Gross is ₹10,000, but Loan EMI is ₹15,000 -> Deductions exceed gross by ₹5,000
      const computed = computeEmployeePayroll(
        {
          employeeId: 1,
          salaryComponentsPaise: {
            BASIC: paise(1000000), // ₹10,000
          },
          daysInMonth: 30,
          payableDays: 30,
          otMinutes: 0,
          variableInputs: [],
          arrears: [],
          otherDeductions: [
            {
              componentCode: 'LOAN_EMI',
              amountPaise: paise(1500000), // ₹15,000
              note: 'Housing Loan EMI',
              source: { kind: 'loan', loanId: 101 },
            },
          ],
          rates: DOCS10_STATUTORY_RATES,
          pf: { applicable: false, wageBasis: 'ACTUAL', internationalWorker: false, epsEligible: false },
          esicCovered: false,
          ptSlabs: [],
          stateCode: 'WB',
          monthlyTdsPaise: paise(0),
          lwfPaise: paise(0),
          apprentice: false,
          negativeNetPolicy: 'carry_forward',
        },
        catalog
      );

      // Under carry_forward policy: net pay cannot go below 0, excess deduction is carried forward
      expect(computed.grossPaise).toBe(paise(1000000));
      expect(computed.netPayPaise).toBe(paise(0));
      expect(computed.carryForward.length).toBe(1);
      expect(computed.carryForward[0]?.amountPaise).toBe(paise(500000));
    });

    it('PF Capping: Basic > ₹15,000 under CEILING_15000 mode is strictly capped at ₹1,800', () => {
      const computed = computeEmployeePayroll(
        {
          employeeId: 1,
          salaryComponentsPaise: {
            BASIC: paise(5000000), // ₹50,000 Basic
          },
          daysInMonth: 30,
          payableDays: 30,
          otMinutes: 0,
          variableInputs: [],
          arrears: [],
          otherDeductions: [],
          rates: DOCS10_STATUTORY_RATES,
          pf: { applicable: true, wageBasis: 'CEILING_15000', internationalWorker: false, epsEligible: true },
          esicCovered: false,
          ptSlabs: [],
          stateCode: 'WB',
          monthlyTdsPaise: paise(0),
          lwfPaise: paise(0),
          apprentice: false,
          negativeNetPolicy: 'carry_forward',
        },
        catalog
      );

      // 12% on 15,000 = 1,800 (180,000 paise)
      const pfLine = computed.lines.find(l => l.componentCode === 'PF_EE');
      expect(pfLine?.amountPaise).toBe(paise(180000));
    });

    it('PF Uncapped: Basic > ₹15,000 under ACTUAL mode calculates 12% on full basic', () => {
      const computed = computeEmployeePayroll(
        {
          employeeId: 1,
          salaryComponentsPaise: {
            BASIC: paise(5000000), // ₹50,000 Basic
          },
          daysInMonth: 30,
          payableDays: 30,
          otMinutes: 0,
          variableInputs: [],
          arrears: [],
          otherDeductions: [],
          rates: DOCS10_STATUTORY_RATES,
          pf: { applicable: true, wageBasis: 'ACTUAL', internationalWorker: false, epsEligible: true },
          esicCovered: false,
          ptSlabs: [],
          stateCode: 'WB',
          monthlyTdsPaise: paise(0),
          lwfPaise: paise(0),
          apprentice: false,
          negativeNetPolicy: 'carry_forward',
        },
        catalog
      );

      // 12% on 50,000 = 6,000 (600,000 paise)
      const pfLine = computed.lines.find(l => l.componentCode === 'PF_EE');
      expect(pfLine?.amountPaise).toBe(paise(600000));
    });
  });

  // =========================================================================
  // 5. FINAL SETTLEMENT (F&F) & GRATUITY EDGE CASES (PAY-15, LC-07)
  // =========================================================================
  describe('Full & Final Settlement (F&F) Engine Edge Cases', () => {
    it('Tenure calculation across leap years and month ends produces exact non-negative days', () => {
      const tenure = calculateServiceTenure('2020-02-29', '2025-02-28');
      expect(tenure.years).toBe(5);
      expect(tenure.months).toBe(0);
      expect(tenure.days).toBeGreaterThanOrEqual(0);
    });

    it('Gratuity eligibility: 5-year threshold under STRICT_5Y vs LIBERAL_4Y240D', () => {
      const tenure4y241d = {
        basicMonthlyPaise: 3000000,
        doj: '2021-01-01',
        lastWorkingDay: '2025-09-01',
      };
      // Liberal mode: eligible
      const liberal = calculateGratuity({ ...tenure4y241d, eligibilityMode: 'LIBERAL_4Y240D' });
      expect(liberal.isEligible).toBe(true);

      // Strict 5Y mode: NOT eligible
      const strict = calculateGratuity({ ...tenure4y241d, eligibilityMode: 'STRICT_5Y' });
      expect(strict.isEligible).toBe(false);
      expect(strict.gratuityPaise).toBe(0);
    });

    it('Gratuity waiver for death exit: eligible regardless of tenure (Payment of Gratuity Act §4)', () => {
      const shortTenure = {
        basicMonthlyPaise: 3000000,
        doj: '2025-01-01',
        lastWorkingDay: '2025-08-01', // only 7 months
        waiveMinimumService: true,
      };
      const res = calculateGratuity(shortTenure);
      expect(res.isEligible).toBe(true);
      expect(res.gratuityPaise).toBeGreaterThan(0);
    });

    it('F&F Notice period shortfall: (Basic / 30) × shortfall days', () => {
      // Basic ₹30,000, shortfall 15 days -> 30,000 / 30 * 15 = ₹15,000
      const fnf = computeFnfSettlement({
        employeeId: 1,
        separationId: 1,
        doj: '2020-01-01',
        approvedLwd: '2026-06-15',
        daysPayable: 15,
        daysInMonth: 30,
        basicMonthlyPaise: 3000000, // ₹30,000
        grossMonthlyPaise: 5000000, // ₹50,000
        elBalanceDays: 0,
        shortfallDays: 15,
      });

      expect(fnf.deductions.noticeRecoveryPaise).toBe(1500000); // ₹15,000
    });

    it('F&F Leave Encashment: (Basic + DA) / 30 × EL balance', () => {
      // Basic ₹20,000, DA ₹5,000, EL balance = 12 days -> 25,000 / 30 * 12 = ₹10,000 (1,000,000 paise)
      const fnf = computeFnfSettlement({
        employeeId: 1,
        separationId: 1,
        doj: '2020-01-01',
        approvedLwd: '2026-06-30',
        daysPayable: 30,
        daysInMonth: 30,
        basicMonthlyPaise: 2000000,
        daMonthlyPaise: 500000,
        grossMonthlyPaise: 4000000,
        elBalanceDays: 12,
        shortfallDays: 0,
      });

      expect(fnf.earnings.leaveEncashmentPaise).toBe(1000000);
    });
  });

  // =========================================================================
  // 6. LOAN AMORTIZATION & RECOVERY EDGE CASES (LN-01..04)
  // =========================================================================
  describe('Loan Amortization Engine Edge Cases', () => {
    it('Zero-interest advance produces exact equal monthly instalments without interest', () => {
      const schedule = generateAmortizationSchedule({
        loanType: 'salary_advance',
        principal: paise(1200000),
        annualInterestRate: 0,
        tenureMonths: 6,
      });

      expect(schedule.monthlyEmi).toBe(paise(200000));
      expect(schedule.totalInterest).toBe(paise(0));
      expect(schedule.schedule.length).toBe(6);
      const totalPrincipal = schedule.schedule.reduce((s, r) => s + r.principalPart, 0);
      expect(totalPrincipal).toBe(1200000);
    });

    it('Diminishing balance loan calculates positive interest and declining balance', () => {
      const schedule = generateAmortizationSchedule({
        loanType: 'loan_diminishing',
        principal: paise(10000000), // ₹1,00,000
        annualInterestRate: 12, // 12% p.a.
        tenureMonths: 12,
      });

      expect(schedule.totalInterest).toBeGreaterThan(0);
      expect(schedule.schedule.length).toBe(12);
      expect(schedule.schedule[11]?.closingOutstanding).toBe(paise(0));
    });
  });

  // =========================================================================
  // 7. TRAVEL WALLET & ADVANCE RECONCILIATION EDGE CASES (M13 / TE-01..12)
  // =========================================================================
  describe('Travel Wallet & Ledger Consistency Edge Cases', () => {
    it('Maintains exact mathematical ledger integrity across credits and debits', async () => {
      const walletService = new WalletService(db);
      const emp = await db.selectFrom('core.employees').select('id').limit(1).executeTakeFirst();
      if (!emp) return;

      const wallet = await walletService.getOrCreateWallet(emp.id);
      const initialBalance = wallet.balance_paise;

      // Credit advance of ₹5,000
      const credited = await walletService.credit({
        employeeId: emp.id,
        amountPaise: 500000,
        source: 'ADVANCE',
        transactionReference: `TEST-CREDIT-${Date.now()}`,
        notes: 'Integration test advance credit',
      });
      expect(credited.wallet.balance_paise).toBe(initialBalance + 500000);

      // Debit claim settlement of ₹3,000
      const debited = await walletService.debit({
        employeeId: emp.id,
        amountPaise: 300000,
        source: 'CLAIM_SETTLEMENT',
        transactionReference: `TEST-DEBIT-${Date.now()}`,
        notes: 'Integration test claim settlement debit',
      });
      expect(debited.wallet.balance_paise).toBe(initialBalance + 200000);

      // Verify mathematical integrity of the immutable ledger
      const verified = await walletService.verifyLedgerIntegrity(emp.id);
      expect(verified.isValid).toBe(true);
      expect(verified.computedBalancePaise).toBe(debited.wallet.balance_paise);
    });

    it('Debiting more than the current wallet balance throws Insufficient balance error', async () => {
      const walletService = new WalletService(db);
      const emp = await db.selectFrom('core.employees').select('id').limit(1).executeTakeFirst();
      if (!emp) return;

      const wallet = await walletService.getOrCreateWallet(emp.id);
      const current = wallet.balance_paise;

      await expect(
        walletService.debit({
          employeeId: emp.id,
          amountPaise: current + 1000000, // exceed by ₹10,000
          source: 'CLAIM_SETTLEMENT',
          transactionReference: `TEST-OVERDRAFT-${Date.now()}`,
          notes: 'Illegal overdraft attempt',
        })
      ).rejects.toThrow(/Insufficient wallet balance/);
    });
  });

  // =========================================================================
  // 8. ONBOARDING & PREJOIN IDENTITY DUPLICATION SAFETY (LC-01, CORE-04)
  // =========================================================================
  describe('Onboarding & Identity Deduplication Safety', () => {
    it('Detects duplicate employee by PAN, mobile or personal email', async () => {
      const existing = await db
        .selectFrom('core.employees')
        .select(['personal_email', 'mobile', 'pan'])
        .where('pan', 'is not', null)
        .where('personal_email', 'is not', null)
        .limit(1)
        .executeTakeFirst();

      if (!existing?.pan || !existing.personal_email) return;

      // Duplicate email check
      const dupEmail = await OnboardingService.checkDuplicate(
        db,
        existing.personal_email,
        '9999999999',
        'ABCDE9999Z'
      );
      expect(dupEmail.hasDuplicate).toBe(true);
      expect(dupEmail.duplicateField).toBe('email');

      // Duplicate mobile check
      const dupMobile = await OnboardingService.checkDuplicate(
        db,
        'unique-email-test-999@hrms.test',
        existing.mobile ?? '9876543210',
        'ABCDE9999Z'
      );
      expect(dupMobile.hasDuplicate).toBe(true);
      expect(dupMobile.duplicateField).toBe('mobile');

      // Duplicate PAN check
      const dupPan = await OnboardingService.checkDuplicate(
        db,
        'unique-email-test-999@hrms.test',
        '9999999999',
        existing.pan
      );
      expect(dupPan.hasDuplicate).toBe(true);
      expect(dupPan.duplicateField).toBe('pan');
    });

    it('Rejects candidate conversion if actual DOJ is in the future', async () => {
      await expect(
        OnboardingService.convertCandidate(
          db,
          {
            candidateId: 1,
            joiningConfirmed: true,
            companyId: 1,
            designationId: 1,
            departmentId: 1,
            locationId: 1,
            orgUnitId: 1,
            doj: '2099-01-01', // Future date
          },
          { userId: 1, scope: { all: true, own: false, subtree: false, orgUnitIds: [], actorEmployeeId: null } }
        )
      ).rejects.toThrow(/Actual joining date cannot be in the future/);
    });
  });

  // =========================================================================
  // 9. DATABASE IMMUTABILITY & AUDIT LOG TRIGGERS (CORE-06)
  // =========================================================================
  describe('Database Append-Only Immutability & Audit Integrity', () => {
    it('core.audit_log is append-only: UPDATE and DELETE are blocked by triggers', async () => {
      const anyAudit = await db.selectFrom('core.audit_log').select('id').limit(1).executeTakeFirst();
      if (!anyAudit) return;

      // Attempting to update audit_log row must fail
      await expect(
        db.updateTable('core.audit_log').set({ new_value: 'tampered' }).where('id', '=', anyAudit.id).execute()
      ).rejects.toThrow();

      // Attempting to delete audit_log row must fail
      await expect(
        db.deleteFrom('core.audit_log').where('id', '=', anyAudit.id).execute()
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 10. RBAC ACCESS CONTROL & SEGREGATION OF DUTIES (DOC 08)
  // =========================================================================
  describe('RBAC Access Control & Segregation of Duties', () => {
    it('Prevents an employee from self-approving their own workflow request', async () => {
      const client = await httpRequest(app);

      // Attempt to act on a request where actor is the subject
      const req = await db
        .selectFrom('wf.requests')
        .select(['id', 'subject_employee_id'])
        .where('status', '=', 'pending')
        .limit(1)
        .executeTakeFirst();

      if (req) {
        // Find user for this subject employee
        const subjectUser = await db
          .selectFrom('core.users')
          .select(['id', 'email'])
          .where('employee_id', '=', req.subject_employee_id)
          .executeTakeFirst();

        if (subjectUser) {
          const selfToken = await signAccessToken(
            subjectUser.id,
            subjectUser.email,
            JWT_SECRET
          );

          const res = await client
            .post(`/api/workflows/requests/${req.id}/act`)
            .set('Authorization', `Bearer ${selfToken}`)
            .send({ action: 'approve' });

          expect(res.status).toBe(403);
          const body = res.body as { message?: string; error?: string };
          expect(body.message ?? body.error).toMatch(/own request|Not the current approver/i);
        }
      }
    });

    it('Non-admin users are blocked from admin RBAC management endpoints (403), and revoked sessions are rejected (401)', async () => {
      const client = await httpRequest(app);
      const regularUser = await db
        .selectFrom('core.users as u')
        .innerJoin('core.user_roles as ur', 'ur.user_id', 'u.id')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .select(['u.id', 'u.email'])
        .where('r.code', '=', 'employee')
        .where('u.is_active', '=', true)
        .limit(1)
        .executeTakeFirst();

      if (regularUser) {
        const { randomUUID } = await import('node:crypto');
        const sid = randomUUID();
        await db.insertInto('sec.sessions').values({
          sid,
          user_id: regularUser.id,
          created_at: new Date(),
          expires_at: new Date(Date.now() + 3600_000),
        }).execute();

        const employeeToken = await signAccessToken(
          regularUser.id,
          regularUser.email,
          JWT_SECRET,
          sid
        );

        // 1. With active session, user has NO rbac permission -> 403 Forbidden
        const res = await client
          .post('/api/rbac/roles')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ code: 'hacker_role', name: 'Hacker Role' });

        expect(res.status).toBe(403);

        // 2. Revoke the session -> immediate 401 Unauthorized
        await db.updateTable('sec.sessions').set({ revoked_at: new Date(), revoke_reason: 'test_logout' }).where('sid', '=', sid).execute();
        const resAfterRevoke = await client
          .post('/api/rbac/roles')
          .set('Authorization', `Bearer ${employeeToken}`)
          .send({ code: 'hacker_role', name: 'Hacker Role' });

        expect(resAfterRevoke.status).toBe(401);
      }
    });
  });

  // =========================================================================
  // 11. CLAIMS & INDEPENDENT REIMBURSEMENT PAYMENTS (CLM-01..07)
  // =========================================================================
  describe('Claims & Independent Reimbursement Invariants', () => {
    it('Prepared reimbursement batch items are immutable at DB trigger level', async () => {
      // Create a test draft batch, transition to prepared, and verify DB trigger blocks changes
      const comp = await db.selectFrom('core.companies').select('id').limit(1).executeTakeFirst();
      const user = await db.selectFrom('core.users').select('id').limit(1).executeTakeFirst();
      const emp = await db.selectFrom('core.employees').select('id').limit(1).executeTakeFirst();
      if (!comp || !user || !emp) return;

      // Create a doc for the bank document requirement
      const doc = await db.insertInto('core.documents').values({
        kind: 'bank_file',
        original_name: 'test-batch.csv',
        path: 'test/path/batch.csv',
        mime: 'text/csv',
        size_bytes: 100,
        uploaded_by: user.id,
        status: 'active',
      }).returning('id').executeTakeFirstOrThrow();

      const batch = await db.insertInto('pay.reimbursement_batches').values({
        company_id: comp.id,
        status: 'draft',
        total_amount: '5000.00',
        created_by: user.id,
      }).returning('id').executeTakeFirstOrThrow();

      // Create a dummy approved claim
      const claimType = await db.selectFrom('pay.claim_types').select('id').limit(1).executeTakeFirst();
      if (!claimType) return;

      const claim = await db.insertInto('pay.claims').values({
        employee_id: emp.id,
        claim_type_id: claimType.id,
        funding_kind: 'entitlement',
        period_from: new Date('2026-06-01'),
        period_to: new Date('2026-06-30'),
        claimed_amount: '5000.00',
        approved_amount: '5000.00',
        status: 'approved',
      }).returning('id').executeTakeFirstOrThrow();

      // Add item to draft batch
      const item = await db.insertInto('pay.reimbursement_batch_items').values({
        batch_id: batch.id,
        claim_id: claim.id,
        employee_id: emp.id,
        amount: '5000.00',
      }).returning('id').executeTakeFirstOrThrow();

      // Transition batch to prepared
      await db.updateTable('pay.reimbursement_batches').set({
        status: 'prepared',
        bank_document_id: doc.id,
      }).where('id', '=', batch.id).execute();

      // Attempting to delete item from prepared batch MUST trigger exception
      await expect(
        db.deleteFrom('pay.reimbursement_batch_items').where('id', '=', item.id).execute()
      ).rejects.toThrow(/Prepared reimbursement items are immutable/i);

      // Attempting to mark paid with payment reference < 3 chars MUST fail trigger/check
      await expect(
        db.updateTable('pay.reimbursement_batches').set({
          status: 'paid',
          paid_by: user.id,
          paid_at: new Date(),
          payment_reference: 'AB', // Less than 3 chars
        }).where('id', '=', batch.id).execute()
      ).rejects.toThrow();

      // Trigger invariant: A 'prepared' batch CANNOT be cancelled (can only be paid)
      await expect(
        db.updateTable('pay.reimbursement_batches').set({ status: 'cancelled' }).where('id', '=', batch.id).execute()
      ).rejects.toThrow(/Invalid reimbursement batch transition/i);

      // Successfully mark paid with valid reference
      await db.updateTable('pay.reimbursement_batches').set({
        status: 'paid',
        paid_by: user.id,
        paid_at: new Date(),
        payment_reference: 'UTR-TEST-123456',
      }).where('id', '=', batch.id).execute();

      // Trigger invariant: Once paid, batch is immutable
      await expect(
        db.updateTable('pay.reimbursement_batches').set({ payment_reference: 'TAMPERED' }).where('id', '=', batch.id).execute()
      ).rejects.toThrow(/Closed reimbursement batch is immutable/i);
    });
  });

  // =========================================================================
  // 12. SHIFT SWAP & REST PERIOD SAFETY (SHF-01..03, ATT-04)
  // =========================================================================
  describe('Shift Scheduling & Minimum Rest Period Safety', () => {
    it('Detects mandatory rest violation (< 11 hours) between adjacent shifts', async () => {
      const { restHoursBetween } = await import('../src/modules/attendance/shift-windows.js');
      const shift1 = {
        code: 'EVENING',
        startTime: '14:00',
        endTime: '22:00',
        crossesMidnight: false,
        breakMinutes: 30,
        breakPaid: false,
        session2Start: null,
        session2End: null,
      };

      // Next morning shift starting at 06:00 (only 8 hours rest between 22:00 and 06:00)
      const shift2 = {
        code: 'MORNING',
        startTime: '06:00',
        endTime: '14:00',
        crossesMidnight: false,
        breakMinutes: 30,
        breakPaid: false,
        session2Start: null,
        session2End: null,
      };

      const rest = restHoursBetween('2026-06-15', shift1, '2026-06-16', shift2);
      expect(rest).toBe(8); // Only 8 hours rest
      expect(rest < 11).toBe(true); // Violates statutory 11-hour rest norm
    });
  });

  // =========================================================================
  // 13. TDS INVESTMENT DECLARATIONS & REGIME SWITCHING (PAY-13)
  // =========================================================================
  describe('TDS Tax Regime & Investment Declaration Rules', () => {
    it('Rejects undeclared tax sections not in statutory catalog', async () => {
      const client = await httpRequest(app);
      const regularUser = await db
        .selectFrom('core.users as u')
        .innerJoin('core.user_roles as ur', 'ur.user_id', 'u.id')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .select(['u.id', 'u.email'])
        .where('r.code', '=', 'employee')
        .where('u.is_active', '=', true)
        .limit(1)
        .executeTakeFirst();

      if (!regularUser) return;

      const { randomUUID } = await import('node:crypto');
      const sid = randomUUID();
      await db.insertInto('sec.sessions').values({
        sid,
        user_id: regularUser.id,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 3600_000),
      }).execute();

      const employeeToken = await signAccessToken(
        regularUser.id,
        regularUser.email,
        JWT_SECRET,
        sid
      );

      // Declaring fake section '80FAKE'
      const res = await client
        .post('/api/tds/declare')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          fy: '2026-27',
          section: '80FAKE',
          declaredAmountRupees: 50000,
        });

      // Must be rejected
      expect(res.status).toBeGreaterThanOrEqual(400);

      // Cleanup session
      await db.deleteFrom('sec.sessions').where('sid', '=', sid).execute();
    });
  });

  // =========================================================================
  // 11. ADVANCED ATTENDANCE SANDWICH & MULTI-LOCATION CALENDAR RULES
  // =========================================================================
  describe('Advanced Attendance Sandwich & Divisor Mechanics', () => {
    const makeFact = (iso: string, status: DayStatus, overrides?: Partial<DayFact>): DayFact => ({
      iso,
      status,
      leavePaid: null,
      weekoffPaid: status === 'WO' ? true : null,
      otherHalfWorked: false,
      ...overrides,
    });

    it('Multi-day weekend + holiday sandwich turns entire block into LOP under CALENDAR divisor', () => {
      // Sequence: Friday Absent, Saturday WO, Sunday WO, Monday Holiday, Tuesday Absent
      const facts: DayFact[] = [
        makeFact('2026-06-12', 'A'),
        makeFact('2026-06-13', 'WO'),
        makeFact('2026-06-14', 'WO'),
        makeFact('2026-06-15', 'H'),
        makeFact('2026-06-16', 'A'),
      ];

      // With sandwich rule ON and CALENDAR divisor:
      const lop = unpaidDayEquivalents(facts, 'CALENDAR', true);
      // All 5 days are unpaid (2 absent + 3 sandwiched days)
      expect(lop).toBe(5);

      // With sandwich rule OFF:
      const lopWithoutSandwich = unpaidDayEquivalents(facts, 'CALENDAR', false);
      // Only the 2 absent days are unpaid
      expect(lopWithoutSandwich).toBe(2);
    });

    it('Sandwich rule does NOT penalize off-days if Tuesday is Present', () => {
      const facts: DayFact[] = [
        makeFact('2026-06-12', 'A'),
        makeFact('2026-06-13', 'WO'),
        makeFact('2026-06-14', 'WO'),
        makeFact('2026-06-15', 'H'),
        makeFact('2026-06-16', 'P'),
      ];

      const lop = unpaidDayEquivalents(facts, 'CALENDAR', true);
      // Only Friday is LOP (1 day)
      expect(lop).toBe(1);
    });

    it('Sandwich rule does NOT trigger if Friday was approved Half-Day Leave', () => {
      const facts: DayFact[] = [
        makeFact('2026-06-12', 'HD', { leavePaid: true, otherHalfWorked: false }), // unpaidWeight = 0.5
        makeFact('2026-06-13', 'WO'),
        makeFact('2026-06-14', 'WO'),
        makeFact('2026-06-15', 'A'), // Monday: Absent
      ];

      const lop = unpaidDayEquivalents(facts, 'CALENDAR', true);
      // Friday 0.5 + Monday 1.0 = 1.5 LOP, week-offs NOT sandwiched because Friday was not full unpaid
      expect(lop).toBe(1.5);
    });

    it('Factory FIXED_26 divisor never sandwiches off-days into LOP', () => {
      const facts: DayFact[] = [
        makeFact('2026-06-12', 'A'),
        makeFact('2026-06-13', 'WO'),
        makeFact('2026-06-14', 'WO'),
        makeFact('2026-06-15', 'A'),
      ];

      const lop = unpaidDayEquivalents(facts, 'FIXED_26', true);
      // In FIXED_26, only the working days (2 absent days) count as LOP
      expect(lop).toBe(2);
    });
  });

  // =========================================================================
  // 12. BIOMETRIC INGESTION EDGE CASES (KENT FILO & DIRECTIONLESS TURNSTILES)
  // =========================================================================
  describe('Biometric Ingestion Edge Cases & FILO Punch Sorting', () => {
    it('selectFilo sorts out-of-order punches chronologically', () => {
      const p1 = new Date('2026-06-15T12:30:00Z'); // 18:00 IST (OUT)
      const p2 = new Date('2026-06-15T03:30:00Z'); // 09:00 IST (IN)

      const result = selectFilo([
        { swipeTs: p1, direction: 'out' },
        { swipeTs: p2, direction: 'in' },
      ]);

      expect(result.firstIn).toEqual(p2);
      expect(result.lastOut).toEqual(p1);
    });

    it('Directionless punches on bidirectional turnstile pick earliest as firstIn and latest as lastOut', () => {
      const p1 = new Date('2026-06-15T03:30:00Z'); // 09:00 IST
      const p2 = new Date('2026-06-15T07:30:00Z'); // 13:00 IST
      const p3 = new Date('2026-06-15T08:30:00Z'); // 14:00 IST
      const p4 = new Date('2026-06-15T13:00:00Z'); // 18:30 IST

      const result = selectFilo([
        { swipeTs: p3, direction: null },
        { swipeTs: p1, direction: null },
        { swipeTs: p4, direction: null },
        { swipeTs: p2, direction: null },
      ]);

      expect(result.firstIn).toEqual(p1);
      expect(result.lastOut).toEqual(p4);
    });

    it('Single swipe results in firstIn but lastOut is null', () => {
      const p1 = new Date('2026-06-15T03:30:00Z');

      const result = selectFilo([{ swipeTs: p1, direction: null }]);
      expect(result.firstIn).toEqual(p1);
      expect(result.lastOut).toBeNull();
    });

    it('Known OUT punch alone can NEVER become an IN fallback', () => {
      const p1 = new Date('2026-06-15T12:00:00Z'); // OUT punch only

      const result = selectFilo([{ swipeTs: p1, direction: 'out' }]);
      expect(result.firstIn).toBeNull();
      expect(result.lastOut).toBeNull();
    });
  });

  // =========================================================================
  // 13. STATUTORY GRATUITY BOUNDARY CONDITIONS & SECTION 4 EXCEPTIONS
  // =========================================================================
  describe('Statutory Gratuity Boundary Conditions & Section 4 Exceptions', () => {
    it('Gratuity eligibility: 4 years 250 days meets LIBERAL_4Y240D but fails STRICT_5Y', () => {
      // 2021-01-01 to 2025-09-10 = 4 years 8 months 10 days (>1700 days)
      const liberal = calculateGratuity({
        basicMonthlyPaise: paise(5000000),
        doj: '2021-01-01',
        lastWorkingDay: '2025-09-10',
        eligibilityMode: 'LIBERAL_4Y240D',
      });
      expect(liberal.isEligible).toBe(true);
      expect(liberal.gratuityPaise).toBeGreaterThan(0);

      const strict = calculateGratuity({
        basicMonthlyPaise: paise(5000000),
        doj: '2021-01-01',
        lastWorkingDay: '2025-09-10',
        eligibilityMode: 'STRICT_5Y',
      });
      expect(strict.isEligible).toBe(false);
      expect(strict.gratuityPaise).toBe(0);
    });

    it('Section 4(2) Fraction Rule: >=6 months rounds up to next full year, <6 months rounds down', () => {
      // 5 years 6 months: 2020-01-01 to 2025-07-02 -> rounds up to 6 years
      const roundUp = calculateGratuity({
        basicMonthlyPaise: paise(2600000), // ₹26,000 Basic
        doj: '2020-01-01',
        lastWorkingDay: '2025-07-02',
      });
      expect(roundUp.completedYearsRounded).toBe(6);
      // (15 * 26000 * 6) / 26 = 90,000 rupees = 9,000,000 paise
      expect(roundUp.gratuityPaise).toBe(paise(9000000));

      // 5 years 4 months: 2020-01-01 to 2025-05-02 -> rounds down to 5 years
      const roundDown = calculateGratuity({
        basicMonthlyPaise: paise(2600000), // ₹26,000 Basic
        doj: '2020-01-01',
        lastWorkingDay: '2025-05-02',
      });
      expect(roundDown.completedYearsRounded).toBe(5);
      // (15 * 26000 * 5) / 26 = 75,000 rupees = 7,500,000 paise
      expect(roundDown.gratuityPaise).toBe(paise(7500000));
    });

    it('Death on duty waives the 5-year minimum service requirement entirely', () => {
      // Service of only 1 year 2 months: 2024-01-01 to 2025-03-01
      const deathGratuity = calculateGratuity({
        basicMonthlyPaise: paise(2600000),
        doj: '2024-01-01',
        lastWorkingDay: '2025-03-01',
        waiveMinimumService: true,
      });
      expect(deathGratuity.isEligible).toBe(true);
      expect(deathGratuity.completedYearsRounded).toBe(1);
      // (15 * 26000 * 1) / 26 = 15,000 rupees = 1,500,000 paise
      expect(deathGratuity.gratuityPaise).toBe(paise(1500000));
    });

    it('Statutory ceiling cap of ₹20,00,000 strictly enforced on high earners with long tenure', () => {
      // Basic ₹3,00,000 with 30 years service: uncapped is (15 * 300,000 * 30) / 26 = ₹51,92,308
      const highEarner = calculateGratuity({
        basicMonthlyPaise: paise(30000000), // ₹3,00,000 Basic
        doj: '1995-01-01',
        lastWorkingDay: '2025-01-01',
      });
      expect(highEarner.isEligible).toBe(true);
      expect(highEarner.cappedAtCeiling).toBe(true);
      // Capped at ₹20,00,000 = 200,000,000 paise
      expect(highEarner.gratuityPaise).toBe(paise(200000000));
      expect(highEarner.gratuityRupees).toBe(2000000);
    });
  });

  // =========================================================================
  // 14. TDS INVESTMENT DECLARATION & CHALLAN RECONCILIATION RULES
  // =========================================================================
  describe('TDS Investment Declaration & Challan Reconciliation Rules', () => {
    it('TDS Declaration: Rejects amount exceeding 4x statutory section cap', async () => {
      const emp = await db.selectFrom('core.employees').select('id').limit(1).executeTakeFirst();
      if (!emp) return;

      // 80C cap is ₹1,50,000. Declaring ₹7,00,000 (> 4x cap = 6,00,000) must be rejected
      await expect(
        upsertMyDeclaration(db, {
          employeeId: emp.id,
          fy: '2026-27',
          section: '80C',
          amountRupees: 700000,
          actorUserId: 1,
        })
      ).rejects.toThrow(/far above the ₹1,50,000 limit/);
    });

    it('TDS Challan validation: strictly validates 7-digit BSR and 5-digit Challan serial', async () => {
      const comp = await db.selectFrom('core.companies').select('id').limit(1).executeTakeFirst();
      if (!comp) return;

      // Invalid BSR (6 digits instead of 7)
      await expect(
        addChallan(db, {
          companyId: comp.id,
          month: '2026-06-01',
          amountRupees: 50000,
          challanNo: '12345',
          bsrCode: '123456', // Invalid
          paidOn: '2026-06-15',
          actorUserId: 1,
        })
      ).rejects.toThrow(/BSR code must be 7 digits/);

      // Invalid Challan serial (4 digits instead of 5)
      await expect(
        addChallan(db, {
          companyId: comp.id,
          month: '2026-06-01',
          amountRupees: 50000,
          challanNo: '1234', // Invalid
          bsrCode: '1234567',
          paidOn: '2026-06-15',
          actorUserId: 1,
        })
      ).rejects.toThrow(/Challan serial number must be 5 digits/);
    });
  });

  // =========================================================================
  // 15. WORKFLOW CONCURRENCY & SEGREGATION OF DUTIES (CORE-11 / B-03)
  // =========================================================================
  describe('Workflow Concurrency & Segregation of Duties', () => {
    it('Workflow act: Rejects decision without reason when rejecting a request', async () => {
      const req = await db.selectFrom('wf.requests').select('id').where('status', '=', 'pending').limit(1).executeTakeFirst();
      if (!req) return;

      await expect(
        act(db, {
          requestId: req.id,
          actorUserId: 1,
          action: 'reject',
          comment: '   ', // Blank comment
        })
      ).rejects.toThrow(/A decision reason is required when rejecting or sending back/);
    });
  });

  // =========================================================================
  // 16. SEPARATION F&F MULTI-COMPONENT SETTLEMENT COMPLETENESS
  // =========================================================================
  describe('Full F&F Multi-Component Settlement Completeness', () => {
    it('Full F&F Settlement incorporates notice shortfall, loans, asset damage, and travel wallet advance', () => {
      const calculation = computeFnfSettlement({
        employeeId: 101,
        separationId: 201,
        doj: '2020-01-01',
        approvedLwd: '2026-06-15',
        daysPayable: 15,
        daysInMonth: 30,
        basicMonthlyPaise: paise(3000000), // ₹30,000 Basic
        daMonthlyPaise: paise(0),
        grossMonthlyPaise: paise(6000000), // ₹60,000 Gross
        elBalanceDays: 10, // 10 days EL
        shortfallDays: 15, // 15 days notice shortfall
        unreturnedAssetRecoveryPaise: paise(500000), // ₹5,000 asset recovery
        loanOutstandingPaise: paise(1000000), // ₹10,000 loan recovery
        travelAdvanceDebitPaise: paise(400000), // ₹4,000 travel advance recovery
        tdsPaise: paise(200000), // ₹2,000 TDS
        heldSalaryPaise: paise(1500000), // ₹15,000 held salary released
      });

      // 1. Prorated salary: (60,000 / 30) * 15 = ₹30,000 (3,000,000 paise)
      expect(calculation.earnings.proratedSalaryPaise).toBe(paise(3000000));
      // 2. Leave encashment: (30,000 / 30) * 10 = ₹10,000 (1,000,000 paise)
      expect(calculation.earnings.leaveEncashmentPaise).toBe(paise(1000000));
      // 3. Gratuity: 6 completed years (2020 to 2026 = 6.45y -> rounds to 6y): (15 * 30,000 * 6) / 26 = ₹1,03,846 (10,384,600 paise)
      expect(calculation.earnings.gratuityPaise).toBe(paise(10384600));
      // 4. Held salary released: ₹15,000
      expect(calculation.earnings.heldSalaryReleasedPaise).toBe(paise(1500000));

      // Gross payable = 30,000 + 10,000 + 103,846 + 15,000 = ₹1,58,846
      expect(calculation.earnings.grossPayablePaise).toBe(
        paise(3000000 + 1000000 + 10384600 + 1500000)
      );

      // Deductions:
      // Notice recovery: (30,000 / 30) * 15 = ₹15,000
      expect(calculation.deductions.noticeRecoveryPaise).toBe(paise(1500000));
      // Asset recovery: ₹5,000
      expect(calculation.deductions.assetRecoveryPaise).toBe(paise(500000));
      // Loan recovery: ₹10,000
      expect(calculation.deductions.loanRecoveryPaise).toBe(paise(1000000));
      // Travel advance recovery: ₹4,000
      expect(calculation.deductions.travelAdvanceRecoveryPaise).toBe(paise(400000));
      // TDS: ₹2,000
      expect(calculation.deductions.tdsPaise).toBe(paise(200000));

      // Total deductions = 15,000 + 5,000 + 10,000 + 4,000 + 2,000 = ₹36,000 (3,600,000 paise)
      expect(calculation.deductions.totalDeductionsPaise).toBe(paise(3600000));

      // Net payable = 1,58,846 - 36,000 = ₹1,22,846 (12,284,600 paise)
      expect(calculation.netPayablePaise).toBe(paise(12284600));
    });
  });
});
