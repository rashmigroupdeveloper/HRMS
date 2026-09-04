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
