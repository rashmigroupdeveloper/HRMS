/**
 * RBAC seed runner — idempotent (safe to re-run anytime; ON CONFLICT no-ops).
 * Usage: npm run seed:rbac   (reads DATABASE_URL from .env)
 */
import 'dotenv/config';
import { loadEnv } from '../config/env.js';
import { createDatabase } from '../db/database.js';
import { logger } from '../logger.js';
import { PERMISSIONS, ROLES, ROLE_GRANTS, type RoleCode } from './seed-data.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_URL);

  try {
    await db
      .insertInto('core.roles')
      .values(ROLES.map((r) => ({ code: r.code, name: r.name })))
      .onConflict((oc) => oc.column('code').doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
      .execute();

    await db
      .insertInto('core.permissions')
      .values(PERMISSIONS.map((code) => ({ code })))
      .onConflict((oc) => oc.column('code').doNothing())
      .execute();

    const roleIds = new Map<string, number>();
    for (const row of await db.selectFrom('core.roles').select(['id', 'code']).execute()) {
      roleIds.set(row.code, row.id);
    }
    const permIds = new Map<string, number>();
    for (const row of await db.selectFrom('core.permissions').select(['id', 'code']).execute()) {
      permIds.set(row.code, row.id);
    }

    const pairs: { role_id: number; permission_id: number }[] = [];
    for (const [roleCode, grants] of Object.entries(ROLE_GRANTS) as [
      RoleCode,
      (typeof ROLE_GRANTS)[RoleCode],
    ][]) {
      const roleId = roleIds.get(roleCode);
      if (roleId === undefined) throw new Error(`role missing after seed: ${roleCode}`);
      const seen = new Set<number>();
      for (const grant of grants) {
        const permId = permIds.get(grant.permission);
        if (permId === undefined) throw new Error(`permission missing after seed: ${grant.permission}`);
        if (!seen.has(permId)) {
          seen.add(permId);
          pairs.push({ role_id: roleId, permission_id: permId });
        }
      }
    }

    await db
      .insertInto('core.role_permissions')
      .values(pairs)
      .onConflict((oc) => oc.columns(['role_id', 'permission_id']).doNothing())
      .execute();

    const counts = {
      roles: ROLES.length,
      permissions: PERMISSIONS.length,
      grants: pairs.length,
    };
    logger.info(counts, 'RBAC seed complete (idempotent)');
  } finally {
    await db.destroy();
  }
}

main().catch((err: unknown) => {
  logger.error(err, 'RBAC seed failed');
  process.exitCode = 1;
});
