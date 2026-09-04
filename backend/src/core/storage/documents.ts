/**
 * core.documents — the single file registry (docs/03 §3): every stored file is
 * one row (metadata) + one object (bytes) behind the StorageAdapter.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../db/types.js';
import { getStorage } from './storage.js';

type Db = Kysely<Database> | Transaction<Database>;

export interface CreateDocumentInput {
  ownerEmployeeId: number | null;
  kind: string; // 'letter' | 'policy' | 'payslip' | vault types from doc.types (docs/03 §3)
  originalName: string;
  mime: string;
  content: Buffer | string;
  uploadedBy: number | null;
  /** Vault DOC-03 — omit/null for perpetual kinds (PAN, appointment). */
  expiresOn?: Date | null;
  /** Vault lifecycle; letters/policies leave the DB default (`active`). */
  status?: 'active' | 'superseded' | 'withdrawn';
}

/** Store bytes + register the row; returns the document id. */
export async function createDocument(db: Db, input: CreateDocumentInput): Promise<number> {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const ext = path.extname(input.originalName) || '.bin';
  const key = `${input.kind}/${yyyy}/${mm}/${randomUUID()}${ext}`;

  await getStorage().put(key, input.content);
  const row = await db
    .insertInto('core.documents')
    .values({
      owner_employee_id: input.ownerEmployeeId,
      kind: input.kind,
      path: key,
      original_name: input.originalName,
      mime: input.mime,
      size_bytes: Buffer.byteLength(input.content),
      uploaded_by: input.uploadedBy,
      expires_on: input.expiresOn === undefined ? null : input.expiresOn,
      ...(input.status === undefined ? {} : { status: input.status }),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Fetch a document's bytes by id (metadata row + object). */
export async function readDocument(db: Db, documentId: number): Promise<{ mime: string; originalName: string; content: Buffer }> {
  const doc = await db.selectFrom('core.documents').selectAll().where('id', '=', documentId).executeTakeFirstOrThrow();
  return { mime: doc.mime, originalName: doc.original_name, content: await getStorage().get(doc.path) };
}
