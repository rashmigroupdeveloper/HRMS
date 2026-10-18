/**
 * /bulk — one API for every CSV/Excel import:
 *   GET  /bulk/importers                         importers the caller may use
 *   GET  /bulk/{importer}/template               .xlsx template (data validations + instructions)
 *   POST /bulk/{importer}/preview                upload → row-level validation report (nothing saved)
 *   GET  /bulk/{importer}/jobs                   recent uploads
 *   GET  /bulk/{importer}/jobs/{jobId}           status / progress / report
 *   GET  /bulk/{importer}/jobs/{jobId}/report    validation report as .xlsx
 *   POST /bulk/{importer}/jobs/{jobId}/commit    all-or-nothing apply (background for large files)
 *   POST /bulk/{importer}/jobs/{jobId}/discard
 * The permission is the importer's own (e.g. payroll.run.manage), checked
 * per call with its data scope, exactly like withPermission.
 */
import { z } from 'zod';
import { authed } from '../../api/orpc.js';
import { buildTemplate, columnsFor, commitImport, discardJob, getJob, jobReport, listJobs, previewImport, type BulkImporter, type ImportActor } from '../../core/bulk/index.js';
import { ForbiddenError, NotFoundError } from '../../core/errors/index.js';
import { getUserPermissionAccess, getUserPermissions } from '../../core/rbac/permissions.service.js';
import { IMPORTERS, findImporter } from './registry.js';

const importerParam = z.object({ importer: z.string().regex(/^[a-z0-9-]{2,40}$/) });
const jobParam = importerParam.extend({ jobId: z.coerce.number().int().positive() });
const fileOut = z.object({ filename: z.string(), base64: z.string() });
const jobOut = z.object({
  jobId: z.number(), importer: z.string(), filename: z.string(), status: z.string(), sheet: z.string().nullable(), layout: z.string().nullable(),
  totalRows: z.number(), validRows: z.number(), errorRows: z.number(), warningRows: z.number(), processedRows: z.number(),
  fileIssues: z.array(z.string()), duplicateOfJobId: z.number().nullable(),
  issues: z.array(z.object({ rowNumber: z.number(), column: z.string().nullable(), severity: z.enum(['error', 'warning']), message: z.string() })),
  preview: z.array(z.object({ rowNumber: z.number(), values: z.record(z.string(), z.unknown()), status: z.enum(['ok', 'warning', 'error']) })),
  result: z.object({ created: z.number(), updated: z.number(), skipped: z.number(), notes: z.array(z.string()).optional() }).nullable(),
  error: z.string().nullable(), createdAt: z.string(), committedAt: z.string().nullable(),
});

interface Ctx { db: Parameters<typeof getUserPermissions>[0]; user: { id: number; employee_id: number | null }; req: { ip?: string | undefined } }

async function actorFor(context: Ctx, importerKey: string): Promise<{ importer: BulkImporter<unknown>; actor: ImportActor }> {
  const importer = findImporter(importerKey);
  if (!importer) throw new NotFoundError(`No bulk import called "${importerKey}"`);
  const held = await getUserPermissions(context.db, context.user.id, 'write');
  const access = held.has(importer.permission) ? await getUserPermissionAccess(context.db, context.user.id, importer.permission as never, 'write') : null;
  if (!access) throw new ForbiddenError(`Missing permission: ${importer.permission}`);
  return { importer, actor: { userId: context.user.id, scope: { ...access, actorEmployeeId: context.user.employee_id }, ip: context.req.ip ?? null } };
}

export const bulkRouter = {
  importers: authed
    .route({ method: 'GET', path: '/bulk/importers', summary: 'Bulk imports available to me' })
    .output(z.array(z.object({
      key: z.string(), title: z.string(), description: z.string(), permission: z.string(),
      contextFields: z.array(z.object({ key: z.string(), label: z.string(), type: z.string() })),
      instructions: z.array(z.string()),
      columns: z.array(z.object({ key: z.string(), header: z.string(), required: z.boolean(), type: z.string(), help: z.string(), options: z.array(z.string()).optional() })),
    })))
    .handler(async ({ context }) => {
      const held = await getUserPermissions(context.db, context.user.id, 'write');
      const mine = IMPORTERS.filter((i) => held.has(i.permission as never));
      return Promise.all(mine.map(async (i) => ({
        key: i.key, title: i.title, description: i.description, permission: i.permission,
        contextFields: [...i.contextFields], instructions: [...i.instructions],
        columns: (await columnsFor(i, context.db)).map((c) => ({ key: c.key, header: c.header, required: c.required ?? false, type: c.type, help: c.help, ...(c.options ? { options: [...c.options] } : {}) })),
      })));
    }),

  template: authed
    .route({ method: 'GET', path: '/bulk/{importer}/template', summary: 'Download the Excel template' })
    .input(importerParam).output(fileOut)
    .handler(async ({ input, context }) => {
      const { importer } = await actorFor(context, input.importer);
      const buffer = await buildTemplate({ title: importer.title, description: importer.description, columns: await columnsFor(importer, context.db), instructions: importer.instructions, samples: importer.samples });
      return { filename: `${importer.key}-template.xlsx`, base64: buffer.toString('base64') };
    }),

  preview: authed
    .route({ method: 'POST', path: '/bulk/{importer}/preview', summary: 'Upload a file and get the row-level validation report (nothing is saved)' })
    .input(importerParam.extend({ filename: z.string().min(1).max(255), base64: z.string().min(4).max(11_500_000), context: z.record(z.string(), z.unknown()).optional() }))
    .output(jobOut)
    .handler(async ({ input, context }) => {
      const { importer, actor } = await actorFor(context, input.importer);
      return previewImport({ db: context.db, importer, actor, filename: input.filename, bytes: Buffer.from(input.base64, 'base64'), rawContext: input.context ?? {} });
    }),

  jobs: authed
    .route({ method: 'GET', path: '/bulk/{importer}/jobs', summary: 'Recent uploads for an import' })
    .input(importerParam).output(z.array(jobOut))
    .handler(async ({ input, context }) => {
      const { importer, actor } = await actorFor(context, input.importer);
      return listJobs(context.db, importer.key, actor);
    }),

  job: authed
    .route({ method: 'GET', path: '/bulk/{importer}/jobs/{jobId}', summary: 'Upload status, progress and report' })
    .input(jobParam).output(jobOut)
    .handler(async ({ input, context }) => {
      const { importer, actor } = await actorFor(context, input.importer);
      return getJob(context.db, input.jobId, actor, importer.key);
    }),

  report: authed
    .route({ method: 'GET', path: '/bulk/{importer}/jobs/{jobId}/report', summary: 'Validation report as Excel' })
    .input(jobParam).output(fileOut)
    .handler(async ({ input, context }) => {
      const { importer, actor } = await actorFor(context, input.importer);
      const { filename, buffer } = await jobReport(context.db, importer, input.jobId, actor);
      return { filename, base64: buffer.toString('base64') };
    }),

  commit: authed
    .route({ method: 'POST', path: '/bulk/{importer}/jobs/{jobId}/commit', summary: 'Apply every row (all-or-nothing)' })
    .input(jobParam).output(jobOut)
    .handler(async ({ input, context }) => {
      const { importer, actor } = await actorFor(context, input.importer);
      return commitImport({ db: context.db, importer, actor, jobId: input.jobId });
    }),

  discard: authed
    .route({ method: 'POST', path: '/bulk/{importer}/jobs/{jobId}/discard', summary: 'Discard a previewed upload' })
    .input(jobParam).output(jobOut)
    .handler(async ({ input, context }) => {
      const { importer, actor } = await actorFor(context, input.importer);
      return discardJob(context.db, importer, input.jobId, actor);
    }),
};
