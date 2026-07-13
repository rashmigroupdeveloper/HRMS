import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { employeeMergeFields, issueLetter, listEmployeeLetters } from './letters.service.js';

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

const issue = withPermission('letters.issue')
  .route({ method: 'POST', path: '/letters/issue', summary: 'Issue a letter from a template (CORE-09)' })
  .input(
    z.object({
      employeeId: z.number().int().positive(),
      templateCode: z.string().min(1),
      fields: z.record(z.string()).default({}),
    }),
  )
  .output(z.object({ id: z.number(), bodyRendered: z.string() }))
  .handler(async ({ input, context }) => {
    try {
      const base = await employeeMergeFields(context.db, input.employeeId);
      return await issueLetter(context.db, {
        employeeId: input.employeeId,
        templateCode: input.templateCode,
        fields: { ...base, ...input.fields },
        actorUserId: context.user.id,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const listMine = withPermission('attendance.own')
  .route({ method: 'GET', path: '/letters/mine', summary: 'My issued letters (ESS)' })
  .output(
    z.array(
      z.object({
        id: z.number(),
        templateCode: z.string(),
        issuedAt: z.string().nullable(),
        status: z.string(),
      }),
    ),
  )
  .handler(async ({ context }) => {
    if (context.user.employee_id === null) {
      throw new ORPCError('BAD_REQUEST', { message: 'No employee profile linked' });
    }
    const rows = await listEmployeeLetters(context.db, context.user.employee_id);
    return rows.map((r) => ({
      id: r.id,
      templateCode: r.template_code,
      issuedAt: r.issued_at ? r.issued_at.toISOString() : null,
      status: r.status,
    }));
  });

const listForEmployee = withPermission('letters.issue')
  .route({ method: 'GET', path: '/letters/employee/{employeeId}', summary: 'Letters for an employee (HR)' })
  .input(z.object({ employeeId: z.coerce.number().int().positive() }))
  .output(
    z.array(
      z.object({
        id: z.number(),
        templateCode: z.string(),
        issuedAt: z.string().nullable(),
        status: z.string(),
        bodyPreview: z.string(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const rows = await listEmployeeLetters(context.db, input.employeeId);
    return rows.map((r) => ({
      id: r.id,
      templateCode: r.template_code,
      issuedAt: r.issued_at ? r.issued_at.toISOString() : null,
      status: r.status,
      bodyPreview: r.body_rendered.slice(0, 200),
    }));
  });

export const lettersRouter = { issue, listMine, listForEmployee };
