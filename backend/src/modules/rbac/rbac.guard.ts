/**
 * The ceiling on `admin.roles` (audit W0.5, finding [D3]).
 *
 * docs/08 §2 states two hard rules that had no code behind them: administrators
 * grant "≤ own level", and `it_admin` NEVER holds `employee.compensation.read`
 * because IT has "no HR data authority". The audit exercised the gap — an
 * it_admin granted itself `employee.statutory_ids.read`, assigned itself
 * `super_admin`, and read another employee's unmasked PAN, Aadhaar and bank
 * account. Three API calls, no step-up, no ceiling.
 *
 * The rule implemented here is the simple, checkable one: **you cannot hand out
 * what you do not hold.** It is not a role hierarchy — the system deliberately
 * has no such ordering (docs/08 §1: roles are additive) — it is a comparison of
 * permission sets, which is exactly what "≤ own level" means when roles are
 * additive rather than ranked.
 */
import { ORPCError } from '@orpc/server';
import type { Kysely } from 'kysely';
import type { Database } from '../../core/db/types.js';
import { getUserPermissions } from '../../core/rbac/permissions.service.js';

/**
 * Every permission a role currently carries. Read from the DATABASE, not from
 * the seed, because the grid is runtime-editable (CORE-10) and the seed is only
 * its starting state.
 */
async function permissionsOfRole(db: Kysely<Database>, roleId: number): Promise<Set<string>> {
  const rows = await db
    .selectFrom('core.role_permissions as rp')
    .innerJoin('core.permissions as p', 'p.id', 'rp.permission_id')
    .where('rp.role_id', '=', roleId)
    .select('p.code')
    .execute();
  return new Set(rows.map((r) => r.code));
}

/**
 * Refuse to grant or revoke a permission the actor does not hold.
 *
 * Revocation is included on purpose. Letting an it_admin strip `payroll.reports`
 * from payroll_admin is not privilege ESCALATION, but it is unilateral control
 * over a domain docs/08 puts outside IT's authority — and it is how a
 * self-inflicted outage starts on a payroll day.
 */
export async function assertMayChangeGrant(
  db: Kysely<Database>,
  actorUserId: number,
  permissionCode: string,
): Promise<void> {
  const held = await getUserPermissions(db, actorUserId);
  if (!held.has(permissionCode)) {
    throw new ORPCError('FORBIDDEN', {
      message: `You cannot grant or revoke '${permissionCode}' because you do not hold it`,
    });
  }
}

/**
 * Refuse to assign a role that carries anything the actor does not hold.
 *
 * This is the check that stops the audit's escalation at step one: `super_admin`
 * carries every permission, so only someone who already holds every permission
 * can hand it out.
 */
export async function assertMayAssignRole(
  db: Kysely<Database>,
  actorUserId: number,
  roleId: number,
  roleCode: string,
): Promise<void> {
  const [held, carried] = await Promise.all([
    getUserPermissions(db, actorUserId),
    permissionsOfRole(db, roleId),
  ]);
  const excess = [...carried].filter((code) => !held.has(code)).sort();
  if (excess.length > 0) {
    throw new ORPCError('FORBIDDEN', {
      message:
        `You cannot assign '${roleCode}': it carries ${String(excess.length)} permission(s) you do not ` +
        `hold (${excess.slice(0, 3).join(', ')}${excess.length > 3 ? ', …' : ''})`,
    });
  }
}

/**
 * Nobody edits their own roles.
 *
 * Even a legitimate super_admin should not be able to quietly widen themselves;
 * a second administrator is a cheap and standard control, and the break-glass
 * path is a DB session, which is separately audited.
 */
export function assertNotSelf(actorUserId: number, targetUserId: number): void {
  if (actorUserId === targetUserId) {
    throw new ORPCError('FORBIDDEN', {
      message: 'You cannot change your own roles — ask another administrator',
    });
  }
}
