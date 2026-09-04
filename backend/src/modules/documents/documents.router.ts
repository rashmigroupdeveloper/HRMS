/**
 * Stage 5.4 — document vault API (DOC-01/02/03).
 *
 * ESS own vault (`doc.vault.own`) and HR manage (`doc.vault.manage`).
 * E-sign (DOC-06) is a stub interface only — see `./esign.ts`.
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { booleanQuery } from '../../api/zod.js';
import { assertEmployeesInScope, scopeFromContext } from '../../core/rbac/employee-scope.js';
import {
  listDocTypes,
  listVaultDocuments,
  uploadVaultDocument,
  vaultAlertStages,
} from './vault.service.js';

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const expiryOutput = z.object({
  state: z.enum(['perpetual', 'valid', 'expiring', 'expired']),
  daysRemaining: z.number().int().nullable(),
  stage: z.number().int().nullable(),
});

const typeOutput = z.object({
  code: z.string(),
  name: z.string(),
  typicallyExpires: z.boolean(),
  retentionClass: z.string().nullable(),
  mandatoryFor: z.string(),
  sortOrder: z.number().int(),
});

const documentOutput = z.object({
  id: z.number().int(),
  employeeId: z.number().int(),
  ecode: z.string().nullable(),
  employeeName: z.string().nullable(),
  documentType: z.string(),
  typeName: z.string(),
  originalName: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int(),
  expiresOn: z.string().nullable(),
  status: z.enum(['active', 'superseded', 'withdrawn']),
  uploadedAt: z.string(),
  expiry: expiryOutput,
});

function requireEmployeeId(user: { employee_id: number | null }): number {
  if (user.employee_id === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'Your account has no employee profile linked' });
  }
  return user.employee_id;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const [y, m, d] = value.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

const listTypes = withPermission('doc.vault.own')
  .route({
    method: 'GET',
    path: '/documents/types',
    summary: 'Document type catalog (DOC-01)',
  })
  .input(z.object({}).default({}))
  .output(z.object({ types: z.array(typeOutput) }))
  .handler(async ({ context }) => ({ types: await listDocTypes(context.db) }));

const listMine = withPermission('doc.vault.own')
  .route({
    method: 'GET',
    path: '/documents/mine',
    summary: 'My document vault (DOC-02)',
  })
  .input(
    z
      .object({
        documentType: z.string().optional(),
        needsAttentionOnly: booleanQuery().default(false),
      })
      .default({ needsAttentionOnly: false }),
  )
  .output(z.object({ rows: z.array(documentOutput) }))
  .handler(async ({ input, context }) => {
    const employeeId = requireEmployeeId(context.user);
    const rows = await listVaultDocuments(
      context.db,
      {
        employeeId,
        ...(input.documentType === undefined ? {} : { documentType: input.documentType }),
        needsAttentionOnly: input.needsAttentionOnly,
      },
      new Date(),
      await vaultAlertStages(context.db),
      scopeFromContext(context),
    );
    return { rows };
  });

const listManaged = withPermission('doc.vault.manage')
  .route({
    method: 'GET',
    path: '/documents',
    summary: 'HR document vault — all employees (DOC-02)',
  })
  .input(
    z
      .object({
        employeeId: z.number().int().optional(),
        documentType: z.string().optional(),
        needsAttentionOnly: booleanQuery().default(false),
      })
      .default({ needsAttentionOnly: false }),
  )
  .output(z.object({ rows: z.array(documentOutput) }))
  .handler(async ({ input, context }) => {
    const rows = await listVaultDocuments(
      context.db,
      {
        ...(input.employeeId === undefined ? {} : { employeeId: input.employeeId }),
        ...(input.documentType === undefined ? {} : { documentType: input.documentType }),
        needsAttentionOnly: input.needsAttentionOnly,
      },
      new Date(),
      await vaultAlertStages(context.db),
      scopeFromContext(context),
    );
    return { rows };
  });

const uploadOwn = withPermission('doc.vault.own')
  .route({
    method: 'POST',
    path: '/documents/mine',
    summary: 'Upload a document to my vault (DOC-02)',
  })
  .input(
    z.object({
      documentType: z.string().min(1).max(64),
      fileName: z.string().min(1).max(255),
      mime: z.string().min(1).max(120),
      /** Base64 file bytes — same pattern as policy publish. */
      content: z.string().min(1),
      expiresOn: ISO_DATE.nullable().optional(),
    }),
  )
  .output(z.object({ id: z.number().int() }))
  .handler(async ({ input, context }) => {
    const employeeId = requireEmployeeId(context.user);
    try {
      return await uploadVaultDocument(context.db, {
        employeeId,
        documentType: input.documentType,
        originalName: input.fileName,
        mime: input.mime,
        content: Buffer.from(input.content, 'base64'),
        expiresOn: parseOptionalDate(input.expiresOn ?? null),
        uploadedBy: context.user.id,
      });
    } catch (err) {
      if (err instanceof ORPCError) throw err;
      throw new ORPCError('BAD_REQUEST', {
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  });

const uploadForEmployee = withPermission('doc.vault.manage')
  .route({
    method: 'POST',
    path: '/documents',
    summary: 'HR upload into an employee vault (DOC-02)',
  })
  .input(
    z.object({
      employeeId: z.number().int(),
      documentType: z.string().min(1).max(64),
      fileName: z.string().min(1).max(255),
      mime: z.string().min(1).max(120),
      content: z.string().min(1),
      expiresOn: ISO_DATE.nullable().optional(),
    }),
  )
  .output(z.object({ id: z.number().int() }))
  .handler(async ({ input, context }) => {
    await assertEmployeesInScope(context.db, scopeFromContext(context), [input.employeeId]);
    try {
      return await uploadVaultDocument(context.db, {
        employeeId: input.employeeId,
        documentType: input.documentType,
        originalName: input.fileName,
        mime: input.mime,
        content: Buffer.from(input.content, 'base64'),
        expiresOn: parseOptionalDate(input.expiresOn ?? null),
        uploadedBy: context.user.id,
      });
    } catch (err) {
      if (err instanceof ORPCError) throw err;
      throw new ORPCError('BAD_REQUEST', {
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  });

export const documentsRouter = {
  listTypes,
  listMine,
  listManaged,
  uploadOwn,
  uploadForEmployee,
};
