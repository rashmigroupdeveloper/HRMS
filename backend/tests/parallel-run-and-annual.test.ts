/**
 * Parallel Run & Annual Processes Test Suite (P2-T11, P2-T12).
 *
 * Verifies:
 * 1. Protiviti legacy register ingestion, checksum hashing, and row conservation.
 * 2. Automated R20 variance reconciler with Gross-first protocol and 5-way categorization.
 * 3. Historical YTD opening accumulator for mid-year cutover and tax continuity.
 * 4. Payment of Bonus Act 1965 true-up: eligibility (30 days & ₹21k cap), 8.33%-20% limits,
 *    monthly advance offsets, and Section 15 set-on/set-off reserve.
 * 5. Batch annual increments with CTC impact simulation and retroactive arrears generation.
 */

import { describe, it, expect } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../src/core/db/types.js';
import {
  parseAndValidateProtivitiRegister,
  type ProtivitiRegisterRow,
} from '../src/modules/payroll-core/parallel-run/parallel-import.js';
import {
  ParallelRunVarianceService,
} from '../src/modules/payroll-core/parallel-run/variance-reporter.js';
import {
  YtdHistoricalLoader,
  type YtdOpeningRecord,
} from '../src/modules/payroll-core/parallel-run/ytd-loader.js';
import {
  BonusTrueupEngine,
  type EmployeeBonusInput,
} from '../src/modules/payroll-core/annual/bonus-trueup.js';
import {
  IncrementBatchEngine,
  type IncrementPolicy,
  type EmployeeIncrementInput,
} from '../src/modules/payroll-core/annual/increment-batch.js';

describe('Parallel Run & Annual Statutory Processes (Stage 2.6 / Card P07)', () => {
  describe('P2-T11 — Parallel Run Ingestion & Delta Analysis', () => {
    const sampleProtivitiRows: ProtivitiRegisterRow[] = [
      {
        ecode: 'RML001',
        name: 'Amit Sharma',
        department: 'Operations',
        designation: 'Plant Engineer',
        payableDays: 30,
        lopDays: 0,
        basicRupees: 20000,
        hraRupees: 10000,
        medicalAllowRupees: 1250,
        specialAllowRupees: 5000,
        educationAllowRupees: 200,
        bonusAdvanceRupees: 1666,
        otherAllowancesRupees: 0,
        grossRupees: 38116,
        pfEeRupees: 2400,
        esicEeRupees: 0,
        ptRupees: 200,
        lwfRupees: 3,
        tdsRupees: 1500,
        otherDeductionsRupees: 0,
        totalDeductionsRupees: 4103,
        netPayRupees: 34013,
      },
      {
        ecode: 'RML002',
        name: 'Sunita Ghosh',
        department: 'Finance',
        designation: 'Accountant',
        payableDays: 28,
        lopDays: 2,
        basicRupees: 18000,
        hraRupees: 9000,
        medicalAllowRupees: 1250,
        specialAllowRupees: 3000,
        educationAllowRupees: 200,
        bonusAdvanceRupees: 1500,
        otherAllowancesRupees: 0,
        grossRupees: 32950,
        pfEeRupees: 2160,
        esicEeRupees: 0,
        ptRupees: 150,
        lwfRupees: 3,
        tdsRupees: 800,
        otherDeductionsRupees: 0,
        totalDeductionsRupees: 3113,
        netPayRupees: 29837,
      },
    ];

    it('ingests and normalizes Protiviti register with cryptographic checksum', () => {
      const result = parseAndValidateProtivitiRegister('2026-07', 'protiviti_july_2026.csv', sampleProtivitiRows);

      expect(result.headcount).toBe(2);
      expect(result.registerMonth).toBe('2026-07');
      expect(result.sourceFileName).toBe('protiviti_july_2026.csv');
      expect(result.checksum).toBeDefined();
      expect(result.checksum.length).toBe(64); // SHA-256
      expect(Number(result.totalGrossPaise) / 100).toBe(71066);
      expect(Number(result.totalDeductionsPaise) / 100).toBe(7216);
      expect(Number(result.totalNetPaise) / 100).toBe(63850);
    });

    it('rejects duplicate employee codes in legacy pay register', () => {
      const firstRow = sampleProtivitiRows[0];
      if (!firstRow) throw new Error('sample row required');
      const dupRows = [
        firstRow,
        { ...firstRow, name: 'Duplicate Amit' },
      ];

      expect(() => {
        parseAndValidateProtivitiRegister('2026-07', 'dup.csv', dupRows);
      }).toThrow(/Duplicate employee code/);
    });

    it('reconciles HRMS items with Protiviti register and verifies cutover gate', async () => {
      // Mock Kysely db for unit test
      const createBuilder = (table: string) => {
        const b = {
          innerJoin: () => b,
          select: () => b,
          where: () => b,
          executeTakeFirst: () => {
            if (table === 'pay.payroll_runs') {
              return Promise.resolve({ id: 1, month: '2026-07-01', status: 'computed', company_id: 1 });
            }
            return Promise.resolve(null);
          },
          execute: () => {
            if (table === 'pay.payroll_items as pi') {
              return Promise.resolve([
                {
                  item_id: 101,
                  employee_id: 1,
                  payable_days: 30,
                  lop_days: 0,
                  gross: '38116.00',
                  total_deductions: '4103.00',
                  net_pay: '34013.00',
                  ecode: 'RML001',
                  first_name: 'Amit',
                  last_name: 'Sharma',
                },
                {
                  item_id: 102,
                  employee_id: 2,
                  payable_days: 28,
                  lop_days: 2,
                  gross: '32951.00', // 1 rupee rounding difference in HRMS
                  total_deductions: '3113.00',
                  net_pay: '29838.00',
                  ecode: 'RML002',
                  first_name: 'Sunita',
                  last_name: 'Ghosh',
                },
              ]);
            }
            if (table === 'pay.payroll_item_lines as pil') {
              return Promise.resolve([
                { employee_id: 1, component_code: 'BASIC', amount: '20000.00' },
                { employee_id: 1, component_code: 'HRA', amount: '10000.00' },
                { employee_id: 1, component_code: 'PF_EE', amount: '2400.00' },
                { employee_id: 2, component_code: 'BASIC', amount: '18000.00' },
                { employee_id: 2, component_code: 'HRA', amount: '9000.00' },
                { employee_id: 2, component_code: 'PF_EE', amount: '2160.00' },
              ]);
            }
            return Promise.resolve([]);
          },
        };
        return b;
      };

      const mockDb = {
        selectFrom: (table: string) => createBuilder(table),
      } as unknown as Kysely<Database>;

      const service = new ParallelRunVarianceService(mockDb);
      const ingested = parseAndValidateProtivitiRegister('2026-07', 'protiviti.csv', sampleProtivitiRows);
      const report = await service.compareRunAgainstProtiviti(1, ingested);

      expect(report.headcount).toBe(2);
      expect(report.exactMatchCount).toBe(1); // RML001 exact match
      expect(report.roundingToleranceCount).toBe(1); // RML002 has ₹1 rounding difference
      expect(report.unexplainedBugCount).toBe(0);
      expect(report.cutOverGatePassed).toBe(true); // Gate passes because no unexplained bugs exist
    });
  });

  describe('P2-T11 — Mid-year YTD Opening Historical Loader', () => {
    it('loads and stores cumulative YTD facts for Section 192 continuity', () => {
      YtdHistoricalLoader.clear();

      const ytdRecords: YtdOpeningRecord[] = [
        {
          ecode: 'RML001',
          financialYear: '2026-2027',
          cutoverMonth: '2026-09',
          monthsProcessed: 5,
          cumulativeGrossRupees: 190580,
          cumulativeTaxableGrossRupees: 190580,
          cumulativePfEeRupees: 12000,
          cumulativePtRupees: 1000,
          cumulativeTdsRupees: 7500,
        },
      ];

      const res = YtdHistoricalLoader.loadYtdOpeningBatch(ytdRecords);
      expect(res.employeeCount).toBe(1);
      expect(res.totalGrossRupees).toBe(190580);
      expect(res.totalTdsRupees).toBe(7500);

      const retrieved = YtdHistoricalLoader.getEmployeeYtd('RML001', '2026-2027');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.monthsProcessed).toBe(5);
      expect(Number(retrieved?.cumulativeGrossPaise) / 100).toBe(190580);
    });
  });

  describe('P2-T12 — Payment of Bonus Act Annual True-up', () => {
    const bonusEmployees: EmployeeBonusInput[] = [
      {
        employeeId: 1,
        ecode: 'RML010',
        name: 'Bikash Roy',
        monthlyBasicRupees: 15000, // <= ₹21,000 (Eligible)
        workingDaysInYear: 300, // >= 30 days
        totalWorkingDaysInYear: 300,
        monthlyAdvancesPaidRupees: 14994, // 15,000 * 8.33% * 12 ≈ ₹14,994 advance paid
      },
      {
        employeeId: 2,
        ecode: 'RML020',
        name: 'Tarun Mandal',
        monthlyBasicRupees: 6500, // Below ₹7,000 calculation ceiling
        workingDaysInYear: 300,
        totalWorkingDaysInYear: 300,
        monthlyAdvancesPaidRupees: 6497, // 6,500 * 8.33% * 12 ≈ ₹6,497
      },
      {
        employeeId: 3,
        ecode: 'RML030',
        name: 'Pooja Agarwal',
        monthlyBasicRupees: 35000, // > ₹21,000 (Ineligible under Act)
        workingDaysInYear: 300,
        totalWorkingDaysInYear: 300,
        monthlyAdvancesPaidRupees: 0,
      },
      {
        employeeId: 4,
        ecode: 'RML040',
        name: 'New Joiner Trainee',
        monthlyBasicRupees: 12000,
        workingDaysInYear: 15, // < 30 working days (Ineligible under Sec 8)
        totalWorkingDaysInYear: 300,
        monthlyAdvancesPaidRupees: 500,
      },
    ];

    it('calculates 8.33% statutory minimum bonus against ₹7,000 calculation ceiling', () => {
      // West Bengal min wage ₹10,558 > ₹7,000 statutory floor, so calculation ceiling = ₹10,558
      const summary = BonusTrueupEngine.computeBonusTrueup(
        '2025-2026',
        8.33,
        10558,
        bonusEmployees
      );

      expect(summary.eligibleEmployeesCount).toBe(2); // Bikash and Tarun eligible
      expect(summary.totalEmployeesEvaluated).toBe(4);

      // Check Bikash: Basic ₹15,000 clamped to calc ceiling ₹10,558
      const bikash = summary.results.find((r) => r.ecode === 'RML010');
      expect(bikash).toBeDefined();
      if (!bikash) return;
      expect(bikash.isEligible).toBe(true);
      expect(Number(bikash.calculationBaseMonthlyPaise) / 100).toBe(10558);
      // Annual entitlement = 10,558 * 12 * 8.33% = ₹10,553.78
      expect(Number(bikash.annualEntitlementPaise) / 100).toBe(10553.78);
      // Advances paid were ₹14,994 (calculated on full ₹15,000 basic) -> Excess advance recoverable
      expect(bikash.action).toBe('recoverable');
      expect(Number(bikash.netTrueupPaise) / 100).toBe(-4440.22);

      // Check Tarun: Basic ₹6,500 is below ceiling ₹10,558, so base = ₹6,500
      const tarun = summary.results.find((r) => r.ecode === 'RML020');
      expect(tarun).toBeDefined();
      if (!tarun) return;
      expect(tarun.isEligible).toBe(true);
      expect(Number(tarun.calculationBaseMonthlyPaise) / 100).toBe(6500);

      // Check Pooja: Basic > ₹21k -> Ineligible
      const pooja = summary.results.find((r) => r.ecode === 'RML030');
      expect(pooja).toBeDefined();
      if (!pooja) return;
      expect(pooja.isEligible).toBe(false);
      expect(pooja.ineligibilityReason).toContain('exceeds statutory eligibility ceiling');

      // Check Trainee: < 30 days -> Ineligible
      const trainee = summary.results.find((r) => r.ecode === 'RML040');
      expect(trainee).toBeDefined();
      if (!trainee) return;
      expect(trainee.isEligible).toBe(false);
      expect(trainee.ineligibilityReason).toContain('Less than 30 working days');
      expect(trainee.action).toBe('recoverable'); // Must recover ₹500 advance paid
    });

    it('calculates Section 15 Set-on reserve when allocable surplus exceeds 20%', () => {
      const summary = BonusTrueupEngine.computeBonusTrueup(
        '2025-2026',
        25.0, // 25% surplus > 20% cap
        10558,
        bonusEmployees
      );

      expect(summary.declaredSurplusRatePercent).toBe(20.0); // Clamped to 20%
      expect(summary.setOnReserveRupees).toBeGreaterThan(0); // Set-on reserve created
    });
  });

  describe('P2-T12 — Annual Batch Increment & Retro Revision Engine', () => {
    const incrementEmployees: EmployeeIncrementInput[] = [
      {
        employeeId: 1,
        ecode: 'RML001',
        name: 'Amit Sharma',
        department: 'Operations',
        designation: 'Engineer',
        grade: 'E1',
        currentAnnualCtcRupees: 600000,
        currentMonthlyBasicRupees: 25000,
        currentMonthlyGrossRupees: 50000,
      },
      {
        employeeId: 2,
        ecode: 'RML002',
        name: 'Sunita Ghosh',
        department: 'Finance',
        designation: 'Accountant',
        grade: 'E2',
        currentAnnualCtcRupees: 480000,
        currentMonthlyBasicRupees: 20000,
        currentMonthlyGrossRupees: 40000,
      },
    ];

    it('simulates 10% batch increment and computes 3-month retroactive arrears', () => {
      const policy: IncrementPolicy = {
        type: 'percentage',
        defaultPercentage: 10.0,
        effectiveDate: '2026-04-01',
        executionMonth: '2026-07', // 3 months lookback (April, May, June)
      };

      const sim = IncrementBatchEngine.simulateIncrementBatch(policy, incrementEmployees);

      expect(sim.totalEmployeesCount).toBe(2);
      expect(sim.retroMonthsCount).toBe(3);
      expect(sim.totalCurrentAnnualCtcRupees).toBe(1080000);
      expect(sim.totalProposedAnnualCtcRupees).toBe(1188000); // 10% hike
      expect(sim.totalAnnualCtcDeltaRupees).toBe(108000);

      // Check Amit: Gross increases from ₹50,000 by 10% (₹5,000), Basic from ₹25,000 by 10% (₹2,500)
      // Monthly PF delta = 12% * 2,500 = ₹300
      // Monthly Net delta = ₹5,000 - ₹300 = ₹4,700
      // 3 months retro arrears = ₹4,700 * 3 = ₹14,100
      const amit = sim.items.find((i) => i.ecode === 'RML001');
      expect(amit).toBeDefined();
      if (!amit) return;
      expect(Number(amit.monthlyGrossDeltaPaise) / 100).toBe(5000);
      expect(Number(amit.monthlyPfDeltaPaise) / 100).toBe(300);
      expect(Number(amit.monthlyNetDeltaPaise) / 100).toBe(4700);
      expect(Number(amit.totalRetroArrearsPaise) / 100).toBe(14100);

      // Check arrears records generation
      const arrears = IncrementBatchEngine.generateRetroArrearsRecords(sim);
      expect(arrears.length).toBe(6); // 2 employees * 3 months
      const firstArrear = arrears[0];
      expect(firstArrear).toBeDefined();
      if (!firstArrear) return;
      expect(firstArrear.targetRunMonth).toBe('2026-07');
      expect(firstArrear.componentCode).toBe('BASIC_ARREARS');
    });

    it('handles flat rupee increment policy', () => {
      const policy: IncrementPolicy = {
        type: 'flat',
        flatMonthlyRupees: 3000,
        effectiveDate: '2026-07-01',
        executionMonth: '2026-07', // 0 months retro
      };

      const sim = IncrementBatchEngine.simulateIncrementBatch(policy, incrementEmployees);

      expect(sim.retroMonthsCount).toBe(0);
      expect(sim.totalRetroArrearsLiabilityRupees).toBe(0);
      // Total proposed CTC = Current + (3000 * 12 * 2) = 1,080,000 + 72,000 = 1,152,000
      expect(sim.totalProposedAnnualCtcRupees).toBe(1152000);
    });
  });
});
