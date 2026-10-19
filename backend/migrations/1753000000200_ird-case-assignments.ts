/**
 * Phase 5, Stage 5.5 — POSH assigned-case isolation & IRD permissions.
 *
 * Implements strict assigned-case isolation so general HR users cannot browse
 * confidential POSH cases unless explicitly assigned (or serving as active
 * Presiding Officer).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    CREATE TABLE IF NOT EXISTS ird.posh_case_assignments (
      id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      case_id              BIGINT NOT NULL REFERENCES ird.posh_cases(id) ON DELETE CASCADE,
      user_id              BIGINT NOT NULL REFERENCES core.users(id),
      role                 TEXT NOT NULL DEFAULT 'investigator'
                             CHECK (role IN ('presiding_officer', 'investigator', 'member')),
      assigned_by_user_id  BIGINT REFERENCES core.users(id),
      assigned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      active               BOOLEAN NOT NULL DEFAULT true,
      CONSTRAINT posh_case_assignments_uq UNIQUE (case_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS posh_case_assignments_user_idx
      ON ird.posh_case_assignments (user_id) WHERE active;

    COMMENT ON TABLE ird.posh_case_assignments IS
      'Assigned-case isolation for POSH inquiries — non-assigned handlers receive 403.';

    -- Seed IRD permissions
    INSERT INTO core.permissions (code)
    VALUES
      ('ird.posh.handle'),
      ('ird.grievance.handle'),
      ('ird.whistle.intake')
    ON CONFLICT (code) DO NOTHING;

    -- Grant to hr_head (all scope)
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
    SELECT r.id, p.id, 'all'
    FROM core.roles r
    CROSS JOIN core.permissions p
    WHERE r.code = 'hr_head'
      AND p.code IN ('ird.posh.handle', 'ird.grievance.handle', 'ird.whistle.intake')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Grant to hr_ops (grievance handling only, org_unit scope)
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
    SELECT r.id, p.id, 'org_unit'
    FROM core.roles r
    CROSS JOIN core.permissions p
    WHERE r.code = 'hr_ops'
      AND p.code = 'ird.grievance.handle'
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Grant to super_admin (all scope)
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
    SELECT r.id, p.id, 'all'
    FROM core.roles r
    CROSS JOIN core.permissions p
    WHERE r.code = 'super_admin'
      AND p.code IN ('ird.posh.handle', 'ird.grievance.handle', 'ird.whistle.intake')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    DELETE FROM core.role_permissions
    WHERE permission_id IN (
      SELECT id FROM core.permissions
      WHERE code IN ('ird.posh.handle', 'ird.grievance.handle', 'ird.whistle.intake')
    );

    DELETE FROM core.permissions
    WHERE code IN ('ird.posh.handle', 'ird.grievance.handle', 'ird.whistle.intake');

    DROP TABLE IF EXISTS ird.posh_case_assignments;
  `);
}
