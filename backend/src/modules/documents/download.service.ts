/** DOC-02 / CORE-08: locked ownership and scoped field-class authority before bytes. */
import { ORPCError } from '@orpc/server';
import { sql } from 'kysely';
import { inTransaction } from '../../core/db/database.js';
import { assertEmployeesInScope } from '../../core/rbac/employee-scope.js';
import type { PermissionCode } from '../../core/rbac/seed-data.js';
import { getUserPermissionAccess } from '../../core/rbac/permissions.service.js';
import { readDocument } from '../../core/storage/index.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { getTypedSetting } from '../settings/index.js';
export async function downloadFile(
  context: {
    db: Parameters<typeof getTypedSetting>[0];
    user: { id: number; employee_id: number | null };
    res: { setHeader(name: string, value: string): unknown };
  },
  input: { id: number; purpose: string },
  scope: Parameters<typeof assertEmployeesInScope>[1],
  own: boolean,
) {
  return inTransaction(context.db, async (db) => {
    const initial = await db
      .selectFrom('core.documents')
      .select('owner_employee_id')
      .where('id', '=', input.id)
      .executeTakeFirst();
    if (!initial?.owner_employee_id)
      throw new ORPCError('NOT_FOUND', { message: 'Document not found' });
    // Employee first matches upload/lifecycle lock order. Re-read the document
    // under its own lock so an owner/status change cannot race authorization.
    await db
      .selectFrom('core.employees')
      .select('id')
      .where('id', '=', initial.owner_employee_id)
      .forShare()
      .executeTakeFirstOrThrow();
    const doc = await db
      .selectFrom('core.documents as d')
      .innerJoin('doc.types as t', (join) =>
        join.on('t.code', '=', sql<string>`coalesce(d.doc_type, d.kind)`),
      )
      .select(['d.id', 'd.owner_employee_id', 't.code as kind', 't.retention_class'])
      .where('d.id', '=', input.id)
      .where('d.owner_employee_id', '=', initial.owner_employee_id)
      .where('d.status', '=', 'active')
      .where('t.is_active', '=', true)
      .forShare('d')
      .executeTakeFirst();
    if (!doc?.owner_employee_id)
      throw new ORPCError('NOT_FOUND', { message: 'Document not found' });
    if (own && doc.owner_employee_id !== context.user.employee_id)
      throw new ORPCError('NOT_FOUND', { message: 'Document not found' });
    await assertEmployeesInScope(db, scope, [doc.owner_employee_id]);
    if (doc.owner_employee_id !== context.user.employee_id) {
      const sensitive = (
        await getTypedSetting(db, 'doc.identity_types', 'string', 'pan,aadhaar,uan,esic,bank')
      )
        .split(',')
        .map((code) => code.trim());
      const compensationTypes = (
        await getTypedSetting(db, 'doc.compensation_types', 'string', 'payslip')
      )
        .split(',')
        .map((code) => code.trim());
      const permissions = new Set<PermissionCode>();
      if (sensitive.includes(doc.kind) || doc.retention_class === 'statutory_id')
        permissions.add('employee.statutory_ids.read');
      if (doc.retention_class === 'health') permissions.add('employee.medical.read');
      if (compensationTypes.includes(doc.kind)) permissions.add('employee.compensation.read');
      for (const permission of permissions) {
        const access = await getUserPermissionAccess(db, context.user.id, permission, 'read');
        if (!access)
          throw new ORPCError('FORBIDDEN', {
            message: 'Your role cannot view this document class',
          });
        await assertEmployeesInScope(db, { ...access, actorEmployeeId: context.user.employee_id }, [
          doc.owner_employee_id,
        ]);
      }
    }
    const file = await readDocument(db, doc.id);
    await writeAudit(db, {
      actorUserId: context.user.id,
      action: 'read',
      entity: 'core.documents',
      entityId: doc.id,
      subjectEmployeeId: doc.owner_employee_id,
      field: doc.kind,
      newValue: input.purpose,
    });
    context.res.setHeader('Cache-Control', 'private, no-store');
    return {
      fileName: file.originalName,
      mime: file.mime,
      base64: file.content.toString('base64'),
    };
  });
}
