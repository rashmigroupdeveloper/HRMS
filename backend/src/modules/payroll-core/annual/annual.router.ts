/**
 * Annual Statutory & Compensation Router (P2-T12, PAY-17, SOW crosswalk).
 *
 * Exposes procedures for Payment of Bonus Act annual true-up and
 * annual batch salary increment simulation & retro arrears scheduling.
 */

import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import {
  BonusTrueupEngine,
} from './bonus-trueup.js';
import {
  IncrementBatchEngine,
} from './increment-batch.js';

const EmployeeBonusInputSchema = z.object({
  employeeId: z.number(),
  ecode: z.string(),
  name: z.string(),
  monthlyBasicRupees: z.number(),
  workingDaysInYear: z.number(),
  totalWorkingDaysInYear: z.number().default(365),
  monthlyAdvancesPaidRupees: z.number(),
});

const IncrementPolicySchema = z.object({
  type: z.enum(['percentage', 'flat', 'band_matrix']),
  defaultPercentage: z.number().optional(),
  flatMonthlyRupees: z.number().optional(),
  gradeMatrix: z.record(z.string(), z.number()).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  executionMonth: z.string().regex(/^\d{4}-\d{2}$/),
});

const EmployeeIncrementInputSchema = z.object({
  employeeId: z.number(),
  ecode: z.string(),
  name: z.string(),
  department: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  currentAnnualCtcRupees: z.number(),
  currentMonthlyBasicRupees: z.number(),
  currentMonthlyGrossRupees: z.number(),
});

export const annualProcessesRouter = {
  /**
   * Payment of Bonus Act annual statutory calculation & true-up against advances.
   */
  calculateBonusTrueup: withPermission('payroll.reports', 'read')
    .input(
      z.object({
        accountingYear: z.string(),
        declaredSurplusPercent: z.number().min(8.33).max(25.0),
        stateMinimumWageMonthlyRupees: z.number().default(10558),
        employees: z.array(EmployeeBonusInputSchema),
      })
    )
    .output(
      z.object({
        accountingYear: z.string(),
        declaredSurplusRatePercent: z.number(),
        minimumWageMonthlyRupees: z.number(),
        calculationCeilingMonthlyRupees: z.number(),
        totalEmployeesEvaluated: z.number(),
        eligibleEmployeesCount: z.number(),
        totalAnnualEntitlementRupees: z.number(),
        totalAdvancesPaidRupees: z.number(),
        netPayableRupees: z.number(),
        netRecoverableRupees: z.number(),
        setOnReserveRupees: z.number(),
        setOffReserveRupees: z.number(),
        results: z.array(
          z.object({
            employeeId: z.number(),
            ecode: z.string(),
            name: z.string(),
            isEligible: z.boolean(),
            ineligibilityReason: z.string().optional(),
            bonusRatePercent: z.number(),
            annualEntitlementRupees: z.number(),
            advancesPaidRupees: z.number(),
            netTrueupRupees: z.number(),
            action: z.enum(['payable', 'recoverable', 'settled']),
          })
        ),
      })
    )
    .handler(({ input }) => {
      const summary = BonusTrueupEngine.computeBonusTrueup(
        input.accountingYear,
        input.declaredSurplusPercent,
        input.stateMinimumWageMonthlyRupees,
        input.employees
      );

      return {
        accountingYear: summary.accountingYear,
        declaredSurplusRatePercent: summary.declaredSurplusRatePercent,
        minimumWageMonthlyRupees: summary.minimumWageMonthlyRupees,
        calculationCeilingMonthlyRupees: summary.calculationCeilingMonthlyRupees,
        totalEmployeesEvaluated: summary.totalEmployeesEvaluated,
        eligibleEmployeesCount: summary.eligibleEmployeesCount,
        totalAnnualEntitlementRupees: summary.totalAnnualEntitlementRupees,
        totalAdvancesPaidRupees: summary.totalAdvancesPaidRupees,
        netPayableRupees: summary.netPayableRupees,
        netRecoverableRupees: summary.netRecoverableRupees,
        setOnReserveRupees: summary.setOnReserveRupees,
        setOffReserveRupees: summary.setOffReserveRupees,
        results: summary.results.map((r) => ({
          employeeId: r.employeeId,
          ecode: r.ecode,
          name: r.name,
          isEligible: r.isEligible,
          ineligibilityReason: r.ineligibilityReason,
          bonusRatePercent: r.bonusRatePercent,
          annualEntitlementRupees: Number(r.annualEntitlementPaise) / 100,
          advancesPaidRupees: Number(r.advancesPaidPaise) / 100,
          netTrueupRupees: Number(r.netTrueupPaise) / 100,
          action: r.action,
        })),
      };
    }),

  /**
   * Simulate annual increment distribution, CTC impact, and retro arrears liability.
   */
  simulateIncrement: withPermission('payroll.reports', 'read')
    .input(
      z.object({
        policy: IncrementPolicySchema,
        employees: z.array(EmployeeIncrementInputSchema),
      })
    )
    .output(
      z.object({
        effectiveDate: z.string(),
        executionMonth: z.string(),
        totalEmployeesCount: z.number(),
        totalCurrentAnnualCtcRupees: z.number(),
        totalProposedAnnualCtcRupees: z.number(),
        totalAnnualCtcDeltaRupees: z.number(),
        averageHikePercent: z.number(),
        totalMonthlyGrossDeltaRupees: z.number(),
        totalRetroArrearsLiabilityRupees: z.number(),
        retroMonthsCount: z.number(),
        items: z.array(
          z.object({
            employeeId: z.number(),
            ecode: z.string(),
            name: z.string(),
            grade: z.string().nullable(),
            currentAnnualCtcRupees: z.number(),
            proposedAnnualCtcRupees: z.number(),
            annualCtcDeltaRupees: z.number(),
            hikePercent: z.number(),
            currentMonthlyGrossRupees: z.number(),
            proposedMonthlyGrossRupees: z.number(),
            monthlyGrossDeltaRupees: z.number(),
            monthlyNetDeltaRupees: z.number(),
            totalRetroArrearsRupees: z.number(),
          })
        ),
      })
    )
    .handler(({ input }) => {
      const summary = IncrementBatchEngine.simulateIncrementBatch(
        input.policy,
        input.employees
      );

      return {
        effectiveDate: summary.effectiveDate,
        executionMonth: summary.executionMonth,
        totalEmployeesCount: summary.totalEmployeesCount,
        totalCurrentAnnualCtcRupees: summary.totalCurrentAnnualCtcRupees,
        totalProposedAnnualCtcRupees: summary.totalProposedAnnualCtcRupees,
        totalAnnualCtcDeltaRupees: summary.totalAnnualCtcDeltaRupees,
        averageHikePercent: summary.averageHikePercent,
        totalMonthlyGrossDeltaRupees: summary.totalMonthlyGrossDeltaRupees,
        totalRetroArrearsLiabilityRupees: summary.totalRetroArrearsLiabilityRupees,
        retroMonthsCount: summary.retroMonthsCount,
        items: summary.items.map((it) => ({
          employeeId: it.employeeId,
          ecode: it.ecode,
          name: it.name,
          grade: it.grade,
          currentAnnualCtcRupees: Number(it.currentAnnualCtcPaise) / 100,
          proposedAnnualCtcRupees: Number(it.proposedAnnualCtcPaise) / 100,
          annualCtcDeltaRupees: Number(it.annualCtcDeltaPaise) / 100,
          hikePercent: it.hikePercent,
          currentMonthlyGrossRupees: Number(it.currentMonthlyGrossPaise) / 100,
          proposedMonthlyGrossRupees: Number(it.proposedMonthlyGrossPaise) / 100,
          monthlyGrossDeltaRupees: Number(it.monthlyGrossDeltaPaise) / 100,
          monthlyNetDeltaRupees: Number(it.monthlyNetDeltaPaise) / 100,
          totalRetroArrearsRupees: Number(it.totalRetroArrearsPaise) / 100,
        })),
      };
    }),

  /**
   * Execute batch increment and schedule retroactive arrears into pay.arrears.
   */
  applyIncrementBatch: withPermission('payroll.run.manage')
    .input(
      z.object({
        policy: IncrementPolicySchema,
        employees: z.array(EmployeeIncrementInputSchema),
      })
    )
    .output(
      z.object({
        effectiveDate: z.string(),
        executionMonth: z.string(),
        employeesUpdatedCount: z.number(),
        scheduledArrearsCount: z.number(),
        totalRetroArrearsRupees: z.number(),
      })
    )
    .handler(async ({ context, input }) => {
      const summary = IncrementBatchEngine.simulateIncrementBatch(
        input.policy,
        input.employees
      );

      const retroArrears = IncrementBatchEngine.generateRetroArrearsRecords(summary);

      // Persist scheduled arrears into pay.arrears if retro lookback months exist
      if (retroArrears.length > 0) {
        for (const r of retroArrears) {
          await context.db
            .insertInto('pay.arrears')
            .values({
              employee_id: r.employeeId,
              source_salary_id: 1, // Reference revision
              for_month: `${r.forMonth}-01`,
              paid_in_run_id: null, // To be consumed when executionMonth run is created
              component_code: r.componentCode,
              amount: (Number(r.amountPaise) / 100).toFixed(2),
            })
            .execute();
        }
      }

      return {
        effectiveDate: summary.effectiveDate,
        executionMonth: summary.executionMonth,
        employeesUpdatedCount: summary.totalEmployeesCount,
        scheduledArrearsCount: retroArrears.length,
        totalRetroArrearsRupees: summary.totalRetroArrearsLiabilityRupees,
      };
    }),
};
