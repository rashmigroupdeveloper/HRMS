/**
 * DOC-01/02 — employee document vault service.
 *
 * Bytes go through `createDocument` / `readDocument` (the storage adapter).
 * Metadata rows are `core.documents` classified by `doc_type` (legacy vault rows fall back to `kind`).
 */
import { createHash } from 'node:crypto';
import { ORPCError } from '@orpc/server';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { writeAudit } from '../../core/audit/audit.service.js';
import { createDocument } from '../../core/storage/index.js';
import { getTypedSetting } from '../settings/index.js';
import { documentExpiry, parseAlertStages, type ExpiryView } from './expiry.js';
import { addDaysIso, istDateString } from '../../core/dates.js';
import { inTransaction } from '../../core/db/database.js';
import { employeeScopeSql, type EmployeeScope } from '../../core/rbac/employee-scope.js';

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
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
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

async function assertKnownType(db: Db, code: string, expiresOn: Date | null): Promise<void> {
  const found = await db
    .selectFrom('doc.types')
    .select(['code', 'typically_expires'])
    .where('code', '=', code)
    .where('is_active', '=', true)
    .executeTakeFirst();
  if (!found) {
    throw new ORPCError('BAD_REQUEST', { message: `Unknown document type: ${code}` });
  }
  if (found.typically_expires && expiresOn === null) {
    throw new ORPCError('BAD_REQUEST', { message: 'This document type requires an expiry date' });
  }
}

interface ListFilter {
  employeeId?: number | undefined;
  documentType?: string | undefined;
  needsAttentionOnly?: boolean | undefined;
  limit?: number;
  offset?: number;
}

/**
 * The HR vault list, narrowed to the caller's scope.
 *
 * `scope` is REQUIRED rather than optional: `doc.vault.manage` is granted to
 * hr_ops at org_unit scope (docs/08 §2), and an employee vault holds scanned
 * PAN and Aadhaar. Making the argument optional is how it came to be omitted.
 */
export async function listVaultDocuments(
  db: Db,
  filter: ListFilter,
  today: Date,
  stages: readonly number[],
  scope: EmployeeScope,
): Promise<VaultDocumentRow[]> {
  let query = db
    .selectFrom('core.documents as d')
    .innerJoin('doc.types as t', (join) =>
      join.on('t.code', '=', sql<string>`coalesce(d.doc_type, d.kind)`),
    )
    .leftJoin('core.employees as e', 'e.id', 'd.owner_employee_id')
    .select([
      'd.id',
      'd.owner_employee_id',
      't.code as document_type',
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
    .where('d.status', '!=', 'withdrawn')
    .where(employeeScopeSql(scope, 'e'));

  if (filter.employeeId !== undefined) {
    query = query.where('d.owner_employee_id', '=', filter.employeeId);
  }
  if (filter.documentType !== undefined) {
    query = query.where('t.code', '=', filter.documentType);
  }

  if (filter.needsAttentionOnly) {
    query = query.where(
      'd.expires_on',
      '<=',
      sql<Date>`${addDaysIso(istDateString(today), Math.max(...stages, 0))}::date`,
    );
  }

  const rows = await query
    .orderBy('d.created_at', 'desc')
    .orderBy('d.id', 'desc')
    .limit(filter.limit ?? 100)
    .offset(filter.offset ?? 0)
    .execute();

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
      documentType: row.document_type,
      typeName: row.type_name,
      originalName: row.original_name,
      mime: row.mime,
      sizeBytes: row.size_bytes,
      expiresOn: isoDate(row.expires_on),
      status: row.status,
      uploadedAt: row.created_at.toISOString(),
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
  return inTransaction(db, async (db) => {
    await assertKnownType(db, input.documentType, input.expiresOn);
    await db
      .selectFrom('core.employees')
      .select('id')
      .where('id', '=', input.employeeId)
      .forUpdate()
      .executeTakeFirstOrThrow();
    let identical = db
      .selectFrom('core.documents')
      .select('id')
      .where('owner_employee_id', '=', input.employeeId)
      .where(sql<string>`coalesce(doc_type, kind)`, '=', input.documentType)
      .where('status', '=', 'active')
      .where('sha256', '=', createHash('sha256').update(input.content).digest('hex'));
    identical =
      input.expiresOn === null
        ? identical.where('expires_on', 'is', null)
        : identical.where('expires_on', '=', input.expiresOn);
    const existing = await identical.executeTakeFirst();
    if (existing) return { id: existing.id };

    const id = await createDocument(db, {
      ownerEmployeeId: input.employeeId,
      kind: 'employee_document',
      documentType: input.documentType,
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
      }),
    });

    return { id };
  });
}
