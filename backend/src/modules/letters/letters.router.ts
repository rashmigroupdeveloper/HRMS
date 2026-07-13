/**
 * Letters API (CORE-09). Central gates:
 *   templates + issue + any-employee reads → letters.issue (HR)
 *   my issued letters + content            → employee.read (ESS; owner-checked)
 */
import { ORPCError } from '@orpc/server';
import { z } from 'zod';
import { withPermission } from '../../api/orpc.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { readDocument } from '../../core/storage/index.js';
import { issueLetter, listLetters, type LetterRow } from './letters.service.js';

function asBadRequest(err: unknown): never {
  throw new ORPCError('BAD_REQUEST', { message: err instanceof Error ? err.message : 'Invalid request' });
}

const letterShape = z.object({
  id: z.number(),
  templateCode: z.string(),
  documentId: z.number(),
  issuedAt: z.string().nullable(),
  workflowRequestId: z.number().nullable(),
});

function toDto(r: LetterRow): z.infer<typeof letterShape> {
  return {
    id: r.id,
    templateCode: r.template_code,
    documentId: r.document_id,
    issuedAt: r.issued_at?.toISOString() ?? null,
    workflowRequestId: r.workflow_request_id,
  };
}

const listTemplates = withPermission('letters.issue')
  .route({ method: 'GET', path: '/letters/templates', summary: 'Letter template catalog (CORE-09)' })
  .output(z.array(z.object({ code: z.string(), name: z.string(), mergeFields: z.array(z.string()), isActive: z.boolean() })))
  .handler(async ({ context }) => {
    const rows = await context.db.selectFrom('core.letter_templates').selectAll().orderBy('code').execute();
    return rows.map((t) => ({
      code: t.code,
      name: t.name,
      mergeFields: (t.merge_fields as string[]).map(String),
      isActive: t.is_active,
    }));
  });

const upsertTemplate = withPermission('letters.issue')
  .route({ method: 'PUT', path: '/letters/templates/{code}', summary: 'Create/update a template — body + fields are runtime data (audited)' })
  .input(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      bodyTemplate: z.string().min(1),
      mergeFields: z.array(z.string().min(1)).min(1),
      isActive: z.boolean().default(true),
    }),
  )
  .output(z.object({ ok: z.literal(true) }))
  .handler(async ({ input, context }) => {
    const values = {
      code: input.code,
      name: input.name,
      body_template: input.bodyTemplate,
      merge_fields: JSON.stringify(input.mergeFields),
      is_active: input.isActive,
    };
    await context.db
      .insertInto('core.letter_templates')
      .values(values)
      .onConflict((oc) => oc.column('code').doUpdateSet(values))
      .execute();
    await writeAudit(context.db, {
      actorUserId: context.user.id,
      action: 'update',
      entity: 'core.letter_templates',
      field: input.code,
      newValue: JSON.stringify(input),
      ip: context.req.ip ?? null,
    });
    return { ok: true as const };
  });

const issue = withPermission('letters.issue')
  .route({ method: 'POST', path: '/letters/issue', summary: 'Render + route a letter through the signature chain (PP-14)' })
  .input(
    z.object({
      employeeId: z.number().int().positive(),
      templateCode: z.string().min(1),
      extraFields: z.record(z.string(), z.string()).optional(),
    }),
  )
  .output(z.object({ letterId: z.number(), documentId: z.number(), workflowRequestId: z.number().nullable() }))
  .handler(async ({ input, context }) => {
    try {
      return await issueLetter(context.db, {
        employeeId: input.employeeId,
        templateCode: input.templateCode,
        extraFields: input.extraFields,
        requestedByUserId: context.user.id,
      });
    } catch (err) {
      asBadRequest(err);
    }
  });

const myLetters = withPermission('employee.read')
  .route({ method: 'GET', path: '/letters/mine', summary: 'My issued letters (ESS)' })
  .output(z.array(letterShape))
  .handler(async ({ context }) => {
    if (context.user.employee_id === null) return [];
    return (await listLetters(context.db, context.user.employee_id, false)).map(toDto);
  });

const employeeLetters = withPermission('letters.issue')
  .route({ method: 'GET', path: '/letters/employee/{employeeId}', summary: 'All letters on an employee record, drafts included (HR)' })
  .input(z.object({ employeeId: z.coerce.number().int().positive() }))
  .output(z.array(letterShape))
  .handler(async ({ input, context }) => (await listLetters(context.db, input.employeeId, true)).map(toDto));

const letterContent = withPermission('employee.read')
  .route({ method: 'GET', path: '/letters/{id}/content', summary: 'Rendered letter body (owner, or any holder of letters.issue)' })
  .input(z.object({ id: z.coerce.number().int().positive() }))
  .output(z.object({ mime: z.string(), fileName: z.string(), content: z.string() }))
  .handler(async ({ input, context }) => {
    const letter = await context.db.selectFrom('core.letters').selectAll().where('id', '=', input.id).executeTakeFirst();
    if (!letter) throw new ORPCError('NOT_FOUND', { message: 'No such letter' });
    // Owner sees own ISSUED letters; drafts and other employees' letters need
    // the letters.issue PERMISSION (still the central grid, never a role check).
    const isOwner = context.user.employee_id !== null && context.user.employee_id === letter.employee_id && letter.issued_at !== null;
    if (!isOwner && !context.permissions.has('letters.issue')) {
      throw new ORPCError('FORBIDDEN', { message: 'Not your letter' });
    }
    const doc = await readDocument(context.db, letter.document_id);
    return { mime: doc.mime, fileName: doc.originalName, content: doc.content.toString('utf8') };
  });

export const lettersRouter = { listTemplates, upsertTemplate, issue, myLetters, employeeLetters, letterContent };
