/**
 * Salary Holds Router (PAY-08, CORE-10).
 */

import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import { employeeScopeSql } from '../../../core/rbac/employee-scope.js';
import { SalaryHoldsService } from './holds.service.js';

const SalaryHoldItemSchema = z.object({
  id: z.number().int().positive(),
  employee_id: z.number().int().positive(),
  hold_type: z.enum(['payment', 'process']),
  reason: z.string(),
  start_month: z.date().or(z.string()),
  released_month: z.date().or(z.string()).nullable(),
  created_by: z.number().int().positive(),
  created_at: z.date().or(z.string()),
});

export const salaryHoldsRouter = {
  employees: withPermission('payroll.run.view', 'read')
    .route({
      method: 'GET',
      path: '/payroll/holds/employees',
      summary: 'Find an employee for scoped salary hold controls',
    })
    .input(z.object({ ecode: z.string().trim().min(1).max(40) }))
    .output(z.array(z.object({ id: z.number(), ecode: z.string(), name: z.string() })))
    .handler(async ({ input, context }) => {
      const rows = await context.db
        .selectFrom('core.employees as e')
        .select(['e.id', 'e.ecode', 'e.first_name', 'e.last_name'])
        .where(
          employeeScopeSql(
            { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
            'e',
          ),
        )
        .where('e.ecode', 'ilike', `${input.ecode}%`)
        .orderBy('e.ecode')
        .limit(25)
        .execute();
      return rows.map((r) => ({
        id: r.id,
        ecode: r.ecode,
        name: [r.first_name, r.last_name].filter(Boolean).join(' '),
      }));
    }),
  list: withPermission('payroll.run.view', 'read')
    .input(
      z.object({
        employee_id: z.number().int().positive().optional(),
      }),
    )
    .output(z.array(SalaryHoldItemSchema))
    .handler(async ({ context, input }) => {
      const service = new SalaryHoldsService(context.db);
      return await service.listHolds(input.employee_id, {
        ...context.permissionAccess,
        actorEmployeeId: context.user.employee_id,
      });
    }),

  place: withPermission('payroll.run.manage')
    .input(
      z.object({
        employee_id: z.number().int().positive(),
        hold_type: z.enum(['payment', 'process']),
        reason: z.string().trim().min(3).max(2000),
        start_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/),
      }),
    )
    .output(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const service = new SalaryHoldsService(context.db);
      const id = await service.placeHold(
        {
          employeeId: input.employee_id,
          holdType: input.hold_type,
          reason: input.reason,
          startMonth: input.start_month,
          createdByUserId: context.user.id,
        },
        { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
      );
      return { id };
    }),

  release: withPermission('payroll.run.manage')
    .input(
      z.object({
        hold_id: z.number().int().positive(),
        released_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      const service = new SalaryHoldsService(context.db);
      await service.releaseHold(
        {
          holdId: input.hold_id,
          releasedMonth: input.released_month,
          actorUserId: context.user.id,
        },
        { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
      );
      return { success: true };
    }),
};
