/**
 * Salary Structure Router (PAY-01, SOW crosswalk).
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withAnyPermission, withPermission } from '../../../api/orpc.js';
import {
  listStructures,
  getStructure,
  createStructure,
  updateStructure,
  previewStructureBreakup,
} from './structure.service.js';

const salaryComponentItemSchema = z.object({
  component_code: z.string().min(1),
  formula_override: z.string().nullable().optional(),
  amount_rule: z.string().nullable().optional(),
});

const salaryStructureSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  company_id: z.number(),
  description: z.string().nullable(),
  components: z.array(salaryComponentItemSchema),
  is_active: z.boolean(),
  created_at: z.union([z.date(), z.string()]),
  updated_at: z.union([z.date(), z.string()]),
});

const createStructureInputSchema = z.object({
  name: z.string().min(2).max(128),
  company_id: z.number().int().positive(),
  description: z.string().nullable().optional(),
  components: z.array(salaryComponentItemSchema).min(1),
  is_active: z.boolean().default(true),
});

const updateStructureInputSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(2).max(128).optional(),
  company_id: z.number().int().positive().optional(),
  description: z.string().nullable().optional(),
  components: z.array(salaryComponentItemSchema).optional(),
  is_active: z.boolean().optional(),
});

const previewBreakupInputSchema = z.object({
  structure_id: z.number().int().positive().optional(),
  components: z.array(salaryComponentItemSchema).optional(),
  annual_ctc_rupees: z.number().positive(),
  probation_percent: z.number().min(10).max(100).optional(),
});

const structureBreakupOutputSchema = z.object({
  monthly: z.record(z.string(), z.number()),
  annual: z.record(z.string(), z.number()),
  monthlyGross: z.number(),
  annualGross: z.number(),
  monthlyEmployerCost: z.number(),
  annualEmployerCost: z.number(),
  monthlyCtc: z.number(),
  annualCtc: z.number(),
  monthlyDeductions: z.number(),
  monthlyNet: z.number(),
  evaluationOrder: z.array(z.string()),
  validation: z.object({
    valid: z.boolean(),
    diffPaise: z.number(),
    message: z.string().optional(),
  }),
});

const listStructuresProcedure = withAnyPermission('salary.write', 'payroll.run.view')
  .route({ method: 'GET', path: '/payroll/structures', summary: 'List salary structures' })
  .input(
    z
      .object({
        companyId: z.number().int().positive().optional(),
        activeOnly: z.boolean().optional(),
      })
      .optional(),
  )
  .output(z.array(salaryStructureSchema))
  .handler(async ({ input, context }) => {
    const options: { companyId?: number | undefined; activeOnly?: boolean | undefined } = {};
    if (input?.companyId !== undefined) options.companyId = input.companyId;
    if (input?.activeOnly !== undefined) options.activeOnly = input.activeOnly;
    return listStructures(context.db, options);
  });

const getStructureProcedure = withAnyPermission('salary.write', 'payroll.run.view')
  .route({ method: 'GET', path: '/payroll/structures/{id}', summary: 'Get a salary structure by id' })
  .input(z.object({ id: z.number().int().positive() }))
  .output(salaryStructureSchema)
  .handler(async ({ input, context }) => {
    const struct = await getStructure(context.db, input.id);
    if (!struct) {
      throw new ORPCError('NOT_FOUND', { message: `Salary structure #${input.id} not found` });
    }
    return struct;
  });

const createStructureProcedure = withPermission('salary.write')
  .route({ method: 'POST', path: '/payroll/structures', summary: 'Create a salary structure' })
  .input(createStructureInputSchema)
  .output(salaryStructureSchema)
  .handler(async ({ input, context }) => {
    return createStructure(context.db, input, context.user.id);
  });

const updateStructureProcedure = withPermission('salary.write')
  .route({ method: 'PUT', path: '/payroll/structures/{id}', summary: 'Update a salary structure' })
  .input(updateStructureInputSchema)
  .output(salaryStructureSchema)
  .handler(async ({ input, context }) => {
    return updateStructure(context.db, input.id, input, context.user.id);
  });

const previewBreakupProcedure = withPermission('salary.write', 'read')
  .route({ method: 'POST', path: '/payroll/structures/preview', summary: 'Simulate CTC component breakup' })
  .input(previewBreakupInputSchema)
  .output(structureBreakupOutputSchema)
  .handler(async ({ input, context }) => {
    return previewStructureBreakup(context.db, input);
  });

export const structureRouter = {
  list: listStructuresProcedure,
  get: getStructureProcedure,
  create: createStructureProcedure,
  update: updateStructureProcedure,
  previewBreakup: previewBreakupProcedure,
};
