/**
 * Boarding/exit report API (LC-03) — on-demand run + preview.
 */
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { runDailyBoardingExitReport } from './boarding.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const runReport = withPermission('reports.hr')
  .route({
    method: 'POST',
    path: '/boarding/run',
    summary: 'Run daily boarding/exit email for a date (default yesterday IST) — LC-03',
  })
  .input(z.object({ reportDate: isoDate.optional() }).optional())
  .output(
    z.object({
      reportDate: z.string(),
      joinCount: z.number(),
      exitCount: z.number(),
      notificationsQueued: z.number(),
      empty: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const result = await runDailyBoardingExitReport(context.db, input?.reportDate);
    return {
      reportDate: result.reportDate,
      joinCount: result.joins.length,
      exitCount: result.exits.length,
      notificationsQueued: result.notificationsQueued,
      empty: result.joins.length === 0 && result.exits.length === 0,
    };
  });

export const boardingRouter = { runReport };
