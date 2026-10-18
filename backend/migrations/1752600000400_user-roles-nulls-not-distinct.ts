/**
 * E2E-018: (user, role, NULL scope) could be granted twice because NULLs were distinct
 * in the unique key. Collapse duplicates (keep the oldest) and use NULLS NOT DISTINCT (PG15+).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM core.user_roles a USING core.user_roles b
     WHERE a.user_id = b.user_id AND a.role_id = b.role_id
       AND a.scope_org_unit_id IS NOT DISTINCT FROM b.scope_org_unit_id AND a.id > b.id;
    ALTER TABLE core.user_roles DROP CONSTRAINT user_roles_user_id_role_id_scope_org_unit_id_key;
    ALTER TABLE core.user_roles ADD CONSTRAINT user_roles_user_id_role_id_scope_org_unit_id_key
      UNIQUE NULLS NOT DISTINCT (user_id, role_id, scope_org_unit_id);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE core.user_roles DROP CONSTRAINT user_roles_user_id_role_id_scope_org_unit_id_key;
    ALTER TABLE core.user_roles ADD CONSTRAINT user_roles_user_id_role_id_scope_org_unit_id_key UNIQUE (user_id, role_id, scope_org_unit_id);
  `);
}
