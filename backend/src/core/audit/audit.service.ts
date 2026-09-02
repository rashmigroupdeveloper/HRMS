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
  /** Prefer this for employee-linked events whose entity_id is not the row PK. */
  subjectEmployeeId?: number | null;
  /** For org-wide events with no single employee. Captured historically. */
  scopeOrgUnitId?: number | null;
}

export async function writeAudit(db: Kysely<Database>, entry: AuditEntry): Promise<void> {
  const scopeOrgUnitId = await resolveAuditOrgUnitId(db, entry);
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
      scope_org_unit_id: scopeOrgUnitId,
    })
    .execute();
}

/**
 * Resolve the employee represented by the audited row. This catalog is kept
 * here because core.audit is the only write path; modules do not get to invent
 * their own scoping rules. Unknown/global entities deliberately resolve NULL,
 * which means org-scoped readers cannot see them (fail closed).
 */
async function inferSubjectEmployeeId(
  db: Kysely<Database>,
  entity: string,
  entityId: number | null,
): Promise<number | null> {
  if (entityId === null) return null;

  const result = await sql<{ employee_id: number | null }>`
    SELECT CASE ${entity}
      WHEN 'core.employees' THEN ${entityId}::bigint
      WHEN 'core.users' THEN (
        SELECT employee_id FROM core.users WHERE id = ${entityId}
      )
      -- RBAC handlers identify the affected user, not the user_roles row.
      WHEN 'core.user_roles' THEN (
        SELECT employee_id FROM core.users WHERE id = ${entityId}
      )
      WHEN 'wf.requests' THEN (
        SELECT subject_employee_id FROM wf.requests WHERE id = ${entityId}
      )
      WHEN 'core.letters' THEN (
        SELECT employee_id FROM core.letters WHERE id = ${entityId}
      )
      WHEN 'core.policy_acknowledgments' THEN (
        SELECT employee_id FROM core.policy_acknowledgments WHERE id = ${entityId}
      )
      WHEN 'att.absence_cases' THEN (
        SELECT employee_id FROM att.absence_cases WHERE id = ${entityId}
      )
      WHEN 'att.rosters' THEN (
        SELECT employee_id FROM att.rosters WHERE id = ${entityId}
      )
      WHEN 'att.day_records' THEN (
        SELECT employee_id FROM att.day_records WHERE id = ${entityId}
      )
      WHEN 'att.regularizations' THEN (
        SELECT employee_id FROM att.regularizations WHERE id = ${entityId}
      )
      WHEN 'att.overtime_entries' THEN (
        SELECT employee_id FROM att.overtime_entries WHERE id = ${entityId}
      )
      WHEN 'att.manager_month_approvals' THEN (
        SELECT manager_employee_id FROM att.manager_month_approvals WHERE id = ${entityId}
      )
      WHEN 'lv.ledger' THEN (
        SELECT employee_id FROM lv.ledger WHERE id = ${entityId}
      )
      WHEN 'lv.applications' THEN (
        SELECT employee_id FROM lv.applications WHERE id = ${entityId}
      )
      WHEN 'lv.rh_selections' THEN (
        SELECT employee_id FROM lv.rh_selections WHERE id = ${entityId}
      )
      WHEN 'ast.assignments' THEN (
        SELECT employee_id FROM ast.assignments WHERE id = ${entityId}
      )
      WHEN 'hd.tickets' THEN (
        SELECT u.employee_id
        FROM hd.tickets t
        JOIN core.users u ON u.id = t.raised_by
        WHERE t.id = ${entityId}
      )
      ELSE NULL::bigint
    END AS employee_id
  `.execute(db);
  return result.rows[0]?.employee_id ?? null;
}

async function resolveAuditOrgUnitId(
  db: Kysely<Database>,
  entry: AuditEntry,
): Promise<number | null> {
  if (entry.scopeOrgUnitId !== undefined) return entry.scopeOrgUnitId;

  const employeeId =
    entry.subjectEmployeeId !== undefined
      ? entry.subjectEmployeeId
      : await inferSubjectEmployeeId(db, entry.entity, entry.entityId ?? null);
  if (employeeId === null) return null;

  const employee = await db
    .selectFrom('core.employees')
    .select('org_unit_id')
    .where('id', '=', employeeId)
    .executeTakeFirst();
  return employee?.org_unit_id ?? null;
}

/** Recomputes the whole chain in the DB. Returns the first broken row id, or null if intact. */
export async function verifyAuditChain(db: Kysely<Database>): Promise<number | null> {
  const result = await sql<{ broken: number | null }>`
    SELECT core.verify_audit_chain() AS broken
  `.execute(db);
  return result.rows[0]?.broken ?? null;
}
