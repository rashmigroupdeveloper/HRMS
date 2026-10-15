/**
 * Salary Component Router (PAY-01, SOW crosswalk).
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { authed, withPermission } from '../../../api/orpc.js';
import {
  salaryComponentSchema,
  updateComponentInputSchema,
} from './definitions.js';
import {
  listComponents,
  getComponent,
  createComponent,
  updateComponent,
} from './component.service.js';

const listComponentsProcedure = authed
  .route({ method: 'GET', path: '/payroll/components', summary: 'List salary components' })
  .input(z.object({ activeOnly: z.boolean().optional() }).optional())
  .output(z.array(salaryComponentSchema))
  .handler(async ({ input, context }) => {
    const options: { activeOnly?: boolean | undefined } = {};
    if (input?.activeOnly !== undefined) options.activeOnly = input.activeOnly;
    return listComponents(context.db, options);
  });

const getComponentProcedure = authed
  .route({ method: 'GET', path: '/payroll/components/{code}', summary: 'Get a salary component by code' })
  .input(z.object({ code: z.string().min(1) }))
  .output(salaryComponentSchema)
  .handler(async ({ input, context }) => {
    const comp = await getComponent(context.db, input.code);
    if (!comp) {
      throw new ORPCError('NOT_FOUND', { message: `Component '${input.code}' not found` });
    }
    return comp;
  });

const createComponentProcedure = withPermission('salary.write')
  .route({ method: 'POST', path: '/payroll/components', summary: 'Create a new salary component' })
  .input(salaryComponentSchema)
  .output(salaryComponentSchema)
  .handler(async ({ input, context }) => {
    return createComponent(context.db, input, context.user.id);
  });

const updateComponentProcedure = withPermission('salary.write')
  .route({ method: 'PUT', path: '/payroll/components/{code}', summary: 'Update an existing salary component' })
  .input(updateComponentInputSchema)
  .output(salaryComponentSchema)
  .handler(async ({ input, context }) => {
    return updateComponent(context.db, input, context.user.id);
  });

export const componentRouter = {
  list: listComponentsProcedure,
  get: getComponentProcedure,
  create: createComponentProcedure,
  update: updateComponentProcedure,
};
