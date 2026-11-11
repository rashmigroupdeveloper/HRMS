/** LC-02, CORE-10: task owners never need HR employee-conversion authority. */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import { employeeScopeSql } from '../../../core/rbac/employee-scope.js';
import { getUserRoleCodes } from '../../../core/rbac/permissions.service.js';
import { formatDbDate } from '../../../core/dates.js';
import { TaskFanoutService, KentEnrollmentUnavailable } from './task-fanout.service.js';
export const stakeholderTasksRouter = {
  mine: withPermission('lifecycle.onboard.tasks', 'read')
    .route({
      method: 'GET',
      path: '/lifecycle/my-tasks',
      summary: 'Joining tasks assigned to my current stakeholder roles',
    })
    .input(z.object({}).optional())
    .output(
      z.object({
        tasks: z.array(
          z.object({
            id: z.number(),
            employeeId: z.number(),
            ecode: z.string(),
            employeeName: z.string(),
            taskCode: z.string(),
            taskName: z.string(),
            department: z.string(),
            ownerRole: z.string(),
            dueDate: z.string(),
            slaHours: z.number(),
            status: z.string(),
            notes: z.string().nullable(),
          }),
        ),
      }),
    )
    .handler(async ({ context }) => {
      const roles = [...(await getUserRoleCodes(context.db, context.user.id))];
      if (roles.length === 0) return { tasks: [] };
      const rows = await context.db
        .selectFrom('core.onboarding_tasks as t')
        .innerJoin('core.employees as e', 'e.id', 't.employee_id')
        .select([
          't.id',
          't.employee_id',
          'e.ecode',
          'e.first_name',
          'e.last_name',
          't.task_code',
          't.task_name',
          't.department',
          't.owner_role',
          't.due_date',
          't.sla_hours',
          't.status',
          't.notes',
        ])
        .where('t.owner_role', 'in', roles)
        .where(
          employeeScopeSql(
            { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
            'e',
          ),
        )
        .orderBy('t.due_date')
        .orderBy('t.id')
        .limit(500)
        .execute();
      return {
        tasks: rows.map((r) => ({
          id: r.id,
          employeeId: r.employee_id,
          ecode: r.ecode,
          employeeName: [r.first_name, r.last_name].filter(Boolean).join(' '),
          taskCode: r.task_code,
          taskName: r.task_name,
          department: r.department,
          ownerRole: r.owner_role,
          dueDate: formatDbDate(r.due_date),
          slaHours: r.sla_hours,
          status: r.status,
          notes: r.notes,
        })),
      };
    }),
  complete: withPermission('lifecycle.onboard.tasks')
    .route({
      method: 'POST',
      path: '/lifecycle/my-tasks/complete',
      summary: 'Complete a task owned by one of my current stakeholder roles',
    })
    .input(
      z.object({
        taskId: z.number().int().positive(),
        notes: z.string().trim().max(2000).optional(),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .handler(async ({ context, input }) => {
      const roles = [...(await getUserRoleCodes(context.db, context.user.id))];
      try {
        await TaskFanoutService.completeTask(
          context.db,
          input.taskId,
          context.user.id,
          input.notes,
          { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
          roles,
        );
      } catch (error) {
        if (error instanceof KentEnrollmentUnavailable)
          throw new ORPCError('SERVICE_UNAVAILABLE', { message: error.message });
        throw error;
      }
      return { success: true };
    }),
};
