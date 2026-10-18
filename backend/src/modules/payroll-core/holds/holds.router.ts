/**
 * Salary Holds Router (PAY-08, CORE-10).
 */

import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import { SalaryHoldsService } from './holds.service.js';

const SalaryHoldItemSchema = z.object({
  id: z.number(),
  employee_id: z.number(),
  hold_type: z.enum(['payment', 'process']),
  reason: z.string(),
  start_month: z.date().or(z.string()),
  released_month: z.date().or(z.string()).nullable(),
  created_by: z.number(),
  created_at: z.date().or(z.string()),
});

export const salaryHoldsRouter = {
  list: withPermission('payroll.run.view', 'read')
    .input(
      z.object({
        employee_id: z.number().optional(),
      })
    )
    .output(z.array(SalaryHoldItemSchema))
    .handler(async ({ context, input }) => {
      const service = new SalaryHoldsService(context.db);
      return await service.listHolds(input.employee_id);
    }),

  place: withPermission('payroll.run.manage')
    .input(
      z.object({
        employee_id: z.number(),
        hold_type: z.enum(['payment', 'process']),
        reason: z.string().min(3),
        start_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .output(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const service = new SalaryHoldsService(context.db);
      const id = await service.placeHold({
        employeeId: input.employee_id,
        holdType: input.hold_type,
        reason: input.reason,
        startMonth: input.start_month,
        createdByUserId: context.user.id,
      });
      return { id };
    }),

  release: withPermission('payroll.run.manage')
    .input(
      z.object({
        hold_id: z.number(),
        released_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      const service = new SalaryHoldsService(context.db);
      await service.releaseHold({
        holdId: input.hold_id,
        releasedMonth: input.released_month,
        actorUserId: context.user.id,
      });
      return { success: true };
    }),
};
