/**
 * Audit query service — ONE query, used by both the on-screen list and the
 * Excel export. Two copies of these filters would eventually disagree, and an
 * export that disagrees with the screen is worse than no export at all.
 */
import { sql, type Kysely, type SqlBool } from 'kysely';
import type { Database } from '../../core/db/types.js';
import type { PermissionAccess } from '../../core/rbac/permissions.service.js';

export interface AuditQuery {
  entity?: string | undefined;
  action?: string | undefined;
  actorUserId?: number | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  search?: string | undefined;
  limit: number;
  offset: number;
}

export interface AuditEntry {
  id: number;
  at: string;
  actorUserId: number | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  ip: string | null;
}

/** CORE-10: legacy/global rows have no org scope and therefore fail closed. */
export function auditScopeSql(access: PermissionAccess) {
  if (access.all) return sql<SqlBool>`TRUE`;
  if (access.orgUnitIds.length === 0) return sql<SqlBool>`FALSE`;
  return sql<SqlBool>`scope_org_unit_id IN (${sql.join(access.orgUnitIds)})`;
}

export async function listAuditPage(
  db: Kysely<Database>,
  input: AuditQuery,
  access: PermissionAccess,
): Promise<{ rows: AuditEntry[]; total: number; limit: number; offset: number }> {
  // One filter definition, applied identically to the count and the page — a
  // total that disagreed with the rows would make the viewer untrustworthy.
  const filtered = db
    .selectFrom('core.audit_log')
    .where(auditScopeSql(access))
    .$if(input.entity !== undefined, (qb) => qb.where('entity', '=', input.entity ?? ''))
    .$if(input.action !== undefined, (qb) => qb.where('action', '=', input.action ?? ''))
    .$if(input.actorUserId !== undefined, (qb) => qb.where('actor_user_id', '=', input.actorUserId ?? 0))
    .$if(input.fromDate !== undefined, (qb) => qb.where(sql<SqlBool>`at >= ${input.fromDate ?? ''}::date`))
    .$if(input.toDate !== undefined, (qb) =>
      qb.where(sql<SqlBool>`at < (${input.toDate ?? ''}::date + INTERVAL '1 day')`),
    )
    .$if(input.search !== undefined && input.search.trim() !== '', (qb) => {
      const term = `%${(input.search ?? '').trim().toLowerCase()}%`;
      return qb.where(
        sql<SqlBool>`(lower(entity) LIKE ${term} OR lower(action) LIKE ${term} OR lower(coalesce(field, '')) LIKE ${term})`,
      );
    });

  const counted = await filtered.select((eb) => eb.fn.countAll<string>().as('n')).executeTakeFirst();

  const rows = await filtered
    .select([
      'id',
      'actor_user_id',
      'action',
      'entity',
      'entity_id',
      'field',
      'old_value',
      'new_value',
      'ip',
      // Formatted in SQL: the filter chain widens `at` to its ColumnType, and
      // an ISO string is what the wire contract promises anyway.
      sql<string>`to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`.as('at_iso'),
    ])
    .orderBy('id', 'desc')
    .limit(input.limit)
    .offset(input.offset)
    .execute();

  // Resolve actor labels for just this page (bounded, so no N+1).
  const actorIds = [...new Set(rows.flatMap((r) => (r.actor_user_id === null ? [] : [r.actor_user_id])))];
  const actors =
    actorIds.length === 0
      ? []
      : await db.selectFrom('core.users').select(['id', 'email']).where('id', 'in', actorIds).execute();
  const actorById = new Map(actors.map((a) => [a.id, a.email]));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      at: r.at_iso,
      actorUserId: r.actor_user_id,
      actorName: r.actor_user_id === null ? null : (actorById.get(r.actor_user_id) ?? null),
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      ip: r.ip,
    })),
    total: Number(counted?.n ?? 0),
    limit: input.limit,
    offset: input.offset,
  };
}
