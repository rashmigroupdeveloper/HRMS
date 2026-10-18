/**
 * Parallel Run Router (P2-T11, doc 04 §6.8, doc 14 §7.5, SOW crosswalk).
 *
 * Exposes procedures for importing Protiviti monthly pay registers,
 * generating automated dual-run variance reports (R20), and loading YTD historical facts.
 */

import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import { parseAndValidateProtivitiRegister } from './parallel-import.js';
import { ParallelRunVarianceService } from './variance-reporter.js';
import { YtdHistoricalLoader } from './ytd-loader.js';

const ProtivitiRowSchema = z.object({
  ecode: z.string(),
  name: z.string(),
  department: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  payableDays: z.number(),
  lopDays: z.number(),
  basicRupees: z.number(),
  hraRupees: z.number(),
  medicalAllowRupees: z.number(),
  specialAllowRupees: z.number(),
  educationAllowRupees: z.number(),
  bonusAdvanceRupees: z.number(),
  otherAllowancesRupees: z.number(),
  grossRupees: z.number(),
  pfEeRupees: z.number(),
  esicEeRupees: z.number(),
  ptRupees: z.number(),
  lwfRupees: z.number(),
  tdsRupees: z.number(),
  otherDeductionsRupees: z.number(),
  totalDeductionsRupees: z.number(),
  netPayRupees: z.number(),
});

const YtdOpeningSchema = z.object({
  ecode: z.string(),
  financialYear: z.string(),
  cutoverMonth: z.string(),
  monthsProcessed: z.number(),
  cumulativeGrossRupees: z.number(),
  cumulativeTaxableGrossRupees: z.number(),
  cumulativePfEeRupees: z.number(),
  cumulativePtRupees: z.number(),
  cumulativeTdsRupees: z.number(),
});

export const parallelRunRouter = {
  /**
   * Validate and inspect an imported Protiviti pay register before comparison.
   */
  importRegister: withPermission('payroll.run.manage')
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        fileName: z.string(),
        rows: z.array(ProtivitiRowSchema),
      })
    )
    .output(
      z.object({
        registerMonth: z.string(),
        sourceFileName: z.string(),
        checksum: z.string(),
        headcount: z.number(),
        totalGrossRupees: z.number(),
        totalDeductionsRupees: z.number(),
        totalNetRupees: z.number(),
        warningCount: z.number(),
        warnings: z.array(z.string()),
      })
    )
    .handler(({ input }) => {
      const parsed = parseAndValidateProtivitiRegister(
        input.month,
        input.fileName,
        input.rows
      );

      return {
        registerMonth: parsed.registerMonth,
        sourceFileName: parsed.sourceFileName,
        checksum: parsed.checksum,
        headcount: parsed.headcount,
        totalGrossRupees: Number(parsed.totalGrossPaise) / 100,
        totalDeductionsRupees: Number(parsed.totalDeductionsPaise) / 100,
        totalNetRupees: Number(parsed.totalNetPaise) / 100,
        warningCount: parsed.warnings.length,
        warnings: parsed.warnings,
      };
    }),

  /**
   * Run full automated component-by-component dual-run variance analysis (R20).
   */
  compareRun: withPermission('payroll.run.view', 'read')
    .input(
      z.object({
        runId: z.number(),
        month: z.string().regex(/^\d{4}-\d{2}$/),
        sourceFileName: z.string().default('protiviti_register.csv'),
        rows: z.array(ProtivitiRowSchema),
      })
    )
    .output(
      z.object({
        runId: z.number(),
        month: z.string(),
        comparisonTimestamp: z.string(),
        headcount: z.number(),
        exactMatchCount: z.number(),
        roundingToleranceCount: z.number(),
        policyDivergenceCount: z.number(),
        dataDiscrepancyCount: z.number(),
        unexplainedBugCount: z.number(),
        totalHrmsGrossRupees: z.number(),
        totalProtivitiGrossRupees: z.number(),
        grossDeltaRupees: z.number(),
        totalHrmsNetRupees: z.number(),
        totalProtivitiNetRupees: z.number(),
        netDeltaRupees: z.number(),
        cutOverGatePassed: z.boolean(),
        items: z.array(
          z.object({
            ecode: z.string(),
            name: z.string(),
            department: z.string().nullable(),
            designation: z.string().nullable(),
            payableDaysHrms: z.number(),
            payableDaysProtiviti: z.number(),
            payableDaysDelta: z.number(),
            hrmsGrossRupees: z.number(),
            protivitiGrossRupees: z.number(),
            grossDeltaRupees: z.number(),
            hrmsNetPayRupees: z.number(),
            protivitiNetPayRupees: z.number(),
            netDeltaRupees: z.number(),
            category: z.string(),
            notes: z.array(z.string()),
          })
        ),
      })
    )
    .handler(async ({ context, input }) => {
      const parsedRegister = parseAndValidateProtivitiRegister(
        input.month,
        input.sourceFileName,
        input.rows
      );

      const service = new ParallelRunVarianceService(context.db);
      const report = await service.compareRunAgainstProtiviti(input.runId, parsedRegister);

      return {
        runId: report.runId,
        month: report.month,
        comparisonTimestamp: report.comparisonTimestamp,
        headcount: report.headcount,
        exactMatchCount: report.exactMatchCount,
        roundingToleranceCount: report.roundingToleranceCount,
        policyDivergenceCount: report.policyDivergenceCount,
        dataDiscrepancyCount: report.dataDiscrepancyCount,
        unexplainedBugCount: report.unexplainedBugCount,
        totalHrmsGrossRupees: report.totalHrmsGrossRupees,
        totalProtivitiGrossRupees: report.totalProtivitiGrossRupees,
        grossDeltaRupees: report.grossDeltaRupees,
        totalHrmsNetRupees: report.totalHrmsNetRupees,
        totalProtivitiNetRupees: report.totalProtivitiNetRupees,
        netDeltaRupees: report.netDeltaRupees,
        cutOverGatePassed: report.cutOverGatePassed,
        items: report.items.map((it) => ({
          ecode: it.ecode,
          name: it.name,
          department: it.department,
          designation: it.designation,
          payableDaysHrms: it.payableDaysHrms,
          payableDaysProtiviti: it.payableDaysProtiviti,
          payableDaysDelta: it.payableDaysDelta,
          hrmsGrossRupees: Number(it.hrmsGrossPaise) / 100,
          protivitiGrossRupees: Number(it.protivitiGrossPaise) / 100,
          grossDeltaRupees: Number(it.grossDeltaPaise) / 100,
          hrmsNetPayRupees: Number(it.hrmsNetPayPaise) / 100,
          protivitiNetPayRupees: Number(it.protivitiNetPayPaise) / 100,
          netDeltaRupees: Number(it.netDeltaPaise) / 100,
          category: it.category,
          notes: it.notes,
        })),
      };
    }),

  /**
   * Import historical YTD opening payroll data for mid-year cutover.
   */
  loadYtd: withPermission('payroll.run.manage')
    .input(
      z.object({
        records: z.array(YtdOpeningSchema),
      })
    )
    .output(
      z.object({
        financialYear: z.string(),
        cutoverMonth: z.string(),
        employeeCount: z.number(),
        totalGrossRupees: z.number(),
        totalTaxableGrossRupees: z.number(),
        totalPfEeRupees: z.number(),
        totalPtRupees: z.number(),
        totalTdsRupees: z.number(),
      })
    )
    .handler(({ input }) => {
      const res = YtdHistoricalLoader.loadYtdOpeningBatch(input.records);
      return {
        financialYear: res.financialYear,
        cutoverMonth: res.cutoverMonth,
        employeeCount: res.employeeCount,
        totalGrossRupees: res.totalGrossRupees,
        totalTaxableGrossRupees: res.totalTaxableGrossRupees,
        totalPfEeRupees: res.totalPfEeRupees,
        totalPtRupees: res.totalPtRupees,
        totalTdsRupees: res.totalTdsRupees,
      };
    }),
};
