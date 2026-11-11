/** PAY-13, CORE-10/11: scoped payroll proof review, without exposing the document vault. */
import { z } from 'zod';
import { withPermission } from '../../../api/orpc.js';
import { employeeScopeSql, assertEmployeesInScope } from '../../../core/rbac/employee-scope.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import { readDocument } from '../../../core/storage/documents.js';
import { NotFoundError } from '../../../core/errors/index.js';
const fy = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine(
    (v) => (Number(v.slice(0, 4)) + 1) % 100 === Number(v.slice(5)),
    'Choose a valid financial year',
  );
export const declarationReviewRouter = {
  list: withPermission('payroll.run.view', 'read')
    .route({
      method: 'GET',
      path: '/payroll/declarations',
      summary: 'Scoped investment proof verification queue',
    })
    .input(
      z.object({
        fy,
        ecode: z.string().trim().max(40).optional(),
        offset: z.coerce.number().int().nonnegative().default(0),
      }),
    )
    .output(
      z.object({
        items: z.array(
          z.object({
            id: z.number(),
            employeeId: z.number(),
            ecode: z.string(),
            name: z.string(),
            section: z.string(),
            declaredPaise: z.number().int(),
            verifiedPaise: z.number().int().nullable(),
            proofDocumentId: z.number().nullable(),
            verified: z.boolean(),
          }),
        ),
        hasMore: z.boolean(),
      }),
    )
    .handler(async ({ input, context }) => {
      let q = context.db
        .selectFrom('pay.investment_declarations as d')
        .innerJoin('core.employees as e', 'e.id', 'd.employee_id')
        .select([
          'd.id',
          'd.employee_id',
          'e.ecode',
          'e.first_name',
          'e.last_name',
          'd.section',
          'd.declared_amount',
          'd.verified_amount',
          'd.proof_document_id',
          'd.verified_at',
        ])
        .where('d.fy', '=', input.fy)
        .where(
          employeeScopeSql(
            { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
            'e',
          ),
        );
      if (input.ecode) q = q.where('e.ecode', 'ilike', `${input.ecode}%`);
      const rows = await q
        .orderBy('e.ecode')
        .orderBy('d.id')
        .offset(input.offset)
        .limit(51)
        .execute();
      return {
        items: rows
          .slice(0, 50)
          .map((r) => ({
            id: r.id,
            employeeId: r.employee_id,
            ecode: r.ecode,
            name: [r.first_name, r.last_name].filter(Boolean).join(' '),
            section: r.section,
            declaredPaise: Math.round(Number(r.declared_amount) * 100),
            verifiedPaise:
              r.verified_amount === null ? null : Math.round(Number(r.verified_amount) * 100),
            proofDocumentId: r.proof_document_id,
            verified: r.verified_at !== null,
          })),
        hasMore: rows.length > 50,
      };
    }),
  proof: withPermission('payroll.run.view', 'read')
    .route({
      method: 'GET',
      path: '/payroll/declarations/{id}/proof',
      summary: 'Read the scoped declaration proof, audited',
    })
    .input(z.object({ id: z.coerce.number().int().positive() }))
    .output(z.object({ filename: z.string(), mime: z.string(), base64: z.string() }))
    .handler(async ({ input, context }) => {
      const row = await context.db
        .selectFrom('pay.investment_declarations')
        .select(['employee_id', 'proof_document_id'])
        .where('id', '=', input.id)
        .executeTakeFirst();
      if (!row) throw new NotFoundError('Declaration not found');
      await assertEmployeesInScope(
        context.db,
        { ...context.permissionAccess, actorEmployeeId: context.user.employee_id },
        [row.employee_id],
      );
      const proof =
        row.proof_document_id === null
          ? undefined
          : await context.db
              .selectFrom('core.documents')
              .select('id')
              .where('id', '=', row.proof_document_id)
              .where('owner_employee_id', '=', row.employee_id)
              .where('kind', '=', 'tax_proof')
              .where('status', '=', 'active')
              .executeTakeFirst();
      if (!proof) throw new NotFoundError('No active employee-owned tax proof is attached');
      await writeAudit(context.db, {
        actorUserId: context.user.id,
        subjectEmployeeId: row.employee_id,
        action: 'tax_proof_read',
        entity: 'core.documents',
        entityId: proof.id,
        newValue: 'Payroll investment verification',
      });
      const doc = await readDocument(context.db, proof.id);
      return { filename: doc.originalName, mime: doc.mime, base64: doc.content.toString('base64') };
    }),
};
