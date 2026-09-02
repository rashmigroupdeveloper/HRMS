/** All database access for the RBAC admin module. */
import { sql, type Kysely, type SqlBool } from 'kysely';
import type { Database } from '../../core/db/types.js';

export function listRoles(db: Kysely<Database>) {
  return db.selectFrom('core.roles').select(['id', 'code', 'name']).orderBy('code').execute();
}

export function listPermissions(db: Kysely<Database>) {
  return db.selectFrom('core.permissions').select(['id', 'code']).orderBy('code').execute();
}

/** The full role×permission grid — the admin access matrix (PI-ESS-2). */
export function listGrants(db: Kysely<Database>) {
  return db
    .selectFrom('core.role_permissions as rp')
    .innerJoin('core.roles as r', 'r.id', 'rp.role_id')
    .innerJoin('core.permissions as p', 'p.id', 'rp.permission_id')
    .select(['r.code as role', 'p.code as permission', 'rp.scope'])
    .orderBy('r.code')
    .orderBy('p.code')
    .execute();
}

export async function findRoleByCode(db: Kysely<Database>, code: string) {
  return db.selectFrom('core.roles').select(['id', 'code']).where('code', '=', code).executeTakeFirst();
}

export async function findPermissionByCode(db: Kysely<Database>, code: string) {
  return db.selectFrom('core.permissions').select(['id', 'code']).where('code', '=', code).executeTakeFirst();
}

export async function insertGrant(
  db: Kysely<Database>,
  roleId: number,
  permissionId: number,
  scope: 'all' | 'subtree' | 'own' | 'org_unit' | 'readonly',
): Promise<boolean> {
  const res = await db
    .insertInto('core.role_permissions')
    .values({ role_id: roleId, permission_id: permissionId, scope })
    .onConflict((oc) =>
      oc.columns(['role_id', 'permission_id']).doUpdateSet({ scope }),
    )
    .executeTakeFirst();
  return (res.numInsertedOrUpdatedRows ?? 0n) > 0n;
}

export async function deleteGrant(db: Kysely<Database>, roleId: number, permissionId: number): Promise<boolean> {
  const res = await db
    .deleteFrom('core.role_permissions')
    .where('role_id', '=', roleId)
    .where('permission_id', '=', permissionId)
    .executeTakeFirst();
  return res.numDeletedRows > 0n;
}

export async function assignRoleToUser(
  db: Kysely<Database>,
  userId: number,
  roleId: number,
  scopeOrgUnitId: number | null,
): Promise<void> {
  await db
    .insertInto('core.user_roles')
    .values({ user_id: userId, role_id: roleId, scope_org_unit_id: scopeOrgUnitId })
    .onConflict((oc) => oc.columns(['user_id', 'role_id', 'scope_org_unit_id']).doNothing())
    .execute();
}

export async function removeRoleFromUser(db: Kysely<Database>, userId: number, roleId: number): Promise<boolean> {
  const res = await db
    .deleteFrom('core.user_roles')
    .where('user_id', '=', userId)
    .where('role_id', '=', roleId)
    .executeTakeFirst();
  return res.numDeletedRows > 0n;
}

/**
 * User search for the access-control console — resolves the employee behind
 * the login so an administrator picks a NAME, not a numeric id (a mis-typed
 * id silently grants the wrong person a role).
 * Bounded by `limit`; roles come back as an aggregated array to avoid N+1.
 */
export async function searchUsersWithRoles(
  db: Kysely<Database>,
  params: { q?: string | undefined; limit: number },
) {
  let query = db
    .selectFrom('core.users as u')
    .leftJoin('core.employees as e', 'e.id', 'u.employee_id')
    .select((eb) => [
      'u.id as user_id',
      'u.email',
      'u.is_active',
      'e.ecode',
      'e.first_name',
      'e.last_name',
      eb
        .selectFrom('core.user_roles as ur')
        .innerJoin('core.roles as r', 'r.id', 'ur.role_id')
        .select((inner) => inner.fn.jsonAgg('r.code').as('codes'))
        .whereRef('ur.user_id', '=', 'u.id')
        .as('role_codes'),
    ])
    .where('u.is_active', '=', true);

  const term = params.q?.trim();
  if (term !== undefined && term !== '') {
    const like = `%${term.toLowerCase()}%`;
    query = query.where(
      sql<SqlBool>`(lower(u.email) LIKE ${like}
        OR lower(coalesce(e.ecode, '')) LIKE ${like}
        OR lower(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) LIKE ${like})`,
    );
  }

  return query.orderBy('u.email').limit(params.limit).execute();
}
