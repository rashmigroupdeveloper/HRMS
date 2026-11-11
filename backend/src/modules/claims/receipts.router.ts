import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { assertEmployeesInScope, type EmployeeScope } from '../../core/rbac/employee-scope.js';
/** CLM-02: real receipt upload, owned by the authenticated employee. */
import { z } from 'zod';
import { authed, withPermission } from '../../api/orpc.js';
import { DomainError, NotFoundError } from '../../core/errors/index.js';
import { createDocument, readDocument } from '../../core/storage/documents.js';
import { writeAudit } from '../../core/audit/audit.service.js';
const file = z.object({ filename: z.string(), mime: z.string(), base64: z.string() });
export const claimReceiptsRouter = {
  ownReceipt: authed
    .route({
      method: 'GET',
      path: '/claims/me/receipts/{id}',
      summary: 'Read my submitted receipt, audited',
    })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(file)
    .handler(({ input, context }) =>
      downloadReceipt(context.db, input.id, context.user.id, context.user.employee_id),
    ),
  reviewReceipt: withPermission('claims.approve', 'read')
    .route({
      method: 'GET',
      path: '/claims/receipts/{id}',
      summary: 'Read a scoped claim receipt for bill verification, audited',
    })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(file)
    .handler(({ input, context }) =>
      downloadReceipt(context.db, input.id, context.user.id, null, {
        ...context.permissionAccess,
        actorEmployeeId: context.user.employee_id,
      }),
    ),
  uploadReceipt: authed
    .route({
      method: 'POST',
      path: '/claims/receipts',
      summary: 'Upload my reimbursement receipt (PDF/JPEG/PNG, up to5MB)',
    })
    .input(
      z.object({
        filename: z.string().trim().min(1).max(200),
        base64: z.string().min(1).max(7_000_000),
      }),
    )
    .output(z.object({ documentId: z.number() }))
    .handler(async ({ input, context }) => {
      const employeeId = context.user.employee_id;
      if (employeeId === null) throw new NotFoundError('No employee profile is linked');
      const content = Buffer.from(input.base64, 'base64');
      if (content.length === 0 || content.length > 5 * 1024 * 1024)
        throw new DomainError('Receipt must be between1byte and5MB');
      const ext = /\.(pdf|jpe?g|png)$/i.exec(input.filename)?.[1]?.toLowerCase();
      const mime =
        ext === 'pdf' && content.subarray(0, 5).toString() === '%PDF-'
          ? 'application/pdf'
          : ext === 'png' && content.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
            ? 'image/png'
            : (ext === 'jpg' || ext === 'jpeg') &&
                content.subarray(0, 3).toString('hex') === 'ffd8ff'
              ? 'image/jpeg'
              : null;
      if (!mime)
        throw new DomainError('Attach a PDF, JPEG or PNG receipt with a matching file format');
      const documentId = await createDocument(context.db, {
        ownerEmployeeId: employeeId,
        kind: 'claim_bill',
        originalName: input.filename,
        mime,
        content,
        uploadedBy: context.user.id,
      });
      await writeAudit(context.db, {
        actorUserId: context.user.id,
        subjectEmployeeId: employeeId,
        action: 'claim_receipt_uploaded',
        entity: 'core.documents',
        entityId: documentId,
        newValue: 'Reimbursement receipt',
      });
      return { documentId };
    }),
};

async function downloadReceipt(
  db: Kysely<Database>,
  billId: number,
  userId: number,
  ownId: number | null,
  scope?: EmployeeScope,
) {
  const row = await db
    .selectFrom('pay.claim_bills as b')
    .innerJoin('pay.claims as c', 'c.id', 'b.claim_id')
    .select(['c.employee_id', 'b.document_id'])
    .where('b.id', '=', billId)
    .executeTakeFirst();
  if (!row) throw new NotFoundError('Receipt not found');
  if (scope) await assertEmployeesInScope(db, scope, [row.employee_id]);
  else if (ownId === null || row.employee_id !== ownId)
    throw new NotFoundError('Receipt not found');
  const doc = await db
    .selectFrom('core.documents')
    .select('id')
    .where('id', '=', row.document_id)
    .where('owner_employee_id', '=', row.employee_id)
    .where('kind', '=', 'claim_bill')
    .where('status', '=', 'active')
    .executeTakeFirst();
  if (!doc) throw new NotFoundError('Active employee-owned receipt not found');
  await writeAudit(db, {
    actorUserId: userId,
    subjectEmployeeId: row.employee_id,
    action: 'claim_receipt_read',
    entity: 'core.documents',
    entityId: doc.id,
    newValue: 'Reimbursement bill review',
  });
  const content = await readDocument(db, doc.id);
  return {
    filename: content.originalName,
    mime: content.mime,
    base64: content.content.toString('base64'),
  };
}
