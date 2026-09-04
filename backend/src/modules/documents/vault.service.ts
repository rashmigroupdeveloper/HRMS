/**
 * DOC-01/02 — employee document vault service.
 *
 * Bytes go through `createDocument` / `readDocument` (SeaweedFS adapter).
 * Metadata rows are `core.documents` filtered to kinds in `doc.types`.
 */
import { ORPCError } from '@orpc/server';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { createDocument } from '../../core/storage/index.js';
import { getTypedSetting } from '../../core/settings/read.js';
import { documentExpiry, parseAlertStages, type ExpiryView } from './expiry.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface DocTypeRow {
  code: string;
  name: string;
  typicallyExpires: boolean;
  retentionClass: string | null;
  mandatoryFor: string;
  sortOrder: number;
}

export interface VaultDocumentRow {
  id: number;
  employeeId: number;
  ecode: string | null;
  employeeName: string | null;
  documentType: string;
  typeName: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  expiresOn: string | null;
  status: 'active' | 'superseded' | 'withdrawn';
  uploadedAt: string;
  expiry: ExpiryView;
}

function isoDate(value: Date | null): string | null {
  if (value === null) return null;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

function displayName(first: string | null, last: string | null): string | null {
  const parts = [first, last].filter((p): p is string => Boolean(p?.trim()));
  return parts.length > 0 ? parts.join(' ') : null;
}

/** One place reads the ladder so vault and licences alert on the same thresholds. */
export async function vaultAlertStages(db: Db): Promise<number[]> {
  const raw = await getTypedSetting(db, 'cmp.licence_alert_stages', 'string', '90,30,15,7');
  return parseAlertStages(raw);
}

export async function listDocTypes(db: Db): Promise<DocTypeRow[]> {
  const rows = await db
    .selectFrom('doc.types')
    .select(['code', 'name', 'typically_expires', 'retention_class', 'mandatory_for', 'sort_order'])
    .where('is_active', '=', true)
    .orderBy('sort_order', 'asc')
    .orderBy('code', 'asc')
    .execute();

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    typicallyExpires: row.typically_expires,
    retentionClass: row.retention_class,
    mandatoryFor: row.mandatory_for,
    sortOrder: row.sort_order,
  }));
}

async function assertKnownType(db: Db, code: string): Promise<void> {
  const found = await db
    .selectFrom('doc.types')
    .select('code')
    .where('code', '=', code)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (!found) {
    throw new ORPCError('BAD_REQUEST', { message: `Unknown document type: ${code}` });
  }
}

interface ListFilter {
  employeeId?: number;
  documentType?: string;
  needsAttentionOnly?: boolean;
}

export async function listVaultDocuments(
  db: Db,
  filter: ListFilter,
  today: Date,
  stages: readonly number[],
): Promise<VaultDocumentRow[]> {
  let query = db
    .selectFrom('core.documents as d')
    .innerJoin('doc.types as t', 't.code', 'd.kind')
    .leftJoin('core.employees as e', 'e.id', 'd.owner_employee_id')
    .select([
      'd.id',
      'd.owner_employee_id',
      'd.kind',
      'd.original_name',
      'd.mime',
      'd.size_bytes',
      'd.expires_on',
      'd.status',
      'd.created_at',
      't.name as type_name',
      'e.ecode',
      'e.first_name',
      'e.last_name',
    ])
    .where('t.is_active', '=', true)
    .where('d.owner_employee_id', 'is not', null)
    .where('d.status', '!=', 'withdrawn');

  if (filter.employeeId !== undefined) {
    query = query.where('d.owner_employee_id', '=', filter.employeeId);
  }
  if (filter.documentType !== undefined) {
    query = query.where('d.kind', '=', filter.documentType);
  }

  const rows = await query.orderBy('d.created_at', 'desc').execute();

  const mapped: VaultDocumentRow[] = [];
  for (const row of rows) {
    if (row.owner_employee_id === null) continue;
    const expiry = documentExpiry(row.expires_on, today, stages);
    if (
      filter.needsAttentionOnly === true &&
      expiry.state !== 'expiring' &&
      expiry.state !== 'expired'
    ) {
      continue;
    }
    mapped.push({
      id: row.id,
      employeeId: row.owner_employee_id,
      ecode: row.ecode,
      employeeName: displayName(row.first_name, row.last_name),
      documentType: row.kind,
      typeName: row.type_name,
      originalName: row.original_name,
      mime: row.mime,
      sizeBytes: row.size_bytes,
      expiresOn: isoDate(row.expires_on),
      status: row.status,
      uploadedAt: new Date(row.created_at as unknown as Date).toISOString(),
      expiry,
    });
  }
  return mapped;
}

export async function uploadVaultDocument(
  db: Db,
  input: {
    employeeId: number;
    documentType: string;
    originalName: string;
    mime: string;
    content: Buffer;
    expiresOn: Date | null;
    uploadedBy: number;
  },
): Promise<{ id: number }> {
  await assertKnownType(db, input.documentType);

  const id = await createDocument(db, {
    ownerEmployeeId: input.employeeId,
    kind: input.documentType,
    originalName: input.originalName,
    mime: input.mime,
    content: input.content,
    uploadedBy: input.uploadedBy,
    expiresOn: input.expiresOn,
    status: 'active',
  });

  await writeAudit(db, {
    actorUserId: input.uploadedBy,
    action: 'create',
    entity: 'core.documents',
    entityId: id,
    subjectEmployeeId: input.employeeId,
    field: input.documentType,
    newValue: JSON.stringify({
      expiresOn: input.expiresOn ? isoDate(input.expiresOn) : null,
      originalName: input.originalName,
    }),
  });

  return { id };
}
