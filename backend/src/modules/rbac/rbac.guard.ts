/** CORE-10, docs/08 §2: administrators may delegate only authority they hold. */
import { ORPCError } from '@orpc/server';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';

export async function assertDelegationCeiling(
  db: Kysely<Database>, actorId: number, permissionIds: readonly number[],
): Promise<void> {
  if (permissionIds.length === 0) return;
  const held = await db.selectFrom('core.user_roles as ur')
    .innerJoin('core.role_permissions as rp', 'rp.role_id', 'ur.role_id')
    .where('ur.user_id', '=', actorId)
    .where('ur.scope_org_unit_id', 'is', null)
    .where('rp.scope', '=', 'all')
    .where('rp.permission_id', 'in', permissionIds)
    .select('rp.permission_id').distinct().execute();
  const allowed = new Set(held.map((row) => row.permission_id));
  if (permissionIds.some((id) => !allowed.has(id))) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Cannot delegate or revoke this permission: you do not hold it at unrestricted scope.',
    });
  }
}

export async function assertRoleDelegation(
  db: Kysely<Database>, actorId: number, targetId: number, roleId: number,
): Promise<void> {
  if (actorId === targetId) {
    throw new ORPCError('FORBIDDEN', { message: 'You cannot change your own roles.' });
  }
  const grants = await db.selectFrom('core.role_permissions').select('permission_id')
    .where('role_id', '=', roleId).execute();
  await assertDelegationCeiling(db, actorId, grants.map((row) => row.permission_id));
}
