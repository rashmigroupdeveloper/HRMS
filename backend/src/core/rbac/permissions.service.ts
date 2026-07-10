/**
 * THE central authorization check (CORE-10 — the user's centralization rule):
 *
 *   Every protected procedure declares ONE permission code. Whether a role
 *   holds that permission lives in the DATABASE (core.role_permissions),
 *   editable at runtime through the RBAC admin API — no deploy, no restart.
 *   Permissions are read per-request, so a grant/revoke takes effect on the
 *   very next call.
 */
import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';

/** Every permission the user currently holds, via their roles. */
export async function getUserPermissions(
  db: Kysely<Database>,
  userId: number,
): Promise<ReadonlySet<string>> {
  const rows = await db
    .selectFrom('core.user_roles as ur')
    .innerJoin('core.role_permissions as rp', 'rp.role_id', 'ur.role_id')
    .innerJoin('core.permissions as p', 'p.id', 'rp.permission_id')
    .where('ur.user_id', '=', userId)
    .select('p.code')
    .distinct()
    .execute();
  return new Set(rows.map((r) => r.code));
}

/** Every role CODE the user currently holds — for workflow role-queues (WF-01):
 *  any holder of a `role:<code>` step may act, not just one designated user. */
export async function getUserRoleCodes(db: Kysely<Database>, userId: number): Promise<ReadonlySet<string>> {
  const rows = await db
    .selectFrom('core.user_roles as ur')
    .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
    .where('ur.user_id', '=', userId)
    .select('r.code')
    .distinct()
    .execute();
  return new Set(rows.map((r) => r.code));
}

