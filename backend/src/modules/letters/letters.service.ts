/**
 * Letters engine (CORE-09): template merge + issue.
 * Templates use {{field}} placeholders; merge_fields JSON lists required keys.
 * Show-cause / warning first (ATT-10); signature workflow can attach later.
 */
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { istDateString } from '../../core/dates.js';

type Db = Kysely<Database> | Transaction<Database>;

export function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => fields[key] ?? `{{${key}}}`);
}
export async function issueLetter(
  db: Db,
  params: {
    employeeId: number;
    templateCode: string;
    fields: Record<string, string>;
    actorUserId: number | null;
    workflowRequestId?: number | null | undefined;
  },
): Promise<{ id: number; bodyRendered: string }> {
  const tmpl = await db
    .selectFrom('core.letter_templates')
    .selectAll()
    .where('code', '=', params.templateCode)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (!tmpl) throw new Error(`Unknown letter template: ${params.templateCode}`);

  const required = Array.isArray(tmpl.merge_fields)
    ? (tmpl.merge_fields as string[])
    : typeof tmpl.merge_fields === 'string'
      ? (JSON.parse(tmpl.merge_fields) as string[])
      : [];
  for (const key of required) {
    if (params.fields[key] === undefined || params.fields[key] === '') {
      throw new Error(`Missing merge field: ${key}`);
    }
  }

  const bodyRendered = renderTemplate(tmpl.body_template, params.fields);
  const now = new Date();
  const path = `letters/${params.templateCode}/${String(params.employeeId)}-${istDateString()}.txt`;

  const doc = await db
    .insertInto('core.documents')
    .values({
      owner_employee_id: params.employeeId,
      kind: 'letter',
      path,
      original_name: `${params.templateCode}.txt`,
      mime: 'text/plain; charset=utf-8',
      size_bytes: Buffer.byteLength(bodyRendered, 'utf8'),
      uploaded_by: params.actorUserId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const letter = await db
    .insertInto('core.letters')
    .values({
      employee_id: params.employeeId,
      template_code: params.templateCode,
      document_id: doc.id,
      body_rendered: bodyRendered,
      status: 'issued',
      issued_by: params.actorUserId,
      issued_at: now,
      workflow_request_id: params.workflowRequestId ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await writeAudit(db, {
    actorUserId: params.actorUserId,
    action: 'create',
    entity: 'core.letters',
    entityId: letter.id,
    field: 'issue',
    newValue: `${params.templateCode} → emp ${String(params.employeeId)}`,
  });

  return { id: letter.id, bodyRendered };
}

export async function listEmployeeLetters(db: Kysely<Database>, employeeId: number) {
  return db
    .selectFrom('core.letters')
    .selectAll()
    .where('employee_id', '=', employeeId)
    .orderBy('issued_at', 'desc')
    .limit(100)
    .execute();
}

/** Helper: load employee display fields for merge. */
export async function employeeMergeFields(
  db: Db,
  employeeId: number,
): Promise<{ employee_name: string; ecode: string }> {
  const emp = await db
    .selectFrom('core.employees')
    .select(['ecode', 'first_name', 'last_name'])
    .where('id', '=', employeeId)
    .executeTakeFirstOrThrow();
  const employee_name = emp.last_name ? `${emp.first_name} ${emp.last_name}` : emp.first_name;
  return { employee_name, ecode: emp.ecode };
}
