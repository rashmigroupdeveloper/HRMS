/**
 * Lifecycle surface, Stage-1.6 slice (LC-03/R24): the boarding/exit report on
 * demand + a manual trigger for the daily email. Full lifecycle (onboarding,
 * separations, F&F) lands in Phase 3.
 */
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { boardingExitExcel, boardingExitReport, sendBoardingExitEmail } from './boarding-exit.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const personShape = z.object({
  ecode: z.string(),
  name: z.string(),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  company: z.string(),
  reportingManager: z.string().nullable(),
  costCenter: z.string().nullable(),
  location: z.string().nullable(),
  date: z.string(),
});

const report = withPermission('reports.hr')
  .route({ method: 'GET', path: '/lifecycle/boarding-exit', summary: 'Joins & exits for a range (R24 / LC-03)' })
  .input(z.object({ from: isoDate, to: isoDate }))
  .output(
    z.object({
      from: z.string(),
      to: z.string(),
      joins: z.array(personShape),
      exits: z.array(personShape.extend({ exitReason: z.string().nullable() })),
    }),
  )
  .handler(({ input, context }) => boardingExitReport(context.db, input.from, input.to));

const send = withPermission('admin.integrations')
  .route({ method: 'POST', path: '/lifecycle/boarding-exit/send', summary: 'Send the daily boarding/exit email now (also runs 07:00 IST)' })
  .input(z.object({ date: isoDate }).optional())
  .output(z.object({ queued: z.number() }))
  .handler(async ({ input, context }) => ({ queued: await sendBoardingExitEmail(context.db, input?.date) }));

const excel = withPermission('reports.hr')
  .route({ method: 'GET', path: '/lifecycle/boarding-exit/excel', summary: 'Download the R24 boarding/exit workbook for a range' })
  .input(z.object({ from: isoDate, to: isoDate }))
  .output(z.object({ fileName: z.string(), mime: z.string(), base64: z.string() }))
  .handler(async ({ input, context }) => {
    const buffer = await boardingExitExcel(context.db, input.from, input.to);
    return {
      fileName: `boarding-exit-${input.from}_${input.to}.xlsx`,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: buffer.toString('base64'),
    };
  });

export const lifecycleRouter = { report, send, excel };
