/**
 * Bulk import engine: preview → (review) → commit.
 *
 *  preview  parse + map + coerce + in-file duplicates + importer validation;
 *           stores the reviewed rows and report on core.bulk_jobs; audited.
 *  commit   refuses while any row has an error; claims the job atomically
 *           (status previewed → committing); the unique partial index makes
 *           re-committing the same file into the same context a conflict
 *           (idempotent re-upload); applies ALL rows in one transaction or
 *           none; large files run in the background with progress; audited.
 */
import { createHash } from 'node:crypto';
import { sql, type ControlledTransaction, type Kysely, type Transaction } from 'kysely';
import { writeAudit } from '../audit/audit.service.js';
import type { Database } from '../db/types.js';
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from '../errors/index.js';
import { logger } from '../logger.js';
import { mapUpload } from './map.js';
import { parseUpload } from './parse.js';
import { buildValidationReport } from './workbook.js';
import type { BulkColumn, BulkImporter, BulkRow, Cell, CommitResult, ImportActor } from './types.js';

/** Files with more rows than this commit in the background (poll the job). */
const BACKGROUND_ROW_THRESHOLD = 1000;
const PREVIEW_SAMPLE = 100;

export interface JobSummary {
  jobId: number;
  importer: string;
  filename: string;
  status: string;
  sheet: string | null;
  layout: string | null;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  processedRows: number;
  fileIssues: string[];
  duplicateOfJobId: number | null;
  issues: { rowNumber: number; column: string | null; severity: 'error' | 'warning'; message: string }[];
  preview: { rowNumber: number; values: Record<string, Cell>; status: 'ok' | 'warning' | 'error' }[];
  result: CommitResult | null;
  error: string | null;
  createdAt: string;
  committedAt: string | null;
}

interface StoredReport { sheet: string; layout: string; fileIssues: string[]; duplicateOfJobId: number | null }

function hasError(row: BulkRow): boolean {
  return row.issues.some((i) => i.severity === 'error');
}


/** All-or-nothing: a real transaction, or a savepoint inside a caller's controlled transaction. */
async function atomically<T>(db: Kysely<Database>, fn: (trx: Transaction<Database>) => Promise<T>): Promise<T> {
  if (!db.isTransaction) return db.transaction().execute(fn);
  const controlled = db as unknown as ControlledTransaction<Database>;
  if (typeof controlled.savepoint !== 'function') return fn(db as Transaction<Database>);
  const sp = await controlled.savepoint('bulk_commit').execute();
  try {
    const out = await fn(sp);
    await sp.releaseSavepoint('bulk_commit').execute();
    return out;
  } catch (error) {
    await sp.rollbackToSavepoint('bulk_commit').execute();
    throw error;
  }
}

function toSummary(row: {
  id: number; importer: string; filename: string; status: string; total_rows: number; error_rows: number; warning_rows: number;
  processed_rows: number; rows: unknown; report: unknown; result: unknown; error: string | null; created_at: Date; committed_at: Date | string | null;
}): JobSummary {
  const rows = (row.rows ?? []) as BulkRow[];
  const report = (row.report ?? {}) as Partial<StoredReport>;
  const issues = rows.flatMap((r) => r.issues.map((i) => ({ rowNumber: r.rowNumber, ...i })));
  return {
    jobId: row.id,
    importer: row.importer,
    filename: row.filename,
    status: row.status,
    sheet: report.sheet ?? null,
    layout: report.layout ?? null,
    totalRows: row.total_rows,
    validRows: row.total_rows - row.error_rows,
    errorRows: row.error_rows,
    warningRows: row.warning_rows,
    processedRows: row.processed_rows,
    fileIssues: report.fileIssues ?? [],
    duplicateOfJobId: report.duplicateOfJobId ?? null,
    issues: issues.slice(0, 500),
    preview: rows.slice(0, PREVIEW_SAMPLE).map((r) => ({
      rowNumber: r.rowNumber, values: r.values,
      status: hasError(r) ? 'error' as const : r.issues.length > 0 ? 'warning' as const : 'ok' as const,
    })),
    result: (row.result ?? null) as CommitResult | null,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    committedAt: row.committed_at === null ? null : new Date(row.committed_at).toISOString(),
  };
}

/** Importer columns with live dropdown values merged in (enum options from the database). */
export async function columnsFor<C>(importer: BulkImporter<C>, db: Kysely<Database>): Promise<BulkColumn[]> {
  const dynamic = importer.dynamicOptions ? await importer.dynamicOptions(db) : {};
  return importer.columns.map((c) => {
    const options = dynamic[c.key];
    return options ? { ...c, type: 'enum' as const, options } : { ...c };
  });
}

export async function previewImport<C>(params: {
  db: Kysely<Database>;
  importer: BulkImporter<C>;
  actor: ImportActor;
  filename: string;
  bytes: Buffer;
  rawContext: unknown;
}): Promise<JobSummary> {
  const { db, importer, actor } = params;
  const parsedContext = importer.contextSchema.safeParse(params.rawContext ?? {});
  if (!parsedContext.success) {
    throw new DomainError(`Missing or invalid upload details: ${parsedContext.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  const context = parsedContext.data;
  const run = { db, context, actor };
  const companyId = await importer.authorize(run);

  const sheets = await parseUpload(params.filename, params.bytes);
  const mapped = mapUpload(sheets, await columnsFor(importer, db), importer.layouts ?? []);
  const rows = mapped.rows;

  if (importer.rowKey) {
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (hasError(row)) continue;
      const key = importer.rowKey(row.values);
      const first = seen.get(key);
      if (first !== undefined) row.issues.push({ column: null, severity: 'error', message: `Duplicate of row ${String(first)} in this file` });
      else seen.set(key, row.rowNumber);
    }
  }
  await importer.validate(run, rows);

  const fileIssues: string[] = [];
  if (mapped.ignoredColumns.length > 0) fileIssues.push(`Ignored columns (not used by this import): ${mapped.ignoredColumns.join(', ')}`);
  if (mapped.layout !== 'standard') fileIssues.push(`Recognised layout: ${mapped.layout}`);
  const sha = createHash('sha256').update(params.bytes).digest('hex');
  const contextKey = importer.contextKey(context);
  const prior = await db.selectFrom('core.bulk_jobs').select(['id', 'committed_at'])
    .where('importer', '=', importer.key).where('context_key', '=', contextKey).where('file_sha256', '=', sha)
    .where('status', 'in', ['committing', 'committed']).executeTakeFirst();
  if (prior) fileIssues.push(`This exact file was already imported (job #${String(prior.id)}). Confirming again is blocked so nothing is applied twice.`);

  const errorRows = rows.filter(hasError).length;
  const warningRows = rows.filter((r) => !hasError(r) && r.issues.length > 0).length;
  const report: StoredReport = { sheet: mapped.sheet, layout: mapped.layout, fileIssues, duplicateOfJobId: prior?.id ?? null };
  const job = await db.insertInto('core.bulk_jobs').values({
    importer: importer.key,
    context: JSON.stringify(context),
    context_key: contextKey,
    company_id: companyId,
    filename: params.filename.slice(0, 255),
    file_sha256: sha,
    total_rows: rows.length,
    error_rows: errorRows,
    warning_rows: warningRows,
    rows: JSON.stringify(rows),
    report: JSON.stringify(report),
    created_by: actor.userId,
  }).returningAll().executeTakeFirstOrThrow();
  await writeAudit(db, {
    actorUserId: actor.userId, action: 'bulk_import_previewed', entity: 'core.bulk_jobs', entityId: job.id,
    field: importer.key, newValue: JSON.stringify({ filename: job.filename, sha256: sha, rows: rows.length, errorRows, warningRows, context }), ip: actor.ip,
  });
  return toSummary(job);
}

async function loadJob(db: Kysely<Database>, jobId: number, importerKey?: string) {
  const job = await db.selectFrom('core.bulk_jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
  if (!job || (importerKey !== undefined && job.importer !== importerKey)) throw new NotFoundError('Import job not found');
  return job;
}

/** Jobs are private to the uploader unless the viewer is group-scoped for the importer. */
function assertJobVisible(job: { created_by: number }, actor: ImportActor): void {
  if (job.created_by !== actor.userId && !actor.scope.all) throw new ForbiddenError('This import belongs to another user');
}

export async function getJob(db: Kysely<Database>, jobId: number, actor: ImportActor, importerKey?: string): Promise<JobSummary> {
  const job = await loadJob(db, jobId, importerKey);
  assertJobVisible(job, actor);
  return toSummary(job);
}

export async function jobReport(db: Kysely<Database>, importer: BulkImporter<unknown>, jobId: number, actor: ImportActor): Promise<{ filename: string; buffer: Buffer }> {
  const job = await loadJob(db, jobId, importer.key);
  assertJobVisible(job, actor);
  const rows = job.rows as BulkRow[];
  const report = job.report as Partial<StoredReport>;
  const buffer = await buildValidationReport({ title: importer.title, columns: importer.columns, fileIssues: report.fileIssues ?? [], rows });
  return { filename: `${importer.key}-job${String(job.id)}-validation.xlsx`, buffer };
}

export async function discardJob(db: Kysely<Database>, importer: BulkImporter<unknown>, jobId: number, actor: ImportActor): Promise<JobSummary> {
  const job = await loadJob(db, jobId, importer.key);
  assertJobVisible(job, actor);
  const updated = await db.updateTable('core.bulk_jobs').set({ status: 'discarded' })
    .where('id', '=', jobId).where('status', '=', 'previewed').returningAll().executeTakeFirst();
  if (!updated) throw new ConflictError(`Only a previewed import can be discarded (this one is ${job.status})`);
  return toSummary(updated);
}

async function runCommit<C>(db: Kysely<Database>, importer: BulkImporter<C>, jobId: number, context: C, rows: BulkRow[], actor: ImportActor): Promise<void> {
  const progress = async (processed: number) => {
    // Progress is written outside the import transaction so pollers see it.
    if (!db.isTransaction) await db.updateTable('core.bulk_jobs').set({ processed_rows: processed }).where('id', '=', jobId).execute();
  };
  try {
    const result = await atomically(db, (trx) => importer.commit({ db: trx, trx, context, actor }, rows, progress));
    await db.updateTable('core.bulk_jobs').set({
      status: 'committed', processed_rows: rows.length, result: JSON.stringify(result), committed_by: actor.userId, committed_at: sql`now()`,
    }).where('id', '=', jobId).execute();
    await writeAudit(db, {
      actorUserId: actor.userId, action: 'bulk_import_committed', entity: 'core.bulk_jobs', entityId: jobId,
      field: importer.key, newValue: JSON.stringify(result), ip: actor.ip,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.updateTable('core.bulk_jobs').set({ status: 'failed', error: message.slice(0, 2000) }).where('id', '=', jobId).execute();
    await writeAudit(db, {
      actorUserId: actor.userId, action: 'bulk_import_failed', entity: 'core.bulk_jobs', entityId: jobId,
      field: importer.key, newValue: message.slice(0, 500), ip: actor.ip,
    });
    throw error;
  }
}

export async function commitImport<C>(params: {
  db: Kysely<Database>;
  importer: BulkImporter<C>;
  actor: ImportActor;
  jobId: number;
  /** Override for tests; defaults to BACKGROUND_ROW_THRESHOLD. */
  backgroundThreshold?: number;
}): Promise<JobSummary> {
  const { db, importer, actor, jobId } = params;
  const job = await loadJob(db, jobId, importer.key);
  assertJobVisible(job, actor);
  if (job.status !== 'previewed') throw new ConflictError(`This import is already ${job.status}`);
  if (job.error_rows > 0) throw new DomainError(`Fix the ${String(job.error_rows)} row(s) with errors and upload again — nothing was saved.`);
  const context = importer.contextSchema.parse(job.context);
  await importer.authorize({ db, context, actor });

  const prior = await db.selectFrom('core.bulk_jobs').select('id')
    .where('importer', '=', job.importer).where('context_key', '=', job.context_key).where('file_sha256', '=', job.file_sha256)
    .where('status', 'in', ['committing', 'committed']).executeTakeFirst();
  if (prior) throw new ConflictError(`This exact file was already imported (job #${String(prior.id)}). Nothing was applied again.`);
  const claimed = await db.updateTable('core.bulk_jobs').set({ status: 'committing', processed_rows: 0 })
    .where('id', '=', jobId).where('status', '=', 'previewed').returning('id').executeTakeFirst();
  if (!claimed) throw new ConflictError('This import is already being committed');

  const rows = job.rows as BulkRow[];
  const threshold = params.backgroundThreshold ?? BACKGROUND_ROW_THRESHOLD;
  if (rows.length > threshold && !db.isTransaction) {
    setImmediate(() => {
      runCommit(db, importer, jobId, context, rows, actor).catch((error: unknown) => {
        logger.error({ err: error, jobId, importer: importer.key }, 'bulk import background commit failed');
      });
    });
    return toSummary({ ...job, status: 'committing', processed_rows: 0 });
  }
  await runCommit(db, importer, jobId, context, rows, actor);
  return getJob(db, jobId, actor, importer.key);
}

/** Recent jobs for an importer (own jobs; group-scoped viewers see everyone's). */
export async function listJobs(db: Kysely<Database>, importerKey: string, actor: ImportActor, limit = 20): Promise<JobSummary[]> {
  let q = db.selectFrom('core.bulk_jobs').selectAll().where('importer', '=', importerKey).orderBy('id', 'desc').limit(limit);
  if (!actor.scope.all) q = q.where('created_by', '=', actor.userId);
  const jobs = await q.execute();
  return jobs.map((j) => ({ ...toSummary({ ...j, rows: [] }), totalRows: j.total_rows }));
}

