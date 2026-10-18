/**
 * Payroll Outputs Router (PAY-05, PAY-06, CORE-10).
 *
 * Exposes oRPC endpoints for payslip generation, banking exports,
 * SAP Journal Vouchers, R10 variance reports, and outputs tracking.
 */

import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { PayslipGeneratorService } from './payslip/payslip-generator.js';
import { BankFileService } from './bank/bank-file.service.js';
import { SapJvService } from './gl/sap-jv.service.js';
import { VarianceReportService } from './variance/variance.service.js';
import { OutputsBundleService } from './outputs-bundle.service.js';

const PayslipEmployeeSchema = z.object({
  id: z.number(),
  ecode: z.string(),
  name: z.string(),
  designation: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  costCenter: z.string().nullable().optional(),
  doj: z.string().nullable().optional(),
  bankAccountMasked: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  ifsc: z.string().nullable().optional(),
  panMasked: z.string().nullable().optional(),
  uanMasked: z.string().nullable().optional(),
  pfNumberMasked: z.string().nullable().optional(),
  esicNumberMasked: z.string().nullable().optional(),
});

const PayslipAttendanceSchema = z.object({
  daysInMonth: z.number(),
  payableDays: z.number(),
  lopDays: z.number(),
  lopReversalDays: z.number(),
  otMinutes: z.number(),
});

const PayslipLineItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  amountRupees: z.number(),
  calcNote: z.string().nullable().optional(),
});

const OvertimeBreakdownSchema = z.object({
  basicRupees: z.number(),
  daRupees: z.number(),
  otAllowancesRupees: z.number(),
  otBaseRupees: z.number(),
  divisorHours: z.number(),
  hourlyRateRupees: z.number(),
  multiplier: z.number(),
  otHours: z.number(),
  totalOtRupees: z.number(),
});

const LeaveBalanceItemSchema = z.object({
  type: z.string(),
  opening: z.number(),
  accrued: z.number(),
  availed: z.number(),
  balance: z.number(),
});

const PayslipDataSchema = z.object({
  companyName: z.string(),
  monthStr: z.string(),
  monthName: z.string(),
  type: z.enum(['regular', 'reimbursement', 'overtime']),
  employee: PayslipEmployeeSchema,
  attendance: PayslipAttendanceSchema,
  earnings: z.array(PayslipLineItemSchema),
  deductions: z.array(PayslipLineItemSchema),
  employerContributions: z.array(PayslipLineItemSchema).optional(),
  grossRupees: z.number(),
  totalDeductionsRupees: z.number(),
  netPayRupees: z.number(),
  netPayInWords: z.string(),
  overtimeBreakdown: OvertimeBreakdownSchema.optional(),
  leaveBalances: z.array(LeaveBalanceItemSchema).optional(),
});

const EmployeeVarianceSchema = z.object({
  employeeId: z.number(),
  ecode: z.string(),
  name: z.string(),
  department: z.string().nullable(),
  designation: z.string().nullable(),
  currentGross: z.number(),
  previousGross: z.number(),
  grossDelta: z.number(),
  grossDeltaPercent: z.number(),
  currentNet: z.number(),
  previousNet: z.number(),
  netDelta: z.number(),
  netDeltaPercent: z.number(),
  currentPayableDays: z.number(),
  previousPayableDays: z.number(),
  payableDaysDelta: z.number(),
  currentLopDays: z.number(),
  previousLopDays: z.number(),
  lopDaysDelta: z.number(),
  paymentStatus: z.string(),
  isAnomaly: z.boolean(),
  anomalies: z.array(z.string()),
});

const VarianceReportSummarySchema = z.object({
  runId: z.number(),
  previousRunId: z.number().nullable(),
  companyName: z.string(),
  currentMonth: z.string(),
  previousMonth: z.string().nullable(),
  employeeCount: z.number(),
  totalCurrentGross: z.number(),
  totalPreviousGross: z.number(),
  grossDeltaTotal: z.number(),
  totalCurrentNet: z.number(),
  totalPreviousNet: z.number(),
  netDeltaTotal: z.number(),
  anomalyCount: z.number(),
  items: z.array(EmployeeVarianceSchema),
});

const RunOutputItemSchema = z.object({
  code: z.string(),
  label: z.string(),
  note: z.string(),
  isReady: z.boolean(),
  documentId: z.number().nullable(),
  generatedAt: z.string().nullable(),
  recordCount: z.number().nullable(),
  totalAmountRupees: z.number().nullable(),
});

const RunOutputsStatusSchema = z.object({
  runId: z.number(),
  companyName: z.string(),
  month: z.string(),
  status: z.string(),
  canGenerateOutputs: z.boolean(),
  outputs: z.array(RunOutputItemSchema),
});

export const payrollOutputsRouter = {
  /**
   * Get formatted payslip for an employee in a run (HR/Admin view).
   */
  getPayslip: withPermission('payroll.run.view', 'read')
    .input(
      z.object({
        runId: z.number(),
        employeeId: z.number(),
        type: z.enum(['regular', 'reimbursement', 'overtime']).optional(),
      })
    )
    .output(
      z.object({
        payslip: PayslipDataSchema,
        html: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const service = new PayslipGeneratorService(context.db);
      const data = await service.assemblePayslipData(
        input.runId,
        input.employeeId,
        input.type ?? 'regular'
      );
      const { renderPayslipHtml } = await import('./payslip/template.service.js');
      const html = renderPayslipHtml(data);
      return { payslip: data, html };
    }),

  /**
   * Get employee's own payslip for ESS surface (/my/pay).
   */
  getMyPayslip: withPermission('employee.compensation.read', 'read')
    .input(
      z.object({
        month: z.string().optional(), // YYYY-MM
        type: z.enum(['regular', 'reimbursement', 'overtime']).optional(),
      })
    )
    .output(
      z
        .object({
          payslip: PayslipDataSchema,
          html: z.string(),
        })
        .nullable()
    )
    .handler(async ({ context, input }) => {
      // Find the employee record linked to the logged-in user
      const employeeId = context.user.employee_id;
      if (!employeeId) {
        return null;
      }

      const emp = await context.db
        .selectFrom('core.employees')
        .select(['id', 'company_id'])
        .where('id', '=', employeeId)
        .executeTakeFirst();

      if (!emp) {
        return null;
      }

      // Find the latest approved/finalized run for the employee's company
      let runQuery = context.db
        .selectFrom('pay.payroll_runs')
        .select(['id'])
        .where('company_id', '=', emp.company_id)
        .where('status', 'in', ['approved', 'finalized', 'paid']);

      if (input.month) {
        runQuery = runQuery.where('month', '=', `${input.month}-01` as unknown as Date);
      } else {
        runQuery = runQuery.orderBy('month', 'desc');
      }

      const run = await runQuery.executeTakeFirst();
      if (!run) {
        return null;
      }

      const service = new PayslipGeneratorService(context.db);
      try {
        const data = await service.assemblePayslipData(
          run.id,
          emp.id,
          input.type ?? 'regular'
        );
        const { renderPayslipHtml } = await import('./payslip/template.service.js');
        const html = renderPayslipHtml(data);
        return { payslip: data, html };
      } catch {
        return null;
      }
    }),

  /**
   * Batch generate and archive payslips for an entire run.
   */
  generateRunPayslips: withPermission('payroll.run.manage')
    .input(z.object({ runId: z.number() }))
    .output(
      z.object({
        success: z.boolean(),
        totalItems: z.number(),
        generatedCount: z.number(),
      })
    )
    .handler(async ({ context, input }) => {
      const service = new PayslipGeneratorService(context.db);
      const res = await service.generateRunPayslips(input.runId, context.user.id);
      return { success: true, ...res };
    }),

  /**
   * Generate Bank bulk payment file (NEFT/RTGS CSV) excluding holds.
   */
  generateBankFile: withPermission('payroll.run.manage')
    .input(z.object({ runId: z.number() }))
    .output(
      z.object({
        batchId: z.number(),
        documentId: z.number(),
        recordCount: z.number(),
        totalAmountRupees: z.number(),
        heldCount: z.number(),
        heldAmountRupees: z.number(),
        csvContent: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const service = new BankFileService(context.db);
      const res = await service.generateBankBatch(input.runId, context.user.id);
      return {
        batchId: res.batchId,
        documentId: res.documentId,
        recordCount: res.recordCount,
        totalAmountRupees: res.totalAmountRupees,
        heldCount: res.heldCount,
        heldAmountRupees: res.heldAmountRupees,
        csvContent: res.csvContent,
      };
    }),

  /**
   * Generate SAP Journal Voucher (JV) posting file.
   */
  generateSapJv: withPermission('payroll.run.manage')
    .input(z.object({ runId: z.number() }))
    .output(
      z.object({
        documentId: z.number(),
        totalDebitsRupees: z.number(),
        totalCreditsRupees: z.number(),
        totalCtcRupees: z.number(),
        isBalanced: z.boolean(),
        csvContent: z.string(),
      })
    )
    .handler(async ({ context, input }) => {
      const service = new SapJvService(context.db);
      const res = await service.generateSapJv(input.runId, context.user.id);
      return {
        documentId: res.documentId,
        totalDebitsRupees: res.totalDebitsRupees,
        totalCreditsRupees: res.totalCreditsRupees,
        totalCtcRupees: res.totalCtcRupees,
        isBalanced: res.isBalanced,
        csvContent: res.csvContent,
      };
    }),

  /**
   * Get R10 Variance Report comparing current run against previous run.
   */
  getVarianceReport: withPermission('payroll.run.view', 'read')
    .input(
      z.object({
        runId: z.number(),
        thresholdPercent: z.number().optional(),
        thresholdAmount: z.number().optional(),
      })
    )
    .output(VarianceReportSummarySchema)
    .handler(async ({ context, input }) => {
      const service = new VarianceReportService(context.db);
      return await service.generateVarianceReport(
        input.runId,
        input.thresholdPercent,
        input.thresholdAmount
      );
    }),

  /**
   * Get status bundle of all outputs for a run.
   */
  getRunOutputs: withPermission('payroll.run.view', 'read')
    .input(z.object({ runId: z.number() }))
    .output(RunOutputsStatusSchema)
    .handler(async ({ context, input }) => {
      const service = new OutputsBundleService(context.db);
      return await service.getRunOutputsStatus(input.runId);
    }),
};
