/**
 * The last-administrator guard (audit W0-T25, finding [D3]).
 *
 * `admin.roles` allowed unrestricted revocation, so the same endpoint that let
 * an it_admin escalate to super_admin also let anyone strip `admin.roles` from
 * every super_admin — an unrecoverable lockout of the whole platform, fixable
 * only with a psql session on the production box.
 *
 * The application ceiling (modules/rbac/rbac.guard.ts) makes that unreachable
 * through the API. This is the layer underneath it: the database itself refuses
 * to leave the system with no active super_admin, so a stray script, a bad
 * migration or a hand-run DELETE cannot do it either. Constraints are the spec
 * (docs/14 §6.1) — the layer app code cannot bypass.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  /**
   * Transition tables (PG 10+) are what make this precise. Without them the
   * trigger would fire on EVERY is_active update and, in any environment that
   * happens to have no super_admin yet, would block ordinary exit-day
   * deactivation — a guard that causes the outage it was meant to prevent.
   * With them it only looks when the statement actually touched a super_admin.
   */
  pgm.sql(`
    CREATE OR REPLACE FUNCTION core.assert_super_admin_remains()
    RETURNS TRIGGER AS $$
    DECLARE
      v_touched  INT;
      v_remaining INT;
    BEGIN
      IF TG_TABLE_NAME = 'user_roles' THEN
        SELECT count(*) INTO v_touched
          FROM removed rm
          JOIN core.roles r ON r.id = rm.role_id
         WHERE r.code = 'super_admin';
      ELSE
        SELECT count(*) INTO v_touched
          FROM removed rm
          JOIN core.user_roles ur ON ur.user_id = rm.id
          JOIN core.roles r ON r.id = ur.role_id
         WHERE r.code = 'super_admin'
           AND rm.is_active = true;
      END IF;

      -- The statement did not touch a super_admin: nothing to protect here.
      IF v_touched = 0 THEN
        RETURN NULL;
      END IF;

      SELECT count(*) INTO v_remaining
        FROM core.user_roles ur
        JOIN core.roles r ON r.id = ur.role_id
        JOIN core.users u ON u.id = ur.user_id
       WHERE r.code = 'super_admin'
         AND u.is_active = true;

      IF v_remaining = 0 THEN
        RAISE EXCEPTION
          'refusing to leave the platform with no active super_admin (audit W0-T25)';
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;
  `);

  /**
   * AFTER ... FOR EACH STATEMENT, not FOR EACH ROW: the check is about the
   * table's resulting state, so it must run once after the whole statement.
   * A row-level trigger would fire mid-statement and reject a legitimate
   * "swap the super_admin" that removes one and adds another in one go.
   */
  pgm.sql(`
    CREATE TRIGGER user_roles_keep_one_super_admin_del
      AFTER DELETE ON core.user_roles
      REFERENCING OLD TABLE AS removed
      FOR EACH STATEMENT
      EXECUTE FUNCTION core.assert_super_admin_remains();
  `);
  pgm.sql(`
    CREATE TRIGGER user_roles_keep_one_super_admin_upd
      AFTER UPDATE ON core.user_roles
      REFERENCING OLD TABLE AS removed
      FOR EACH STATEMENT
      EXECUTE FUNCTION core.assert_super_admin_remains();
  `);

  /**
   * Deactivating the last super_admin is the same lockout by another route —
   * `resolveApprover` and every permission read filter on `is_active`.
   */
  pgm.sql(`
    CREATE TRIGGER users_keep_one_super_admin
      AFTER UPDATE OF is_active ON core.users
      REFERENCING OLD TABLE AS removed
      FOR EACH STATEMENT
      EXECUTE FUNCTION core.assert_super_admin_remains();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`DROP TRIGGER IF EXISTS users_keep_one_super_admin ON core.users;`);
  pgm.sql(`DROP TRIGGER IF EXISTS user_roles_keep_one_super_admin_upd ON core.user_roles;`);
  pgm.sql(`DROP TRIGGER IF EXISTS user_roles_keep_one_super_admin_del ON core.user_roles;`);
  pgm.sql(`DROP FUNCTION IF EXISTS core.assert_super_admin_remains();`);
}
