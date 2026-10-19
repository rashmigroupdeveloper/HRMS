/** LC-01: write the joining grids onto the employee. Medical stays in med.*, never on the profile managers read. */
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../../../core/db/types.js';
import { DomainError } from '../../../core/errors/index.js';
import { createDocument } from '../../../core/storage/documents.js';
import { writeAudit } from '../../../core/audit/audit.service.js';
import {
  joiningPackSchema,
  type JoiningAddress,
  type JoiningPack,
} from './joining-pack.schema.js';

type Db = Kysely<Database> | Transaction<Database>;

function addressLine(address: JoiningAddress): string {
  return [address.house, address.locality, address.city, address.district, address.stateCode, address.pin].filter(Boolean).join(', ');
}

function bytesOf(content: string, mime: string): Buffer {
  const bytes = Buffer.from(content, 'base64');
  if (!bytes.length || bytes.toString('base64') !== content) throw new DomainError('A joining document is not valid base64');
  const ok = mime === 'application/pdf'
    ? bytes.subarray(0, 5).toString() === '%PDF-'
    : mime === 'image/png'
      ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
      : bytes.subarray(0, 3).toString('hex') === 'ffd8ff';
  if (!ok) throw new DomainError('A joining document must be a PDF, PNG or JPEG');
  return bytes;
}

async function upsertAddress(db: Db, employeeId: number, kind: 'present' | 'permanent', address: JoiningAddress): Promise<void> {
  const values = {
    house: address.house,
    locality: address.locality ?? null,
    city: address.city,
    district: address.district,
    state_code: address.stateCode,
    pin: address.pin,
  };
  const existing = await db.selectFrom('core.employee_addresses').select('id').where('employee_id', '=', employeeId).where('kind', '=', kind).executeTakeFirst();
  if (existing) {
    await db.updateTable('core.employee_addresses').set(values).where('id', '=', existing.id).execute();
  } else {
    await db.insertInto('core.employee_addresses').values({ employee_id: employeeId, kind, ...values }).execute();
  }
}

async function replaceEducation(db: Db, employeeId: number, rows: NonNullable<JoiningPack['education']>): Promise<void> {
  await db.deleteFrom('core.employee_education').where('employee_id', '=', employeeId).execute();
  if (rows.length === 0) return;
  await db.insertInto('core.employee_education').values(rows.map((row, index) => ({
    employee_id: employeeId,
    qualification: row.qualification,
    institute: row.institute,
    year_of_passing: row.yearOfPassing ?? null,
    sort_order: index,
  }))).execute();
}

async function replaceFamily(db: Db, employeeId: number, rows: NonNullable<JoiningPack['family']>): Promise<void> {
  await db.deleteFrom('core.employee_family').where('employee_id', '=', employeeId).execute();
  if (rows.length === 0) return;
  await db.insertInto('core.employee_family').values(rows.map((row) => ({
    employee_id: employeeId,
    name: row.name,
    relation: row.relation,
    gender: row.gender ?? null,
    dob: row.dob ?? null,
  }))).execute();
}

async function replaceNominations(db: Db, employeeId: number, rows: NonNullable<JoiningPack['nominations']>, actorUserId: number | null): Promise<void> {
  const current = await db.selectFrom('core.employee_nominations').select(['scheme', 'version']).where('employee_id', '=', employeeId).execute();
  const next = new Map<string, number>();
  for (const row of current) next.set(row.scheme, Math.max(next.get(row.scheme) ?? 0, row.version));
  await db.updateTable('core.employee_nominations').set({ status: 'superseded' }).where('employee_id', '=', employeeId).where('status', '=', 'active').execute();
  if (rows.length === 0) return;
  const versionByScheme = new Map<string, number>();
  await db.insertInto('core.employee_nominations').values(rows.map((row) => {
    const version = versionByScheme.get(row.scheme) ?? (next.get(row.scheme) ?? 0) + 1;
    versionByScheme.set(row.scheme, version);
    return {
      employee_id: employeeId,
      scheme: row.scheme,
      version,
      nominee_name: row.nomineeName,
      relation: row.relation,
      address: row.address,
      share_pct: row.sharePct.toFixed(2),
      created_by: actorUserId,
    };
  })).execute();
}

async function writeMedical(db: Db, employeeId: number, notes: string, actorUserId: number | null, signedName: string): Promise<void> {
  const text = await db.selectFrom('prv.declaration_texts').select(['id', 'version', 'sha256', 'kind'])
    .where('kind', '=', 'medical_consent').where('is_current', '=', true).executeTakeFirst();
  if (!text) throw new DomainError('Medical consent text is not configured');
  const existing = await db.selectFrom('med.questionnaires').select('id').where('employee_id', '=', employeeId).where('status', '=', 'active').executeTakeFirst();
  if (existing) {
    await db.updateTable('med.questionnaires').set({ answers: JSON.stringify({ notes }) }).where('id', '=', existing.id).execute();
    await db.insertInto('med.access_log').values({ questionnaire_id: existing.id, employee_id: employeeId, actor_user_id: actorUserId, action: 'write', reason: 'joining pack' }).execute();
    return;
  }
  const consent = await db.insertInto('prv.declarations').values({
    text_id: text.id,
    kind: text.kind,
    text_version: text.version,
    text_sha256: text.sha256,
    employee_id: employeeId,
    actor_user_id: actorUserId,
    accepted: true,
    signature_kind: 'typed',
    signed_name: signedName,
  }).returning('id').executeTakeFirstOrThrow();
  const saved = await db.insertInto('med.questionnaires').values({
    employee_id: employeeId,
    consent_declaration_id: consent.id,
    answers: JSON.stringify({ notes }),
    submitted_by_user_id: actorUserId,
  }).returning('id').executeTakeFirstOrThrow();
  await db.insertInto('med.access_log').values({ questionnaire_id: saved.id, employee_id: employeeId, actor_user_id: actorUserId, action: 'write', reason: 'joining pack' }).execute();
}

/** Persist grids for an employee who already exists (walk-in or conversion). */
export async function saveJoiningPack(db: Db, employeeId: number, raw: JoiningPack, actorUserId: number | null): Promise<void> {
  const pack = joiningPackSchema.parse(raw);
  const employee = await db.selectFrom('core.employees').select(['id', 'first_name', 'last_name']).where('id', '=', employeeId).executeTakeFirst();
  if (!employee) throw new DomainError('Employee not found');
  const patch: { gender?: 'Male' | 'Female' | 'Transgender'; father_name?: string | null; present_address?: string; permanent_address?: string } = {};
  if (pack.gender) patch.gender = pack.gender;
  if (pack.fatherName) patch.father_name = pack.fatherName;
  if (pack.present) {
    await upsertAddress(db, employeeId, 'present', pack.present);
    patch.present_address = addressLine(pack.present);
  }
  const permanent = pack.sameAsPresent ? pack.present : pack.permanent;
  if (permanent) {
    await upsertAddress(db, employeeId, 'permanent', permanent);
    patch.permanent_address = addressLine(permanent);
  }
  if (Object.keys(patch).length > 0) await db.updateTable('core.employees').set(patch).where('id', '=', employeeId).execute();
  if (pack.education) await replaceEducation(db, employeeId, pack.education);
  if (pack.family) await replaceFamily(db, employeeId, pack.family);
  if (pack.nominations) await replaceNominations(db, employeeId, pack.nominations, actorUserId);
  if (pack.documents) {
    for (const file of pack.documents) {
      const id = await createDocument(db, {
        ownerEmployeeId: employeeId,
        kind: 'joining',
        documentType: file.documentType,
        originalName: file.fileName,
        mime: file.mime,
        content: bytesOf(file.content, file.mime),
        uploadedBy: actorUserId,
      });
      await db.updateTable('core.documents').set({ doc_type: file.documentType }).where('id', '=', id).execute();
    }
  }
  if (pack.medicalNotes) {
    await writeMedical(db, employeeId, pack.medicalNotes, actorUserId, `${employee.first_name} ${employee.last_name ?? ''}`.trim());
  }
  await writeAudit(db, {
    actorUserId,
    action: 'update',
    entity: 'core.employees',
    entityId: employeeId,
    newValue: JSON.stringify({ joiningPack: true, medical: Boolean(pack.medicalNotes) }),
  });
}

/** Candidate upload before an employee exists. Bytes are not copied into the application JSON. */
export async function storeCandidateDocuments(
  db: Db,
  candidateId: number,
  signedName: string,
  documents: JoiningPack['documents'],
  medicalNotes: string | undefined,
): Promise<void> {
  for (const file of documents ?? []) {
    const id = await createDocument(db, {
      ownerEmployeeId: null,
      kind: 'joining',
      documentType: file.documentType,
      originalName: file.fileName,
      mime: file.mime,
      content: bytesOf(file.content, file.mime),
      uploadedBy: null,
    });
    await db.updateTable('core.documents').set({ candidate_id: candidateId, doc_type: file.documentType }).where('id', '=', id).execute();
  }
  if (!medicalNotes) return;
  const text = await db.selectFrom('prv.declaration_texts').select(['id', 'version', 'sha256', 'kind'])
    .where('kind', '=', 'medical_consent').where('is_current', '=', true).executeTakeFirst();
  if (!text) throw new DomainError('Medical consent text is not configured');
  const consent = await db.insertInto('prv.declarations').values({
    text_id: text.id, kind: text.kind, text_version: text.version, text_sha256: text.sha256,
    candidate_id: candidateId, accepted: true, signature_kind: 'typed', signed_name: signedName,
  }).returning('id').executeTakeFirstOrThrow();
  await db.insertInto('med.questionnaires').values({
    candidate_id: candidateId,
    consent_declaration_id: consent.id,
    answers: JSON.stringify({ notes: medicalNotes }),
  }).execute();
}

/** Move candidate files and the medical questionnaire onto the new employee, then write the grids. */
export async function applyPrejoinPack(
  db: Db,
  employeeId: number,
  candidateId: number,
  pack: JoiningPack,
  actorUserId: number,
): Promise<void> {
  await db.updateTable('core.documents').set({ owner_employee_id: employeeId }).where('candidate_id', '=', candidateId).where('owner_employee_id', 'is', null).execute();
  await db.updateTable('med.questionnaires').set({ employee_id: employeeId }).where('candidate_id', '=', candidateId).where('employee_id', 'is', null).execute();
  const { documents, medicalNotes, ...grids } = pack;
  await saveJoiningPack(db, employeeId, { ...grids, documents: undefined, medicalNotes: undefined }, actorUserId);
  void documents;
  void medicalNotes;
}

export async function readMedicalNotes(db: Db, employeeId: number, actorUserId: number | null): Promise<string | null> {
  const row = await db.selectFrom('med.questionnaires').select(['id', 'answers']).where('employee_id', '=', employeeId).where('status', '=', 'active').executeTakeFirst();
  await db.insertInto('med.access_log').values({
    questionnaire_id: row?.id ?? null,
    employee_id: employeeId,
    actor_user_id: actorUserId,
    action: row ? 'read' : 'denied',
    reason: 'joining pack',
  }).execute();
  if (!row) return null;
  const answers = typeof row.answers === 'string' ? JSON.parse(row.answers) as { notes?: string } : row.answers as { notes?: string };
  return answers.notes ?? null;
}
