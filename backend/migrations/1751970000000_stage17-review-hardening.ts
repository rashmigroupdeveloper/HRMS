/**
 * Stage 1.7 review hardening — migration-safe letter schema, runtime RBAC
 * scopes, and append-only/versioned manager attendance approvals.
 *
 * Requirements: CORE-09/10/11, ATT-12/15, docs/14 §§5–6.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    --------------------------------------------------------------------------
    -- CORE-09: make the checked-in migration chain reproduce the letter shape
    -- already used by the application. Existing document-backed rows retain
    -- their document; body_rendered is only the no-document fallback.
    --------------------------------------------------------------------------
    ALTER TABLE core.letters ADD COLUMN IF NOT EXISTS body_rendered TEXT;
    UPDATE core.letters SET body_rendered = '' WHERE body_rendered IS NULL;
    ALTER TABLE core.letters ALTER COLUMN body_rendered SET NOT NULL;

    ALTER TABLE core.letters ADD COLUMN IF NOT EXISTS status TEXT;
    UPDATE core.letters
       SET status = CASE
         WHEN issued_at IS NOT NULL THEN 'issued'
         WHEN workflow_request_id IS NOT NULL THEN 'pending_signature'
         ELSE 'draft'
       END
     WHERE status IS NULL;
    ALTER TABLE core.letters ALTER COLUMN status SET DEFAULT 'issued';
    ALTER TABLE core.letters ALTER COLUMN status SET NOT NULL;
    ALTER TABLE core.letters DROP CONSTRAINT IF EXISTS letters_status_check;
    ALTER TABLE core.letters ADD CONSTRAINT letters_status_check
      CHECK (status IN ('draft', 'pending_signature', 'issued'));
    ALTER TABLE core.letters ALTER COLUMN document_id DROP NOT NULL;

    --------------------------------------------------------------------------
    -- CORE-10: permission scope is runtime data alongside the grant. A grant
    -- added through the RBAC API takes effect, with its scope, next request.
    --------------------------------------------------------------------------
    ALTER TABLE core.role_permissions ADD COLUMN IF NOT EXISTS scope TEXT;
    UPDATE core.role_permissions rp
       SET scope = CASE r.code
         WHEN 'employee' THEN 'own'
         WHEN 'manager' THEN 'subtree'
         WHEN 'senior_manager' THEN 'subtree'
         WHEN 'hr_ops' THEN 'org_unit'
         WHEN 'plant_head' THEN 'org_unit'
         ELSE 'all'
       END
      FROM core.roles r
     WHERE r.id = rp.role_id AND rp.scope IS NULL;
    ALTER TABLE core.role_permissions ALTER COLUMN scope SET DEFAULT 'all';
    ALTER TABLE core.role_permissions ALTER COLUMN scope SET NOT NULL;
    ALTER TABLE core.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_scope_check;
    ALTER TABLE core.role_permissions ADD CONSTRAINT role_permissions_scope_check
      CHECK (scope IN ('all', 'subtree', 'own', 'org_unit', 'readonly'));

    --------------------------------------------------------------------------
    -- ATT-12: approvals are events, not a mutable boolean. Any attendance or
    -- roster mutation after approval appends an invalidation event.
    --------------------------------------------------------------------------
    ALTER TABLE att.manager_month_approvals
      DROP CONSTRAINT IF EXISTS manager_month_approvals_company_id_month_manager_employee_id_key;
    ALTER TABLE att.manager_month_approvals
      DROP CONSTRAINT IF EXISTS manager_month_approvals_company_id_month_manager_employee_i_key;
    ALTER TABLE att.manager_month_approvals
      ALTER COLUMN approved_by_user_id DROP NOT NULL;
    ALTER TABLE att.manager_month_approvals
      ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'approve';
    ALTER TABLE att.manager_month_approvals
      DROP CONSTRAINT IF EXISTS manager_month_approvals_event_type_check;
    ALTER TABLE att.manager_month_approvals
      ADD CONSTRAINT manager_month_approvals_event_type_check
      CHECK (event_type IN ('approve', 'invalidate'));
    CREATE INDEX IF NOT EXISTS manager_month_approvals_latest_idx
      ON att.manager_month_approvals (company_id, month, manager_employee_id, id DESC);

    CREATE OR REPLACE FUNCTION att.reject_manager_approval_mutation()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'manager attendance approval events are append-only';
    END $$;
    DROP TRIGGER IF EXISTS manager_month_approvals_append_only ON att.manager_month_approvals;
    CREATE TRIGGER manager_month_approvals_append_only
      BEFORE UPDATE OR DELETE ON att.manager_month_approvals
      FOR EACH ROW EXECUTE FUNCTION att.reject_manager_approval_mutation();

    CREATE OR REPLACE FUNCTION att.invalidate_manager_month_approval()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE
      v_employee_id BIGINT;
      v_work_date DATE;
      v_manager_id BIGINT;
      v_company_id BIGINT;
      v_month DATE;
      v_latest_event TEXT;
    BEGIN
      v_employee_id := COALESCE(NEW.employee_id, OLD.employee_id);
      v_work_date := COALESCE(NEW.work_date, OLD.work_date);

      SELECT reporting_manager_id, company_id
        INTO v_manager_id, v_company_id
        FROM core.employees
       WHERE id = v_employee_id;

      IF v_manager_id IS NULL THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
      END IF;

      v_month := date_trunc('month', v_work_date)::date;
      SELECT event_type
        INTO v_latest_event
        FROM att.manager_month_approvals
       WHERE company_id = v_company_id
         AND month = v_month
         AND manager_employee_id = v_manager_id
       ORDER BY id DESC
       LIMIT 1;

      IF v_latest_event = 'approve' THEN
        INSERT INTO att.manager_month_approvals
          (company_id, month, manager_employee_id, approved_by_user_id, event_type, note)
        VALUES
          (v_company_id, v_month, v_manager_id, NULL, 'invalidate',
           TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || ' changed after approval');
      END IF;

      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END $$;

    DROP TRIGGER IF EXISTS day_records_invalidate_manager_approval ON att.day_records;
    CREATE TRIGGER day_records_invalidate_manager_approval
      AFTER INSERT OR UPDATE OR DELETE ON att.day_records
      FOR EACH ROW EXECUTE FUNCTION att.invalidate_manager_month_approval();

    DROP TRIGGER IF EXISTS rosters_invalidate_manager_approval ON att.rosters;
    CREATE TRIGGER rosters_invalidate_manager_approval
      AFTER INSERT OR UPDATE OR DELETE ON att.rosters
      FOR EACH ROW EXECUTE FUNCTION att.invalidate_manager_month_approval();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS rosters_invalidate_manager_approval ON att.rosters;
    DROP TRIGGER IF EXISTS day_records_invalidate_manager_approval ON att.day_records;
    DROP FUNCTION IF EXISTS att.invalidate_manager_month_approval();
    DROP TRIGGER IF EXISTS manager_month_approvals_append_only ON att.manager_month_approvals;
    DROP FUNCTION IF EXISTS att.reject_manager_approval_mutation();
    DROP INDEX IF EXISTS att.manager_month_approvals_latest_idx;
    ALTER TABLE att.manager_month_approvals DROP COLUMN IF EXISTS event_type;
    ALTER TABLE core.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_scope_check;
    ALTER TABLE core.role_permissions DROP COLUMN IF EXISTS scope;
    ALTER TABLE core.letters DROP CONSTRAINT IF EXISTS letters_status_check;
    ALTER TABLE core.letters DROP COLUMN IF EXISTS status;
    ALTER TABLE core.letters DROP COLUMN IF EXISTS body_rendered;
  `);
}
