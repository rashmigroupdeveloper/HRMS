/**
 * Asset registry API (M8 — AST-01…AST-06).
 *
 * One permission code guards the whole module (`assets.manage`, docs/08 §2);
 * which roles hold it is database state, editable at runtime. Read access is
 * granted alongside write because an asset register with a separate read
 * permission would just be granted to everyone in practice — the sensitive
 * part is the mutation, and every mutation is audited.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { booleanQuery } from '../../api/zod.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { rowsToExcelBuffer } from '../../core/excel/workbook.js';
import {
  assetMaintenance,
  assetsHeldByEmployee,
  assignAsset,
  listAssets,
  logMaintenance,
  nonReturnedByLeavers,
  returnAsset,
  upsertAsset,
} from './assets.service.js';

const guard = () => withPermission('assets.manage');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', {
    message: err instanceof Error ? err.message : 'Invalid request',
  });
}

const assetShape = z.object({
  id: z.number(),
  assetNo: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  serialNo: z.string().nullable(),
  purchaseDate: z.string().nullable(),
  warrantyTill: z.string().nullable(),
  status: z.enum(['in_stock', 'assigned', 'maintenance', 'lost', 'scrapped']),
  companyId: z.number(),
  locationName: z.string().nullable(),
  holderKind: z.enum(['employee', 'third_party']).nullable(),
  holderName: z.string().nullable(),
  holderEcode: z.string().nullable(),
  assignedAt: z.string().nullable(),
  assignmentId: z.number().nullable(),
});

/** AST-01 — the searchable register. */
const list = guard()
  .route({ method: 'GET', path: '/assets', summary: 'Asset registry (searchable by no, serial, holder)' })
  .input(
    z.object({
      companyId: z.coerce.number().int().positive().optional(),
      q: z.string().optional(),
      status: z.enum(['in_stock', 'assigned', 'maintenance', 'lost', 'scrapped']).optional(),
      category: z.string().optional(),
      outstandingOnly: booleanQuery().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }),
  )
  .output(z.object({ rows: z.array(assetShape), total: z.number() }))
  .handler(async ({ input, context }) => {
    return listAssets(context.db, input);
  });

/** AST-01/02 — register or amend an asset; past warranty dates are valid. */
const upsert = guard()
  .route({ method: 'PUT', path: '/assets/{assetNo}', summary: 'Create or update an asset (audited)' })
  .input(
    z.object({
      assetNo: z.string().min(1),
      category: z.string().min(1),
      description: z.string().nullish(),
      serialNo: z.string().nullish(),
      purchaseDate: isoDate.nullish(),
      // AST-02 — deliberately unbounded: kit is often registered after issue.
      warrantyTill: isoDate.nullish(),
      companyId: z.number().int().positive(),
      locationId: z.number().int().positive().nullish(),
    }),
  )
  .output(z.object({ id: z.number(), created: z.boolean() }))
  .handler(async ({ input, context }) => {
    try {
      return await upsertAsset(context.db, {
        ...input,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

/** AST-03 — allocate to an employee or a third party. */
const assign = guard()
  .route({ method: 'POST', path: '/assets/{assetId}/assign', summary: 'Allocate an asset (audited)' })
  .input(
    z.object({
      assetId: z.coerce.number().int().positive(),
      holderKind: z.enum(['employee', 'third_party']),
      employeeId: z.number().int().positive().nullish(),
      thirdPartyName: z.string().nullish(),
      thirdPartyOrg: z.string().nullish(),
      notes: z.string().nullish(),
    }),
  )
  .output(z.object({ assignmentId: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      return await assignAsset(context.db, {
        ...input,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

/** AST-04 — record a return; `not_returned` is a legitimate outcome. */
const recordReturn = guard()
  .route({ method: 'POST', path: '/assets/assignments/{assignmentId}/return', summary: 'Record a return (audited)' })
  .input(
    z.object({
      assignmentId: z.coerce.number().int().positive(),
      condition: z.enum(['ok', 'damaged', 'not_returned']),
      notes: z.string().nullish(),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    try {
      return await returnAsset(context.db, {
        ...input,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

/** AST-04 — the exit-clearance list for one employee. */
const heldByEmployee = guard()
  .route({ method: 'GET', path: '/assets/held-by/{employeeId}', summary: 'Assets an employee still holds (exit clearance)' })
  .input(z.object({ employeeId: z.coerce.number().int().positive() }))
  .output(
    z.array(
      z.object({
        assignmentId: z.number(),
        assetNo: z.string(),
        category: z.string(),
        assignedAt: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    return assetsHeldByEmployee(context.db, input.employeeId);
  });

/** AST-05 — the dashboard tile: still out, holder already gone. */
const outstanding = guard()
  .route({ method: 'GET', path: '/assets/non-returned', summary: 'Assets held by employees who have exited (AST-05)' })
  .input(z.object({ companyId: z.coerce.number().int().positive().optional() }).optional())
  .output(
    z.array(
      z.object({
        assetNo: z.string(),
        category: z.string(),
        ecode: z.string(),
        name: z.string(),
        dol: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    return nonReturnedByLeavers(context.db, input?.companyId);
  });

/** AST-06 — maintenance, incident, damage, loss. */
const maintenanceLog = guard()
  .route({ method: 'GET', path: '/assets/{assetId}/maintenance', summary: 'Maintenance and incident trail' })
  .input(z.object({ assetId: z.coerce.number().int().positive() }))
  .output(
    z.array(
      z.object({
        id: z.number(),
        kind: z.enum(['scheduled', 'incident', 'damage', 'lost']),
        description: z.string(),
        scheduledFor: z.string().nullable(),
        resolvedAt: z.string().nullable(),
        cost: z.number().nullable(),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    return assetMaintenance(context.db, input.assetId);
  });

const addMaintenance = guard()
  .route({ method: 'POST', path: '/assets/{assetId}/maintenance', summary: 'Log maintenance, an incident, damage or a loss (audited)' })
  .input(
    z.object({
      assetId: z.coerce.number().int().positive(),
      kind: z.enum(['scheduled', 'incident', 'damage', 'lost']),
      description: z.string().min(1),
      scheduledFor: isoDate.nullish(),
      cost: z.number().min(0).nullish(),
    }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    try {
      return await logMaintenance(context.db, {
        ...input,
        actorUserId: context.user.id,
        ip: context.req.ip ?? null,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

/**
 * R28 — Asset reports (docs/06 §3), as Excel.
 *
 * Two sheets people actually ask for: the register as filtered on screen, and
 * the not-returned list. Both call the SAME service functions the tables use,
 * so the workbook is the screen (RPT-06). Exports are audited — an asset
 * register is a security-relevant document.
 */
const exportRegister = guard()
  .route({ method: 'GET', path: '/assets/export', summary: 'R28 — asset register as Excel (same filters as the table)' })
  .input(
    z.object({
      companyId: z.coerce.number().int().positive().optional(),
      q: z.string().optional(),
      status: z.enum(['in_stock', 'assigned', 'maintenance', 'lost', 'scrapped']).optional(),
      category: z.string().optional(),
      outstandingOnly: booleanQuery().optional(),
    }),
  )
  .output(z.object({ filename: z.string(), base64: z.string() }))
  .handler(async ({ input, context }) => {
    // No silent row cap: an export that quietly truncates is worse than none.
    const { rows } = await listAssets(context.db, { ...input, limit: 100_000, offset: 0 });
    const buf = await rowsToExcelBuffer(
      'R28 Asset register',
      [
        { header: 'Asset no', key: 'assetNo', width: 18 },
        { header: 'Category', key: 'category', width: 14 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Serial no', key: 'serialNo', width: 20 },
        { header: 'Status', key: 'status', width: 13 },
        { header: 'Held by', key: 'holderName', width: 24 },
        { header: 'Holder type', key: 'holderKind', width: 13 },
        { header: 'Holder e-code', key: 'holderEcode', width: 14 },
        { header: 'Allocated on', key: 'assignedAt', width: 22 },
        { header: 'Purchase date', key: 'purchaseDate', width: 14 },
        { header: 'Warranty till', key: 'warrantyTill', width: 14 },
        { header: 'Location', key: 'locationName', width: 18 },
      ],
      rows,
    );
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'export',
      entity: 'ast.assets',
      field: 'R28-register',
      newValue: `${String(rows.length)} rows`,
      ip: context.req.ip ?? null,
    });
    return { filename: 'R28-asset-register.xlsx', base64: buf.toString('base64') };
  });

const exportOutstanding = guard()
  .route({ method: 'GET', path: '/assets/non-returned/export', summary: 'R28 — not-returned assets as Excel (AST-05)' })
  .input(z.object({ companyId: z.coerce.number().int().positive().optional() }).optional())
  .output(z.object({ filename: z.string(), base64: z.string() }))
  .handler(async ({ input, context }) => {
    const rows = await nonReturnedByLeavers(context.db, input?.companyId);
    const buf = await rowsToExcelBuffer(
      'R28 Not returned',
      [
        { header: 'Asset no', key: 'assetNo', width: 18 },
        { header: 'Category', key: 'category', width: 14 },
        { header: 'E-code', key: 'ecode', width: 14 },
        { header: 'Held by (exited)', key: 'name', width: 26 },
        { header: 'Left on', key: 'dol', width: 14 },
      ],
      rows,
    );
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'export',
      entity: 'ast.assignments',
      field: 'R28-not-returned',
      newValue: `${String(rows.length)} rows`,
      ip: context.req.ip ?? null,
    });
    return { filename: 'R28-assets-not-returned.xlsx', base64: buf.toString('base64') };
  });

export const assetsRouter = {
  exportRegister,
  exportOutstanding,
  list,
  upsert,
  assign,
  recordReturn,
  heldByEmployee,
  outstanding,
  maintenanceLog,
  addMaintenance,
};
