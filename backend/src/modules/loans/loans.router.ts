import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import { LoansService } from './loans.service.js';

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked' });
  }
  return user.employee_id;
}

const loanTypeSchema = z.enum([
  'loan_diminishing',
  'loan_flat',
  'emi_no_interest',
  'salary_advance',
  'travel_advance',
]);

const loanStatusSchema = z.enum(['active', 'closed', 'written_off']);

const loanSummarySchema = z.object({
  loanId: z.number(),
  employeeId: z.number(),
  loanType: loanTypeSchema,
  originalPrincipalRupees: z.number(),
  annualInterestRate: z.number(),
  monthlyEmiRupees: z.number(),
  tenureMonths: z.number(),
  startMonth: z.string(),
  currentOutstandingRupees: z.number(),
  totalRecoveredPrincipalRupees: z.number(),
  totalRecoveredInterestRupees: z.number(),
  totalPerquisiteValuedRupees: z.number(),
  status: loanStatusSchema,
  source: z.string(),
  postingsCount: z.number(),
});

export const loansRouter = {
  /**
   * ESS: lists the calling user's own staff loans & advances.
   */
  myLoans: authed
    .route({
      method: 'GET',
      path: '/api/loans/my',
      summary: 'Get current user loans and advances',
    })
    .input(z.object({}))
    .output(z.array(loanSummarySchema))
    .handler(async ({ context }) => {
      const employeeId = requireEmployeeId(context.user);
      const service = new LoansService(context.db);
      return await service.getEmployeeLoans(employeeId);
    }),

  /**
   * Previews eligibility and amortization schedule before formal submission.
   */
  previewSchedule: authed
    .route({
      method: 'POST',
      path: '/api/loans/preview',
      summary: 'Calculate loan schedule and check eligibility',
    })
    .input(
      z.object({
        loanType: loanTypeSchema,
        principalRupees: z.number().positive(),
        annualInterestRate: z.number().min(0).default(0),
        tenureMonths: z.number().int().min(1).max(60),
      })
    )
    .output(
      z.object({
        eligible: z.boolean(),
        reasons: z.array(z.string()),
        monthlyGrossRupees: z.number(),
        projectedEmiRupees: z.number(),
        maxAllowedEmiRupees: z.number(),
        monthlyEmi: z.number(),
        totalInterest: z.number(),
        totalPayment: z.number(),
        schedule: z.array(
          z.object({
            installmentNumber: z.number(),
            principalPart: z.number(),
            interestPart: z.number(),
            totalEmi: z.number(),
            closingOutstanding: z.number(),
            perquisiteValue: z.number(),
          })
        ),
      })
    )
    .handler(async ({ input, context }) => {
      const employeeId = requireEmployeeId(context.user);
      const service = new LoansService(context.db);
      const res = await service.checkEligibility({
        employeeId,
        loanType: input.loanType,
        principalRupees: input.principalRupees,
        tenureMonths: input.tenureMonths,
        annualInterestRate: input.annualInterestRate,
      });

      return {
        eligible: res.eligible,
        reasons: res.reasons,
        monthlyGrossRupees: res.monthlyGrossRupees,
        projectedEmiRupees: res.projectedEmiRupees,
        maxAllowedEmiRupees: res.maxAllowedEmiRupees,
        monthlyEmi: Number(res.schedule.monthlyEmi) / 100,
        totalInterest: Number(res.schedule.totalInterest) / 100,
        totalPayment: Number(res.schedule.totalPayment) / 100,
        schedule: res.schedule.schedule.map((s) => ({
          installmentNumber: s.installmentNumber,
          principalPart: Number(s.principalPart) / 100,
          interestPart: Number(s.interestPart) / 100,
          totalEmi: Number(s.totalEmi) / 100,
          closingOutstanding: Number(s.closingOutstanding) / 100,
          perquisiteValue: Number(s.perquisiteValue) / 100,
        })),
      };
    }),

  /**
   * Applies for a staff loan.
   */
  apply: authed
    .route({
      method: 'POST',
      path: '/api/loans/apply',
      summary: 'Apply for a loan or salary advance',
    })
    .input(
      z.object({
        loanType: loanTypeSchema,
        principalRupees: z.number().positive(),
        annualInterestRate: z.number().min(0).default(0),
        tenureMonths: z.number().int().min(1).max(60),
        startMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .output(
      z.object({
        success: z.boolean(),
        loanId: z.number(),
        monthlyEmiRupees: z.number(),
      })
    )
    .handler(async ({ input, context }) => {
      const employeeId = requireEmployeeId(context.user);
      const service = new LoansService(context.db);
      const res = await service.applyLoan({
        employeeId,
        loanType: input.loanType,
        principalRupees: input.principalRupees,
        annualInterestRate: input.annualInterestRate,
        tenureMonths: input.tenureMonths,
        startMonth: input.startMonth,
      });

      return {
        success: true,
        loanId: res.loanId,
        monthlyEmiRupees: Number(res.schedule.monthlyEmi) / 100,
      };
    }),

  /**
   * Gets immutable ledger and full postings for a specific loan.
   */
  getLedger: authed
    .route({
      method: 'GET',
      path: '/api/loans/:id/ledger',
      summary: 'Get loan ledger with immutable recovery postings',
    })
    .input(z.object({ loanId: z.number() }))
    .output(
      loanSummarySchema.extend({
        postings: z.array(
          z.object({
            id: z.number(),
            runId: z.number(),
            principalPart: z.number(),
            interestPart: z.number(),
            perquisiteValue: z.number(),
            createdAt: z.string(),
          })
        ),
      })
    )
    .handler(async ({ input, context }) => {
      const service = new LoansService(context.db);
      const res = await service.getLoanLedger(input.loanId);
      return {
        ...res,
        postings: res.postings.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    }),

  /**
   * Admin: List all loans across the company.
   */
  listAll: withPermission('payroll.run.manage')
    .route({
      method: 'GET',
      path: '/api/loans/all',
      summary: 'List company loans and advances',
    })
    .input(
      z.object({
        status: loanStatusSchema.optional(),
        loanType: loanTypeSchema.optional(),
      })
    )
    .output(
      z.array(
        loanSummarySchema.extend({
          ecode: z.string(),
          employeeName: z.string(),
        })
      )
    )
    .handler(async ({ input, context }) => {
      const service = new LoansService(context.db);
      return await service.listAllLoans(input);
    }),

  /**
   * Admin: Import legacy SAP / greytHR opening loan balance.
   */
  importLegacy: withPermission('payroll.run.manage')
    .route({
      method: 'POST',
      path: '/api/loans/legacy-import',
      summary: 'Import legacy loan balance from SAP/greytHR',
    })
    .input(
      z.object({
        employeeId: z.number(),
        loanType: loanTypeSchema,
        originalPrincipalRupees: z.number().positive(),
        outstandingBalanceRupees: z.number().min(0),
        annualInterestRate: z.number().min(0),
        monthlyEmiRupees: z.number().positive(),
        remainingTenureMonths: z.number().int().min(1),
        startMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        sourceReference: z.string(),
      })
    )
    .output(z.object({ success: z.boolean(), loanId: z.number() }))
    .handler(async ({ input, context }) => {
      const service = new LoansService(context.db);
      const res = await service.importLegacyLoan(input);
      return { success: true, loanId: res.loanId };
    }),
};
