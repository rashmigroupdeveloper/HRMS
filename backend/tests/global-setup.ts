/** Seed the isolated integration database with runtime catalogs migrations do not own. */
import { createDatabase } from '../src/core/db/database.js';
import { PERMISSIONS, ROLES, ROLE_GRANTS, type RoleCode } from '../src/core/rbac/seed-data.js';
import { WORKFLOW_DEFINITIONS } from '../src/modules/workflows/definitions.seed.js';

export default async function setup(): Promise<void> {
  const databaseUrl = process.env['TEST_DATABASE_URL'];
  if (databaseUrl === undefined || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
    throw new Error('Global test setup requires TEST_DATABASE_URL ending in _test');
  }

  const db = createDatabase(databaseUrl);
  try {
    await db.insertInto('core.roles')
      .values(ROLES.map((role) => ({ code: role.code, name: role.name })))
      .onConflict((conflict) => conflict.column('code').doUpdateSet((eb) => ({
        name: eb.ref('excluded.name'),
      })))
      .execute();
    await db.insertInto('core.permissions')
      .values(PERMISSIONS.map((code) => ({ code })))
      .onConflict((conflict) => conflict.column('code').doNothing())
      .execute();

    const roleIds = new Map(
      (await db.selectFrom('core.roles').select(['id', 'code']).execute())
        .map((row) => [row.code, row.id] as const),
    );
    const permissionIds = new Map(
      (await db.selectFrom('core.permissions').select(['id', 'code']).execute())
        .map((row) => [row.code, row.id] as const),
    );
    const grants: { role_id: number; permission_id: number; scope: 'all' | 'subtree' | 'own' | 'org_unit' | 'readonly' }[] = [];
    for (const [roleCode, roleGrants] of Object.entries(ROLE_GRANTS) as [
      RoleCode,
      (typeof ROLE_GRANTS)[RoleCode],
    ][]) {
      const roleId = roleIds.get(roleCode);
      if (roleId === undefined) throw new Error(`Test seed role missing: ${roleCode}`);
      for (const grant of roleGrants) {
        const permissionId = permissionIds.get(grant.permission);
        if (permissionId === undefined) {
          throw new Error(`Test seed permission missing: ${grant.permission}`);
        }
        grants.push({ role_id: roleId, permission_id: permissionId, scope: grant.scope });
      }
    }
    await db.insertInto('core.role_permissions')
      .values(grants)
      .onConflict((conflict) => conflict.columns(['role_id', 'permission_id']).doUpdateSet((eb) => ({
        scope: eb.ref('excluded.scope'),
      })))
      .execute();

    /**
     * A permanent, non-loginable super_admin anchor.
     *
     * Production always has at least one active super_admin, and migration
     * 1752200000000 makes the database refuse to be left without one (audit
     * W0-T25). Suites that create a temporary super_admin previously deleted it
     * in cleanup and, being the only one, were correctly refused — the guard
     * doing its job, in an environment that did not model the invariant.
     *
     * The password hash is deliberately not a valid bcrypt digest, so this
     * account can never authenticate; it exists only to hold the invariant.
     */
    const anchor = await db
      .insertInto('core.users')
      .values({ email: 'integration-anchor@hrms.invalid', password_hash: '!not-a-valid-bcrypt-hash!' })
      .onConflict((conflict) => conflict.column('email').doUpdateSet({ is_active: true }))
      .returning('id')
      .executeTakeFirstOrThrow();
    const superRole = await db
      .selectFrom('core.roles').select('id').where('code', '=', 'super_admin').executeTakeFirstOrThrow();
    await db
      .insertInto('core.user_roles')
      .values({ user_id: anchor.id, role_id: superRole.id, scope_org_unit_id: null })
      .onConflict((conflict) => conflict.columns(['user_id', 'role_id', 'scope_org_unit_id']).doNothing())
      .execute();

    await db.insertInto('wf.definitions')
      .values(WORKFLOW_DEFINITIONS.map((definition) => ({
        code: definition.code,
        name: definition.name,
        steps: JSON.stringify(definition.steps),
      })))
      .onConflict((conflict) => conflict.column('code').doNothing())
      .execute();
  } finally {
    await db.destroy();
  }
}
