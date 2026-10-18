/**
 * C-34 / A-15 / A-27 (NFR-03, SEC-01): self-service password change + reset,
 * IT-admin account lifecycle and forced change on first login.
 *  - core.users.must_change_password / password_changed_at / deactivated_at
 *  - sec.sessions.revoke_reason gains 'refresh_reuse' semantics (free text)
 *  - one login per employee (S-35)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE core.users
      ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN password_changed_at TIMESTAMPTZ,
      ADD COLUMN deactivated_at TIMESTAMPTZ;
    CREATE UNIQUE INDEX users_employee_unique ON core.users (employee_id) WHERE employee_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS password_reset_tokens_open
      ON core.password_reset_tokens (user_id) WHERE used_at IS NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS core.password_reset_tokens_open;
    DROP INDEX IF EXISTS core.users_employee_unique;
    ALTER TABLE core.users
      DROP COLUMN IF EXISTS deactivated_at,
      DROP COLUMN IF EXISTS password_changed_at,
      DROP COLUMN IF EXISTS must_change_password;
  `);
}
