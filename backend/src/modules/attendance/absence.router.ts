/**
 * Absence cases API (ATT-10) — HR list + show-cause letter + close.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { formatDbDate } from '../../core/dates.js';
import {
  closeAbsenceCase,
  issueShowCauseLetter,
  listOpenAbsenceCases,
  runAbsenteeScan,
} from './absence.service.js';

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

const caseShape = z.object({
  id: z.number(),
  employeeId: z.number(),
  startDate: z.string(),
  daysAbsent: z.number(),
  stage: z.string(),
  letterId: z.number().nullable(),
  resolution: z.string().nullable(),
});

const listOpen = withPermission('reports.hr')
  .route({ method: 'GET', path: '/attendance/absence-cases', summary: 'Open absence cases (ATT-10)' })
  .output(z.array(caseShape))
  .handler(async ({ context }) => {
    const rows = await listOpenAbsenceCases(context.db);
    return rows.map((c) => ({
      id: c.id,
      employeeId: c.employee_id,
      startDate: formatDbDate(c.start_date),
      daysAbsent: c.days_absent,
      stage: c.stage,
      letterId: c.letter_id,
      resolution: c.resolution,
    }));
  });

const issueLetter = withPermission('letters.issue')
  .route({
    method: 'POST',
    path: '/attendance/absence-cases/{caseId}/show-cause',
    summary: 'Issue show-cause letter and link to case',
  })
  .input(z.object({ caseId: z.coerce.number().int().positive() }))
  .output(z.object({ letterId: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      return await issueShowCauseLetter(context.db, {
        caseId: input.caseId,
        actorUserId: context.user.id,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const close = withPermission('reports.hr')
  .route({ method: 'POST', path: '/attendance/absence-cases/{caseId}/close', summary: 'Close an absence case' })
  .input(
    z.object({
      caseId: z.coerce.number().int().positive(),
      resolution: z.enum(['returned', 'regularized', 'exited']),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    await closeAbsenceCase(context.db, {
      caseId: input.caseId,
      resolution: input.resolution,
      actorUserId: context.user.id,
    });
    return { ok: true as const };
  });

const scan = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/attendance/absence-scan', summary: 'Run absentee scan now (also daily 06:00 IST)' })
  .input(z.object({ asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
  .output(
    z.object({
      uabAlerts: z.number(),
      casesOpened: z.number(),
      casesEscalated: z.number(),
      casesClosedReturned: z.number(),
    }),
  )
  .handler(async ({ input, context }) => runAbsenteeScan(context.db, input?.asOf));

export const absenceRouter = { listOpen, issueLetter, close, scan };
