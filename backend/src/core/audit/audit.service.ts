/**
 * Audit service — the ONLY way the app writes audit rows (CORE-11, doc 14 §7.4).
 * The hash chain itself is computed by the DB trigger; verification runs the
 * DB-side core.verify_audit_chain() so detection works even if app code lies.
 */
import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/types.js';

export interface AuditEntry {
  actorUserId?: number | null;
  action: string; // 'create'|'update'|'delete'|'login'|'login_failed'|'approve'|...
  entity: string; // 'core.users', 'core.settings', ...
  entityId?: number | null;
  field?: string | null;
  /** Sensitive values must be MASKED by the caller before they reach here. */
  oldValue?: string | null;
  newValue?: string | null;
  ip?: string | null;
}

export async function writeAudit(db: Kysely<Database>, entry: AuditEntry): Promise<void> {
  await db
    .insertInto('core.audit_log')
    .values({
      actor_user_id: entry.actorUserId ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      field: entry.field ?? null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
      ip: entry.ip ?? null,
    })
    .execute();
}

/** Recomputes the whole chain in the DB. Returns the first broken row id, or null if intact. */
export async function verifyAuditChain(db: Kysely<Database>): Promise<number | null> {
  const result = await sql<{ broken: number | null }>`
    SELECT core.verify_audit_chain() AS broken
  `.execute(db);
  return result.rows[0]?.broken ?? null;
}
