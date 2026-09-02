/**
 * Audit read surface (CORE-11, doc 14 §7.4) — the append-only, hash-chained
 * log made visible to the roles that hold `audit.read` (docs/08 §2).
 *
 * Two things this deliberately does NOT do:
 *   - it never exposes a write path (the chain is INSERT-only, via writeAudit)
 *   - it never unmasks: callers mask sensitive values BEFORE they reach the
 *     log, so what is stored is what is safe to show (CLAUDE.md §5).
 *
 * `verify` runs the DB-side chain check, so tamper detection holds even if
 * application code lies about what it wrote.
 *
 * CORE-10 scope is captured on each append-only row. Org-scoped readers see
 * only their assigned org units; legacy and global rows fail closed. Chain
 * verification remains global because the log is one cryptographic chain.
 */
import { z } from 'zod';
import { ORPCError } from '@orpc/server';
import { withPermission } from '../../api/orpc.js';
import { verifyAuditChain } from '../../core/audit/audit.service.js';
import { rowsToExcelBuffer } from '../../core/excel/workbook.js';
import { auditScopeSql, listAuditPage } from './audit.service.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

/** Hard ceiling — no unbounded reads on a table that only ever grows. */
const MAX_PAGE = 200;


const auditRow = z.object({
  id: z.number(),
  at: z.string(),
  actorUserId: z.number().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.number().nullable(),
  field: z.string().nullable(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  ip: z.string().nullable(),
});

const listAudit = withPermission('audit.read')
  .route({ method: 'GET', path: '/audit', summary: 'Filtered audit trail (append-only, hash-chained)' })
  .input(
    z.object({
      entity: z.string().optional(),
      action: z.string().optional(),
      actorUserId: z.coerce.number().int().positive().optional(),
      fromDate: isoDate.optional(),
      toDate: isoDate.optional(),
      search: z.string().optional(),
      limit: z.coerce.number().int().positive().max(MAX_PAGE).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  )
  .output(z.object({ rows: z.array(auditRow), total: z.number(), limit: z.number(), offset: z.number() }))
  .handler(async ({ input, context }) => {
    return listAuditPage(context.db, input, context.permissionAccess);
  });

/** The distinct entities/actions present — drives the viewer's filter dropdowns
 *  without hardcoding a list that would drift from reality. */
const auditFacets = withPermission('audit.read')
  .route({ method: 'GET', path: '/audit/facets', summary: 'Distinct entities and actions in the log' })
  .output(z.object({ entities: z.array(z.string()), actions: z.array(z.string()) }))
  .handler(async ({ context }) => {
    const scope = auditScopeSql(context.permissionAccess);
    const [entities, actions] = await Promise.all([
      context.db.selectFrom('core.audit_log').select('entity').where(scope).distinct().orderBy('entity').execute(),
      context.db.selectFrom('core.audit_log').select('action').where(scope).distinct().orderBy('action').execute(),
    ]);
    return { entities: entities.map((e) => e.entity), actions: actions.map((a) => a.action) };
  });

/** Tamper check — recomputes the whole chain IN THE DATABASE (CORE-11). */
const verifyChain = withPermission('audit.read')
  .route({ method: 'GET', path: '/audit/verify', summary: 'Verify the hash chain end to end' })
  .output(z.object({ intact: z.boolean(), brokenAtId: z.number().nullable() }))
  .handler(async ({ context }) => {
    const broken = await verifyAuditChain(context.db);
    return { intact: broken === null, brokenAtId: broken };
  });

/**
 * The audit trail as a file.
 *
 * An auditor cannot be handed a scrolling table — a compliance system has to
 * be able to produce the evidence. Same filters as the on-screen list, and
 * capped at a size a spreadsheet can actually open rather than silently
 * truncated: a partial audit export that LOOKS complete is worse than a
 * refusal, so exceeding the cap is an error, not a quiet trim.
 */
const EXPORT_MAX = 50_000;

const exportAudit = withPermission('audit.read')
  .route({ method: 'GET', path: '/audit/export', summary: 'Filtered audit trail as Excel' })
  .input(
    z.object({
      entity: z.string().optional(),
      action: z.string().optional(),
      actorUserId: z.coerce.number().int().positive().optional(),
      fromDate: isoDate.optional(),
      toDate: isoDate.optional(),
      search: z.string().optional(),
    }),
  )
  .output(z.object({ filename: z.string(), base64: z.string() }))
  .handler(async ({ input, context }) => {
    const page = await listAuditPage(
      context.db,
      { ...input, limit: EXPORT_MAX, offset: 0 },
      context.permissionAccess,
    );
    if (page.total > EXPORT_MAX) {
      throw new ORPCError('BAD_REQUEST', {
        message: `That filter matches ${page.total.toLocaleString('en-IN')} entries — narrow the date range to ${String(EXPORT_MAX)} or fewer so the export is complete.`,
      });
    }
    const buf = await rowsToExcelBuffer(
      'Audit trail',
      [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'When (UTC)', key: 'at', width: 24 },
        { header: 'Actor', key: 'actorName', width: 28 },
        { header: 'Action', key: 'action', width: 14 },
        { header: 'Entity', key: 'entity', width: 26 },
        { header: 'Entity ID', key: 'entityId', width: 11 },
        { header: 'Field', key: 'field', width: 22 },
        { header: 'Old value', key: 'oldValue', width: 28 },
        { header: 'New value', key: 'newValue', width: 28 },
        { header: 'IP', key: 'ip', width: 16 },
      ],
      page.rows,
    );
    return { filename: 'audit-trail.xlsx', base64: buf.toString('base64') };
  });

export const auditRouter = {
  export: exportAudit,
  list: listAudit,
  facets: auditFacets,
  verify: verifyChain,
};
