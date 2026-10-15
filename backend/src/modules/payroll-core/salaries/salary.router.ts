/**
 * Employee Salary Router (PAY-02, PAY-07, PAY-16).
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import {
  assignSalary,
  getEffectiveSalary,
  getSalaryRevisionHistory,
  autoSwitchConfirmation,
} from './salary.service.js';

const assignSalaryInputSchema = z.object({
  employee_id: z.number().int().positive(),
  structure_id: z.number().int().positive(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required'),
  annual_ctc_rupees: z.number().positive(),
  phase: z.enum(['probation', 'confirmed']).optional(),
  probation_percent: z.number().min(10).max(100).nullable().optional(),
  revision_reason: z.enum([
    'joining',
    'annual_increment',
    'promotion',
    'confirmation',
    'correction',
    'probation_start',
  ]),
});

const effectiveSalaryOutputSchema = z.object({
  salary: z
    .object({
      id: z.number(),
      employee_id: z.number(),
      structure_id: z.number(),
      effective_from: z.union([z.string(), z.date()]),
      effective_to: z.union([z.string(), z.date()]),
      annual_ctc: z.string(),
      phase: z.string(),
      probation_percent: z.string().nullable(),
      revision_reason: z.string().nullable(),
    })
    .nullable(),
  structure: z
    .object({
      id: z.number(),
      name: z.string(),
    })
    .nullable(),
  componentsInRupees: z.record(z.string(), z.number()),
  annualCtcRupees: z.number(),
});

const salaryRevisionDiffSchema = z.object({
  id: z.number(),
  structure_id: z.number(),
  structure_name: z.string().optional(),
  effective_from: z.string(),
  effective_to: z.string(),
  annual_ctc_rupees: z.number(),
  phase: z.enum(['probation', 'confirmed']),
  probation_percent: z.number().nullable(),
  revision_reason: z
    .enum([
      'joining',
      'annual_increment',
      'promotion',
      'confirmation',
      'correction',
      'probation_start',
    ])
    .nullable(),
  monthly_components: z.record(z.string(), z.number()),
  previous_annual_ctc_rupees: z.number().optional(),
  ctc_change_percent: z.number().optional(),
  ctc_delta_rupees: z.number().optional(),
  retro_months_affected: z.array(z.string()),
});

const getEffectiveSalaryProcedure = withPermission('employee.compensation.read')
  .route({ method: 'GET', path: '/payroll/salaries/effective/{employee_id}', summary: 'Get current effective salary for an employee' })
  .input(z.object({ employee_id: z.number().int().positive(), as_of_date: z.string().optional() }))
  .output(effectiveSalaryOutputSchema)
  .handler(async ({ input, context }) => {
    if (context.permissionAccess.own && !context.permissionAccess.all && context.user.employee_id !== input.employee_id) {
      throw new ORPCError('FORBIDDEN', { message: 'Can only view your own compensation details' });
    }
    const res = await getEffectiveSalary(context.db, input.employee_id, input.as_of_date ?? undefined);
    return {
      salary: res.salary
        ? {
            id: res.salary.id,
            employee_id: res.salary.employee_id,
            structure_id: res.salary.structure_id,
            effective_from: typeof res.salary.effective_from === 'string' ? res.salary.effective_from : res.salary.effective_from.toISOString().slice(0, 10),
            effective_to: typeof res.salary.effective_to === 'string' ? res.salary.effective_to : res.salary.effective_to.toISOString().slice(0, 10),
            annual_ctc: res.salary.annual_ctc,
            phase: res.salary.phase,
            probation_percent: res.salary.probation_percent,
            revision_reason: res.salary.revision_reason,
          }
        : null,
      structure: res.structure,
      componentsInRupees: res.componentsInRupees,
      annualCtcRupees: res.annualCtcRupees,
    };
  });

const getSalaryHistoryProcedure = withPermission('employee.compensation.read')
  .route({ method: 'GET', path: '/payroll/salaries/history/{employee_id}', summary: 'Get salary revision history and retro preview' })
  .input(z.object({ employee_id: z.number().int().positive() }))
  .output(z.array(salaryRevisionDiffSchema))
  .handler(async ({ input, context }) => {
    if (context.permissionAccess.own && !context.permissionAccess.all && context.user.employee_id !== input.employee_id) {
      throw new ORPCError('FORBIDDEN', { message: 'Can only view your own compensation history' });
    }
    return getSalaryRevisionHistory(context.db, input.employee_id);
  });

const assignSalaryProcedure = withPermission('salary.write')
  .route({ method: 'POST', path: '/payroll/salaries/assign', summary: 'Assign a new salary structure or revision' })
  .input(assignSalaryInputSchema)
  .output(
    z.object({
      id: z.number(),
      employee_id: z.number(),
      structure_id: z.number(),
      effective_from: z.union([z.string(), z.date()]),
      annual_ctc: z.string(),
      phase: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const row = await assignSalary(
      context.db,
      {
        employee_id: input.employee_id,
        structure_id: input.structure_id,
        effective_from: input.effective_from,
        annual_ctc_rupees: input.annual_ctc_rupees,
        phase: input.phase,
        probation_percent: input.probation_percent ?? undefined,
        revision_reason: input.revision_reason,
      },
      context.user.id,
    );
    return {
      id: row.id,
      employee_id: row.employee_id,
      structure_id: row.structure_id,
      effective_from: typeof row.effective_from === 'string' ? row.effective_from : row.effective_from.toISOString().slice(0, 10),
      annual_ctc: row.annual_ctc,
      phase: row.phase,
    };
  });

const autoSwitchConfirmationProcedure = withPermission('salary.write')
  .route({ method: 'POST', path: '/payroll/salaries/auto-switch-confirmation', summary: 'Auto-switch probation salary to confirmed' })
  .input(
    z.object({
      employee_id: z.number().int().positive(),
      confirmation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required'),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      revision_id: z.number().nullable(),
      message: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const switched = await autoSwitchConfirmation(
      context.db,
      input.employee_id,
      input.confirmation_date,
      context.user.id,
    );
    if (!switched) {
      return {
        success: false,
        revision_id: null,
        message: 'Employee is not in probation or already has confirmed salary',
      };
    }
    return {
      success: true,
      revision_id: switched.id,
      message: 'Successfully auto-switched salary to confirmed phase at 100%',
    };
  });

export const salaryRouter = {
  getEffective: getEffectiveSalaryProcedure,
  getHistory: getSalaryHistoryProcedure,
  assign: assignSalaryProcedure,
  autoSwitchConfirmation: autoSwitchConfirmationProcedure,
};
