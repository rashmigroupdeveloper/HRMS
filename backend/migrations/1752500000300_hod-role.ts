/**
 * Head of Department (requirements gap #1, CONFLICTS C-02, ROLE_TASKS §4).
 *
 * - core.department_heads: an admin designates one or more HODs per department,
 *   optionally per company (NULL company = that department in every entity).
 * - Role `hod` is DERIVED at runtime (like manager): an active employee who is
 *   a designated department head, or who is named as someone's
 *   core.employees.hod_employee_id (the live-EMS per-employee override).
 * - New grant scope `department`: the subjects whose hod_employee_id is the
 *   actor, or whose department (in a matching company) the actor heads.
 * - HOD grants: read people, team attendance, muster export, AR/OD/OT/leave and
 *   claims approvals, HR reports — all department-scoped. No attendance edits
 *   and no compensation (ROLE_TASKS §4 negative tests).
 * - Domestic travel advance: RM → HOD (docs/01 TE-07) replaces the
 *   functional-manager stand-in, only where the chain is still the seeded default.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

const HOD_GRANTS = [
  'employee.read', 'attendance.team.read', 'attendance.muster.export',
  'leave.approve', 'ar.approve', 'od.approve', 'ot.approve', 'claims.approve', 'reports.hr',
];
const OLD_TRAVEL = '[{"step": 1, "approver": "reporting_manager", "onBreach": "escalate", "slaHours": 48}, {"step": 2, "approver": "functional_manager", "onBreach": "escalate", "slaHours": 48}]';
const NEW_TRAVEL = '[{"step": 1, "approver": "reporting_manager", "onBreach": "escalate", "slaHours": 48}, {"step": 2, "approver": "department_head", "onBreach": "escalate", "slaHours": 48}]';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE TABLE core.department_heads (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      department_id BIGINT NOT NULL REFERENCES core.departments(id) ON DELETE CASCADE,
      company_id BIGINT REFERENCES core.companies(id) ON DELETE CASCADE,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id) ON DELETE CASCADE,
      created_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- Equivalent NULL uniqueness on target16 and the authorized local14 test DB.
    CREATE UNIQUE INDEX department_heads_entity_uq ON core.department_heads(department_id, company_id, employee_id) WHERE company_id IS NOT NULL;
    CREATE UNIQUE INDEX department_heads_group_uq ON core.department_heads(department_id, employee_id) WHERE company_id IS NULL;
    CREATE INDEX department_heads_employee_idx ON core.department_heads (employee_id);
    CREATE TRIGGER department_heads_updated_at BEFORE UPDATE ON core.department_heads
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ALTER TABLE core.role_permissions DROP CONSTRAINT role_permissions_scope_check;
    ALTER TABLE core.role_permissions ADD CONSTRAINT role_permissions_scope_check
      CHECK (scope = ANY (ARRAY['all','subtree','own','org_unit','readonly','department']));

    INSERT INTO core.roles (code, name) VALUES ('hod', 'Head of Department (derived)')
      ON CONFLICT (code) DO NOTHING;
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
      SELECT r.id, p.id, 'department' FROM core.roles r JOIN core.permissions p
          ON p.code = ANY (ARRAY[${HOD_GRANTS.map((g) => `'${g}'`).join(', ')}])
       WHERE r.code = 'hod'
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    -- Like the derived manager roles, an HOD keeps self-service (no-op over 'employee').
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
      SELECT r.id, p.id, 'all' FROM core.roles r JOIN core.permissions p ON p.code IN ('attendance.own', 'leave.own')
       WHERE r.code = 'hod'
      ON CONFLICT (role_id, permission_id) DO NOTHING;

    UPDATE wf.definitions SET steps = '${NEW_TRAVEL}'::jsonb
     WHERE code = 'travel_advance_domestic' AND steps = '${OLD_TRAVEL}'::jsonb;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    UPDATE wf.definitions SET steps = '${OLD_TRAVEL}'::jsonb
     WHERE code = 'travel_advance_domestic' AND steps = '${NEW_TRAVEL}'::jsonb;
    DELETE FROM core.roles WHERE code = 'hod';
    DELETE FROM core.role_permissions WHERE scope = 'department';
    ALTER TABLE core.role_permissions DROP CONSTRAINT role_permissions_scope_check;
    ALTER TABLE core.role_permissions ADD CONSTRAINT role_permissions_scope_check
      CHECK (scope = ANY (ARRAY['all','subtree','own','org_unit','readonly']));
    DROP TABLE core.department_heads;
  `);
}
