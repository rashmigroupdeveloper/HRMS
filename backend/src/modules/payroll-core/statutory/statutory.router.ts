/**
 * Statutory Compliance oRPC Router (PAY-09..14, Card P03).
 *
 * Exposes procedures for statutory preview, ECR generation, ESIC returns,
 * PTRC registers, LWF Form D, IT TDS projection, and Chapter VI-A declarations.
 */

import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import { paise } from '../../../core/money/money.js';
import { computePf, generateEcrExport } from './pf.js';
import { computeEsic, isEsicEligibleAtPeriodStart, generateEsicMonthlyReturn } from './esic.js';
import { computePt, generatePtrcRegister } from './pt.js';
import { computeLwf, generateFormDStatement } from './lwf.js';
import { generateItStatementLines } from './tds.js';
import { isApprentice, computeApprenticeDeductions } from './apprentice.js';
import { TaxDeclarationService } from '../tax-declaration/declaration.service.js';

export const statutoryRouter = {
  /**
   * Compute real-time statutory deductions estimate for an employee gross wage.
   */
    estimate: withPermission('payroll.run.view', 'read')
      .input(
        z.object({
          basicPaise: z.number().int().nonnegative(),
          grossPaise: z.number().int().nonnegative(),
          category: z.string().default('staff'),
          contractType: z.string().default('regular'),
          stateCode: z.string().default('WB'),
          regime: z.enum(['new', 'old']).default('new'),
          month: z.number().int().min(1).max(12).default(1),
          pfWageBaseMode: z.enum(['ACTUAL', 'CEILING_15000']).default('ACTUAL'),
          epsEligible: z.boolean().default(true),
          internationalWorker: z.boolean().default(false),
        })
      )
      .output(
        z.object({
          isApprentice: z.boolean(),
          pfEePaise: z.number().int(),
          erEpsPaise: z.number().int(),
          erEpfPaise: z.number().int(),
          edliPaise: z.number().int(),
          adminPaise: z.number().int(),
          esicEePaise: z.number().int(),
          esicErPaise: z.number().int(),
          ptPaise: z.number().int(),
          lwfEePaise: z.number().int(),
          lwfErPaise: z.number().int(),
          totalStatutoryDeductionsPaise: z.number().int(),
        })
      )
      .handler(({ input }) => {
        if (isApprentice(input.category, input.contractType)) {
          const appr = computeApprenticeDeductions({
            stipendPaise: paise(input.grossPaise),
            state: input.stateCode,
          });
          return {
            isApprentice: true,
            pfEePaise: appr.pfEePaise,
            erEpsPaise: 0,
            erEpfPaise: 0,
            edliPaise: 0,
            adminPaise: 0,
            esicEePaise: 0,
            esicErPaise: 0,
            ptPaise: appr.ptPaise,
            lwfEePaise: 0,
            lwfErPaise: 0,
            totalStatutoryDeductionsPaise: appr.ptPaise,
          };
        }

        const pf = computePf({
          pfWagesPaise: paise(input.basicPaise),
          wageBaseMode: input.pfWageBaseMode,
          epsEligible: input.epsEligible,
          internationalWorker: input.internationalWorker,
        });

        const isEsicEligible = isEsicEligibleAtPeriodStart(paise(input.grossPaise));
        const esic = computeEsic(paise(input.grossPaise), isEsicEligible);
        const pt = computePt(paise(input.grossPaise), input.stateCode);
        const lwf = computeLwf(input.month, input.stateCode);

        const totalDeductions = pf.eePfPaise + esic.eeEsicPaise + pt + lwf.eeLwfPaise;

        return {
          isApprentice: false,
          pfEePaise: pf.eePfPaise,
          erEpsPaise: pf.erEpsPaise,
          erEpfPaise: pf.erEpfPaise,
          edliPaise: pf.edliPaise,
          adminPaise: pf.adminPaise,
          esicEePaise: esic.eeEsicPaise,
          esicErPaise: esic.erEsicPaise,
          ptPaise: pt,
          lwfEePaise: lwf.eeLwfPaise,
          lwfErPaise: lwf.erLwfPaise,
          totalStatutoryDeductionsPaise: totalDeductions,
        };
      }),

    /**
     * Generate EPFO Unified Portal ECR file text.
     */
    generateEcr: withPermission('payroll.reports', 'read')
      .input(
        z.object({
          records: z.array(
            z.object({
              uan: z.string(),
              memberName: z.string(),
              grossWagesPaise: z.number().int(),
              epfWagesPaise: z.number().int(),
              epsWagesPaise: z.number().int(),
              edliWagesPaise: z.number().int(),
              eeSharePaise: z.number().int(),
              erEpsPaise: z.number().int(),
              erEpfPaise: z.number().int(),
              ncpDays: z.number().int().default(0),
              refundOfAdvancesPaise: z.number().int().optional(),
            })
          ),
        })
      )
      .output(
        z.object({
          content: z.string(),
          totalRecords: z.number().int(),
        })
      )
      .handler(({ input }) => {
        const mapped = input.records.map((r) => ({
          ...r,
          grossWagesPaise: paise(r.grossWagesPaise),
          epfWagesPaise: paise(r.epfWagesPaise),
          epsWagesPaise: paise(r.epsWagesPaise),
          edliWagesPaise: paise(r.edliWagesPaise),
          eeSharePaise: paise(r.eeSharePaise),
          erEpsPaise: paise(r.erEpsPaise),
          erEpfPaise: paise(r.erEpfPaise),
          refundOfAdvancesPaise: r.refundOfAdvancesPaise ? paise(r.refundOfAdvancesPaise) : undefined,
        }));
        const content = generateEcrExport(mapped);
        return {
          content,
          totalRecords: input.records.length,
        };
      }),

    /**
     * Generate ESIC Monthly Return CSV.
     */
    generateEsicReturn: withPermission('payroll.reports', 'read')
      .input(
        z.object({
          records: z.array(
            z.object({
              ipNumber: z.string(),
              ipName: z.string(),
              daysWorked: z.number().int(),
              totalMonthlyWagesPaise: z.number().int(),
              eeContributionPaise: z.number().int(),
              reasonForZeroDays: z.string().optional(),
            })
          ),
        })
      )
      .output(
        z.object({
          csvContent: z.string(),
          totalRecords: z.number().int(),
        })
      )
      .handler(({ input }) => {
        const mapped = input.records.map((r) => ({
          ...r,
          totalMonthlyWagesPaise: paise(r.totalMonthlyWagesPaise),
          eeContributionPaise: paise(r.eeContributionPaise),
        }));
        const csvContent = generateEsicMonthlyReturn(mapped);
        return {
          csvContent,
          totalRecords: input.records.length,
        };
      }),

    /**
     * Generate West Bengal Professional Tax Return Register (PTRC).
     */
    generatePtrc: withPermission('payroll.reports', 'read')
      .input(
        z.object({
          stateCode: z.string().default('WB'),
          month: z.string(),
          records: z.array(
            z.object({
              employeeId: z.number().int(),
              name: z.string(),
              grossPaise: z.number().int(),
              ptPaise: z.number().int(),
            })
          ),
        })
      )
      .output(
        z.object({
          stateCode: z.string(),
          month: z.string(),
          totalEmployees: z.number().int(),
          totalPtPaise: z.number().int(),
        })
      )
      .handler(({ input }) => {
        const mapped = input.records.map((r) => ({
          ...r,
          grossPaise: paise(r.grossPaise),
          ptPaise: paise(r.ptPaise),
        }));
        const register = generatePtrcRegister(input.stateCode, input.month, mapped);
        return {
          stateCode: register.stateCode,
          month: register.month,
          totalEmployees: register.totalEmployees,
          totalPtPaise: register.totalPtPaise,
        };
      }),

    /**
     * Generate Labour Welfare Fund Form D statement.
     */
    generateFormD: withPermission('payroll.reports', 'read')
      .input(
        z.object({
          stateCode: z.string().default('WB'),
          year: z.number().int(),
          period: z.enum(['H1', 'H2']),
          records: z.array(
            z.object({
              employeeId: z.number().int(),
              name: z.string(),
              eeLwfPaise: z.number().int(),
              erLwfPaise: z.number().int(),
            })
          ),
        })
      )
      .output(
        z.object({
          stateCode: z.string(),
          year: z.number().int(),
          period: z.enum(['H1', 'H2']),
          totalEmployees: z.number().int(),
          totalEeSharePaise: z.number().int(),
          totalErSharePaise: z.number().int(),
          totalRemittancePaise: z.number().int(),
        })
      )
      .handler(({ input }) => {
        const mapped = input.records.map((r) => ({
          ...r,
          eeLwfPaise: paise(r.eeLwfPaise),
          erLwfPaise: paise(r.erLwfPaise),
        }));
        const stmt = generateFormDStatement(input.stateCode, input.year, input.period, mapped);
        return {
          stateCode: stmt.stateCode,
          year: stmt.year,
          period: stmt.period,
          totalEmployees: stmt.totalEmployees,
          totalEeSharePaise: stmt.totalEeSharePaise,
          totalErSharePaise: stmt.totalErSharePaise,
          totalRemittancePaise: stmt.totalRemittancePaise,
        };
      }),

    /**
     * Compute full Income Tax statement lines A through R for ESS/Admin.
     */
    projectTds: withPermission('payroll.run.view', 'read')
      .input(
        z.object({
          grossSalaryPaise: z.number().int(),
          regime: z.enum(['new', 'old']).default('new'),
          chapterViADeductionsPaise: z.number().int().default(0),
          ytdTaxPaidPaise: z.number().int().default(0),
          remainingMonths: z.number().int().min(1).max(12).default(12),
        })
      )
      .output(
        z.object({
          annualTaxPaise: z.number().int(),
          balancePayablePaise: z.number().int(),
          monthlyTdsPaise: z.number().int(),
          taxableIncomePaise: z.number().int(),
        })
      )
      .handler(({ input }) => {
        const stmt = generateItStatementLines({
          grossSalaryPaise: paise(input.grossSalaryPaise),
          regime: input.regime,
          chapterViADeductionsPaise: paise(input.chapterViADeductionsPaise),
          ytdTaxPaidPaise: paise(input.ytdTaxPaidPaise),
          remainingMonths: input.remainingMonths,
        });

        return {
          annualTaxPaise: stmt.lineO_AnnualTax,
          balancePayablePaise: stmt.lineQ_BalancePayable,
          monthlyTdsPaise: stmt.lineR_TdsCurrentMonth,
          taxableIncomePaise: stmt.lineN_TaxableIncome,
        };
      }),

    /**
     * List employee Chapter VI-A investment declarations for a FY.
     */
    listDeclarations: withPermission('payroll.run.view', 'read')
      .input(
        z.object({
          employeeId: z.number().int(),
          financialYear: z.string(),
        })
      )
      .output(
        z.array(
          z.object({
            id: z.number().int(),
            employeeId: z.number().int(),
            financialYear: z.string(),
            section: z.string(),
            declaredAmountPaise: z.number().int(),
            verifiedAmountPaise: z.number().int().nullable(),
            proofDocumentId: z.number().int().nullable(),
            verifiedBy: z.number().int().nullable(),
            verifiedAt: z.date().nullable(),
            createdAt: z.date(),
          })
        )
      )
      .handler(async ({ context, input }) => {
        const declarationService = new TaxDeclarationService(context.db);
        return declarationService.listEmployeeDeclarations(input.employeeId, input.financialYear);
      }),

    /**
     * Submit an investment declaration for an employee.
     */
    declareInvestment: withPermission('payroll.run.manage')
      .input(
        z.object({
          employeeId: z.number().int(),
          financialYear: z.string(),
          section: z.string(),
          declaredAmountPaise: z.number().int().nonnegative(),
          proofDocumentId: z.number().int().nullable().optional(),
        })
      )
      .output(
        z.object({
          id: z.number().int(),
          employeeId: z.number().int(),
          section: z.string(),
          declaredAmountPaise: z.number().int(),
        })
      )
      .handler(async ({ context, input }) => {
        const declarationService = new TaxDeclarationService(context.db);
        const res = await declarationService.declareInvestment({
          employeeId: input.employeeId,
          financialYear: input.financialYear,
          section: input.section,
          declaredAmountPaise: paise(input.declaredAmountPaise),
          proofDocumentId: input.proofDocumentId,
        });
        return {
          id: res.id,
          employeeId: res.employeeId,
          section: res.section,
          declaredAmountPaise: res.declaredAmountPaise,
        };
      }),

    /**
     * Verify an investment declaration with payroll admin authorization.
     */
    verifyDeclaration: withPermission('payroll.run.manage')
      .input(
        z.object({
          declarationId: z.number().int(),
          verifiedAmountPaise: z.number().int().nonnegative(),
        })
      )
      .output(
        z.object({
          id: z.number().int(),
          verifiedAmountPaise: z.number().int(),
          verifiedBy: z.number().int().nullable(),
        })
      )
      .handler(async ({ input, context }) => {
        const declarationService = new TaxDeclarationService(context.db);
        const res = await declarationService.verifyDeclaration({
          declarationId: input.declarationId,
          verifiedAmountPaise: paise(input.verifiedAmountPaise),
          verifiedByUserId: context.user.id,
        });
        return {
          id: res.id,
          verifiedAmountPaise: res.verifiedAmountPaise ?? 0,
          verifiedBy: res.verifiedBy,
        };
      }),
};
