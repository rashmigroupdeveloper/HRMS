/**
 * Absence-case API (ATT-10/11). Central gates:
 *   case queue read      → attendance.team.read
 *   stage + letter (HR)  → letters.issue
 *   manual scan trigger  → admin.integrations
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { formatDbDate } from '../../core/dates.js';
import { issueAbsenceCaseLetter, listAbsenceCases, runAbsenceScan, setAbsenceCaseStage } from './absence.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

const cases = withPermission('attendance.team.read')
  .route({ method: 'GET', path: '/attendance/absence-cases', summary: 'Absence-case queue (ATT-10)' })
  .input(z.object({ open: z.coerce.boolean().default(true) }).optional())
  .output(
    z.array(
      z.object({
        id: z.number(),
        employeeId: z.number(),
        ecode: z.string(),
        name: z.string(),
        startDate: z.string(),
        daysAbsent: z.number(),
        stage: z.string(),
        letterId: z.number().nullable(),
        resolution: z.string().nullable(),
        closedAt: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const rows = await listAbsenceCases(context.db, input?.open ?? true);
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      ecode: r.ecode,
      name: r.last_name ? `${r.first_name} ${r.last_name}` : r.first_name,
      startDate: formatDbDate(r.start_date),
      daysAbsent: r.days_absent,
      stage: r.stage,
      letterId: r.letter_id,
      resolution: r.resolution,
      closedAt: r.closed_at?.toISOString() ?? null,
    }));
  });

const escalate = withPermission('letters.issue')
  .route({ method: 'POST', path: '/attendance/absence-cases/{id}/stage', summary: 'HR escalates a case — forward-only, audited (PP-7)' })
  .input(z.object({ id: z.coerce.number().int().positive(), stage: z.enum(['warning', 'termination_review']) }))
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      await setAbsenceCaseStage(context.db, { caseId: input.id, stage: input.stage, actorUserId: context.user.id });
      return { ok: true as const };
    } catch (err) {
      asBadRequest(err);
    }
  });

const issueCaseLetter = withPermission('letters.issue')
  .route({ method: 'POST', path: '/attendance/absence-cases/{id}/letter', summary: 'Issue the show-cause/warning letter from the case (CORE-09)' })
  .input(
    z.object({
      id: z.coerce.number().int().positive(),
      template: z.enum(['show_cause', 'warning']),
      responseDays: z.number().int().positive().optional(),
    }),
  )
  .output(z.object({ letterId: z.number(), workflowRequestId: z.number().nullable() }))
  .handler(async ({ input, context }) => {
    try {
      return await issueAbsenceCaseLetter(context.db, {
        caseId: input.id,
        templateCode: input.template,
        actorUserId: context.user.id,
        responseDays: input.responseDays,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const scan = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/attendance/absence-cases/scan', summary: 'Run the daily absence scan now (also runs 06:00 IST)' })
  .input(z.object({ date: isoDate }).optional())
  .output(z.object({ absentees: z.number(), casesOpened: z.number(), casesEscalated: z.number(), casesClosed: z.number() }))
  .handler(({ input, context }) => runAbsenceScan(context.db, input?.date));

export const absenceRouter = { cases, escalate, issueCaseLetter, scan };
