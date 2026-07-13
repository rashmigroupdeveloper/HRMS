/**
 * Letters engine (CORE-09, PP-14): template + merge fields → rendered document
 * → 'letter_signature' approval chain → issued, archived on the employee, and
 * visible in ESS. A letter physically cannot reach an employee outside the
 * system: issuance IS the workflow's final approval.
 *
 * Merge fields are DECLARED on the template and validated at render time —
 * a letter with an unresolved {{field}} is a hard error, never a blank.
 */
import { type Kysely, type Selectable, type Transaction } from 'kysely';
import type { Database, LettersTable, LetterTemplatesTable } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { formatDbDate } from '../../core/dates.js';
import { createDocument } from '../../core/storage/index.js';
import { enqueue } from '../notifications/index.js';
import { createRequest, type RequestRow, type WorkflowFinalStatus } from '../workflows/index.js';

type Db = Kysely<Database> | Transaction<Database>;
export type LetterRow = Selectable<LettersTable>;
export type LetterTemplateRow = Selectable<LetterTemplatesTable>;

/** Fields the system can resolve from the employee record; anything else the
 *  template declares must arrive via extraFields. */
async function resolveEmployeeFields(db: Db, employeeId: number): Promise<Record<string, string>> {
  const e = await db
    .selectFrom('core.employees as e')
    .innerJoin('core.companies as c', 'c.id', 'e.company_id')
    .leftJoin('core.designations as dg', 'dg.id', 'e.designation_id')
    .leftJoin('core.departments as dp', 'dp.id', 'e.department_id')
    .where('e.id', '=', employeeId)
    .select(['e.ecode', 'e.first_name', 'e.last_name', 'e.doj', 'e.dol', 'e.confirmation_date', 'c.name as company', 'dg.name as designation', 'dp.name as department'])
    .executeTakeFirstOrThrow();

  const fields: Record<string, string> = {
    employee_name: e.last_name ? `${e.first_name} ${e.last_name}` : e.first_name,
    ecode: e.ecode,
    company: e.company,
  };
  if (e.designation) fields['designation'] = e.designation;
  if (e.department) fields['department'] = e.department;
  if (e.doj) fields['doj'] = formatDbDate(e.doj);
  if (e.dol) fields['dol'] = formatDbDate(e.dol);
  if (e.confirmation_date) fields['confirmation_date'] = formatDbDate(e.confirmation_date);
  return fields;
}

/** Substitute declared fields; any unresolved placeholder is a hard error. */
export function renderTemplate(body: string, declaredFields: string[], values: Record<string, string>): string {
  const missing = declaredFields.filter((f) => !values[f]);
  if (missing.length > 0) throw new Error(`Missing merge fields: ${missing.join(', ')}`);

  let rendered = body;
  for (const field of declaredFields) {
    rendered = rendered.replaceAll(`{{${field}}}`, values[field] ?? '');
  }
  const leftover = /\{\{\s*[\w.]+\s*\}\}/.exec(rendered);
  if (leftover) throw new Error(`Template uses an undeclared merge field: ${leftover[0]}`);
  return rendered;
}

export interface IssueLetterParams {
  employeeId: number;
  templateCode: string;
  extraFields?: Record<string, string> | undefined;
  requestedByUserId: number;
  /** false = administrative letters that skip the signature chain (none today). */
  requireSignature?: boolean | undefined;
}

/** Render → archive as a document → open the 'letter_signature' chain.
 *  issued_at stays NULL until the chain approves (the PP-14 guarantee). */
export async function issueLetter(
  db: Kysely<Database>,
  params: IssueLetterParams,
): Promise<{ letterId: number; documentId: number; workflowRequestId: number | null }> {
  const template = await db
    .selectFrom('core.letter_templates')
    .selectAll()
    .where('code', '=', params.templateCode)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (!template) throw new Error(`Unknown or inactive letter template: ${params.templateCode}`);

  const declared = (template.merge_fields as string[]).map(String);
  const values = { ...(await resolveEmployeeFields(db, params.employeeId)), ...(params.extraFields ?? {}) };
  const rendered = renderTemplate(template.body_template, declared, values);

  const html = `<!-- ${template.name} -->\n<article style="white-space:pre-wrap">${rendered}</article>\n`;
  const documentId = await createDocument(db, {
    ownerEmployeeId: params.employeeId,
    kind: 'letter',
    originalName: `${params.templateCode}-${values['ecode'] ?? params.employeeId}.html`,
    mime: 'text/html',
    content: html,
    uploadedBy: params.requestedByUserId,
  });

  const letter = await db
    .insertInto('core.letters')
    .values({
      employee_id: params.employeeId,
      template_code: params.templateCode,
      document_id: documentId,
      issued_by: params.requestedByUserId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  let workflowRequestId: number | null = null;
  if (params.requireSignature ?? true) {
    workflowRequestId = await createRequest(
      db,
      {
        definitionCode: 'letter_signature',
        subjectEmployeeId: params.employeeId,
        requestedByUserId: params.requestedByUserId,
        payload: { letterId: letter.id, templateCode: params.templateCode },
      },
      async (trx, requestId) => {
        await trx.updateTable('core.letters').set({ workflow_request_id: requestId }).where('id', '=', letter.id).execute();
      },
    );
  } else {
    await db.updateTable('core.letters').set({ issued_at: new Date() }).where('id', '=', letter.id).execute();
  }

  await writeAudit(db, {
    actorUserId: params.requestedByUserId,
    action: 'create',
    entity: 'core.letters',
    entityId: letter.id,
    field: params.templateCode,
    newValue: `employee:${params.employeeId} document:${documentId}`,
  });
  return { letterId: letter.id, documentId, workflowRequestId };
}

/** Completion hook ('letter_signature'): approval issues the letter and tells
 *  the employee; rejection leaves it a draft (the engine notifies the requester). */
export async function applyLetterOnFinal(db: Db, request: RequestRow, status: WorkflowFinalStatus): Promise<void> {
  const letter = await db
    .selectFrom('core.letters')
    .selectAll()
    .where('workflow_request_id', '=', request.id)
    .where('issued_at', 'is', null)
    .executeTakeFirst();
  if (!letter || status !== 'approved') return;

  await db.updateTable('core.letters').set({ issued_at: new Date() }).where('id', '=', letter.id).execute();
  const employeeUser = await db
    .selectFrom('core.users')
    .select('id')
    .where('employee_id', '=', letter.employee_id)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (employeeUser) {
    await enqueue(db, {
      recipientUserId: employeeUser.id,
      channel: 'in_app',
      templateCode: 'letter_issued',
      payload: { letterId: letter.id, templateCode: letter.template_code },
    });
  }
}

/** Letters on an employee record (ESS "my letters" and the HR profile view).
 *  Employees see only ISSUED letters; HR also sees drafts in the chain. */
export async function listLetters(db: Db, employeeId: number, includeDrafts: boolean): Promise<LetterRow[]> {
  let q = db.selectFrom('core.letters').selectAll().where('employee_id', '=', employeeId);
  if (!includeDrafts) q = q.where('issued_at', 'is not', null);
  return q.orderBy('id', 'desc').limit(200).execute();
}
