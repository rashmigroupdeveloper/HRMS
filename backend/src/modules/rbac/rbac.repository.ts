/** All database access for the RBAC admin module. */
import type { Kysely } from 'kysely';
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
    .select(['r.code as role', 'p.code as permission'])
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

export async function insertGrant(db: Kysely<Database>, roleId: number, permissionId: number): Promise<boolean> {
  const res = await db
    .insertInto('core.role_permissions')
    .values({ role_id: roleId, permission_id: permissionId })
    .onConflict((oc) => oc.columns(['role_id', 'permission_id']).doNothing())
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
