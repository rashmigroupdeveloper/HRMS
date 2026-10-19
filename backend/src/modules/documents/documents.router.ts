/** DOC-01/02/03 + CORE-08: employee vault, scoped HR reads and safe downloads. */
import { inTransaction } from '../../core/db/database.js';
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { sql } from 'kysely';
import { assertEmployeesInScope, employeeScopeSql } from '../../core/rbac/employee-scope.js';
import { getTypedSetting } from '../settings/index.js';
import { downloadFile } from './download.service.js';
import {
  listDocTypes,
  listVaultDocuments,
  uploadVaultDocument,
  vaultAlertStages,
} from './vault.service.js';
const empty = z.object({}).optional();
const expiry = z.object({
  state: z.enum(['perpetual', 'valid', 'expiring', 'expired']),
  daysRemaining: z.number().nullable(),
  stage: z.number().nullable(),
});
const document = z.object({
  id: z.number(),
  employeeId: z.number(),
  ecode: z.string().nullable(),
  employeeName: z.string().nullable(),
  documentType: z.string(),
  typeName: z.string(),
  originalName: z.string(),
  mime: z.string(),
  sizeBytes: z.number(),
  expiresOn: z.string().nullable(),
  status: z.enum(['active', 'superseded', 'withdrawn']),
  uploadedAt: z.string(),
  expiry,
});
const filter = z.object({
  documentType: z.string().max(64).optional(),
  needsAttentionOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
const upload = z.object({
  documentType: z.string().min(1).max(64),
  fileName: z.string().trim().min(1).max(255),
  mime: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
  content: z.string().min(1).max(12_000_000),
  expiresOn: z.string().date().nullable().optional(),
});
function employee(id: number | null): number {
  if (id === null)
    throw new ORPCError('BAD_REQUEST', { message: 'Your account has no linked employee record' });
  return id;
}
async function uploadLimit(db: Parameters<typeof getTypedSetting>[0]) {
  return z
    .number()
    .int()
    .positive()
    .max(8000000)
    .parse(await getTypedSetting(db, 'doc.max_upload_bytes', 'number', 8000000));
}
async function validatedBytes(
  db: Parameters<typeof getTypedSetting>[0],
  input: z.infer<typeof upload>,
) {
  const maxBytes = await uploadLimit(db);
  const bytes = Buffer.from(input.content, 'base64');
  if (!bytes.length || bytes.length > maxBytes || bytes.toString('base64') !== input.content)
    throw new ORPCError('BAD_REQUEST', {
      message: 'Use a valid base64 file within the configured upload size limit',
    });
  const matches =
    input.mime === 'application/pdf'
      ? bytes.subarray(0, 5).toString() === '%PDF-'
      : input.mime === 'image/png'
        ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
        : bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (!matches)
    throw new ORPCError('BAD_REQUEST', {
      message: 'The file contents do not match its selected type',
    });
  return bytes;
}
const catalogOutput = z.object({
  maxUploadBytes: z.number().int().positive(),
  types: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      typicallyExpires: z.boolean(),
      retentionClass: z.string().nullable(),
      mandatoryFor: z.string(),
      sortOrder: z.number(),
    }),
  ),
});
const types = withPermission('doc.vault.own')
  .route({
    method: 'GET',
    path: '/documents/types',
    summary: 'Active employee document catalog (DOC-01)',
  })
  .input(empty)
  .output(catalogOutput)
  .handler(async ({ context }) => ({
    types: await listDocTypes(context.db),
    maxUploadBytes: await uploadLimit(context.db),
  }));
const managedTypes = withPermission('doc.vault.manage')
  .route({
    method: 'GET',
    path: '/documents/catalog',
    summary: 'Document catalog for authorized HR',
  })
  .input(empty)
  .output(catalogOutput)
  .handler(async ({ context }) => ({
    types: await listDocTypes(context.db),
    maxUploadBytes: await uploadLimit(context.db),
  }));
const mine = withPermission('doc.vault.own')
  .route({ method: 'GET', path: '/documents/mine', summary: 'My document vault (DOC-02)' })
  .input(filter)
  .output(z.object({ rows: z.array(document) }))
  .handler(async ({ input, context }) => ({
    rows: await listVaultDocuments(
      context.db,
      { ...input, employeeId: employee(context.user.employee_id) },
      new Date(),
      await vaultAlertStages(context.db),
      { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
    ),
  }));
async function resolveEmployeeCode(
  db: Parameters<typeof getTypedSetting>[0],
  code: string,
  scope: Parameters<typeof assertEmployeesInScope>[1],
) {
  const row = await db
    .selectFrom('core.employees as e')
    .select('e.id')
    .where(sql`upper(e.ecode)`, '=', code.trim().toUpperCase())
    .where(employeeScopeSql(scope, 'e'))
    .executeTakeFirst();
  if (!row)
    throw new ORPCError('NOT_FOUND', { message: 'Employee not found in your document scope' });
  return row.id;
}
const managed = withPermission('doc.vault.manage')
  .route({ method: 'GET', path: '/documents', summary: 'Scoped HR document vault (DOC-02)' })
  .input(
    filter.extend({
      employeeId: z.coerce.number().int().positive().optional(),
      employeeCode: z.string().trim().min(1).max(40).optional(),
    }),
  )
  .output(z.object({ rows: z.array(document) }))
  .handler(async ({ input, context }) => {
    const scope = { ...context.permissionAccess, actorEmployeeId: context.user.employee_id };
    const employeeId = input.employeeCode
      ? await resolveEmployeeCode(context.db, input.employeeCode, scope)
      : input.employeeId;
    const rows = await listVaultDocuments(
      context.db,
      { ...input, employeeId },
      new Date(),
      await vaultAlertStages(context.db),
      { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
    );
    // A filename can itself contain a PAN or medical detail. HR's catalog lists
    // the document class; original names are disclosed only to their owner.
    return {
      rows: rows.map((row) =>
        row.employeeId === context.user.employee_id ? row : { ...row, originalName: row.typeName },
      ),
    };
  });
const uploadMine = withPermission('doc.vault.own')
  .route({
    method: 'POST',
    path: '/documents/mine',
    summary: 'Upload to my document vault (DOC-02)',
  })
  .input(upload)
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) =>
    uploadVaultDocument(context.db, {
      employeeId: employee(context.user.employee_id),
      documentType: input.documentType,
      originalName: input.fileName,
      mime: input.mime,
      content: await validatedBytes(context.db, input),
      expiresOn: input.expiresOn ? new Date(`${input.expiresOn}T00:00:00Z`) : null,
      uploadedBy: context.user.id,
    }),
  );
const uploadManaged = withPermission('doc.vault.manage')
  .route({
    method: 'POST',
    path: '/documents',
    summary: 'Upload to an in-scope employee vault (DOC-02)',
  })
  .input(
    upload
      .extend({
        employeeId: z.number().int().positive().optional(),
        employeeCode: z.string().trim().min(1).max(40).optional(),
      })
      .refine((value) => (value.employeeId === undefined) !== (value.employeeCode === undefined), {
        message: 'Supply exactly one employee code or employee ID',
      }),
  )
  .output(z.object({ id: z.number() }))
  .handler(async ({ input, context }) => {
    return inTransaction(context.db, async (db) => {
      const employeeId = input.employeeCode
        ? await resolveEmployeeCode(db, input.employeeCode, {
            ...context.permissionAccess,
            actorEmployeeId: context.user.employee_id,
          })
        : input.employeeId;
      if (employeeId === undefined)
        throw new ORPCError('BAD_REQUEST', { message: 'Choose an employee' });
      await db
        .selectFrom('core.employees')
        .select('id')
        .where('id', '=', employeeId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      await assertEmployeesInScope(
        db,
        { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
        [employeeId],
      );
      return uploadVaultDocument(db, {
        employeeId: employeeId,
        documentType: input.documentType,
        originalName: input.fileName,
        mime: input.mime,
        content: await validatedBytes(db, input),
        expiresOn: input.expiresOn ? new Date(`${input.expiresOn}T00:00:00Z`) : null,
        uploadedBy: context.user.id,
      });
    });
  });
const downloadInput = z.object({
  id: z.coerce.number().int().positive(),
  purpose: z.string().trim().min(3).max(200),
});
const downloadOutput = z.object({ fileName: z.string(), mime: z.string(), base64: z.string() });
const downloadMine = withPermission('doc.vault.own')
  .route({
    method: 'GET',
    path: '/documents/mine/{id}/content',
    summary: 'Download my document (DOC-02)',
  })
  .input(downloadInput)
  .output(downloadOutput)
  .handler(({ input, context }) =>
    downloadFile(
      context,
      input,
      { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
      true,
    ),
  );
const downloadManaged = withPermission('doc.vault.manage')
  .route({
    method: 'GET',
    path: '/documents/{id}/content',
    summary: 'Download an in-scope document; identity class needs field permission',
  })
  .input(downloadInput)
  .output(downloadOutput)
  .handler(({ input, context }) =>
    downloadFile(
      context,
      input,
      { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
      false,
    ),
  );
export const documentsRouter = {
  managedTypes,
  types,
  mine,
  managed,
  uploadMine,
  uploadManaged,
  downloadMine,
  downloadManaged,
};
