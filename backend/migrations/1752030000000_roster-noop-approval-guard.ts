/**
 * ATT-04/12 — a replayed roster assignment is not a business-state change.
 * Preserve the current manager approval when shift/week-off values are equal.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

function invalidationFunction(rosterNoopGuard: boolean): string {
  const rosterGuard = rosterNoopGuard
    ? `
      -- NOTE: this function is shared by att.rosters AND att.day_records.
      -- \`is_week_off\` exists only on rosters, so the comparison MUST stay in a
      -- nested IF: PL/pgSQL prepares an expression on first execution, and a
      -- flat \`AND\` chain would resolve NEW.is_week_off for day_records too and
      -- fail with 'record "new" has no field "is_week_off"'.
      IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'rosters' THEN
        IF NEW.employee_id IS NOT DISTINCT FROM OLD.employee_id
           AND NEW.work_date IS NOT DISTINCT FROM OLD.work_date
           AND NEW.shift_id IS NOT DISTINCT FROM OLD.shift_id
           AND NEW.is_week_off IS NOT DISTINCT FROM OLD.is_week_off THEN
          RETURN NEW;
        END IF;
      END IF;
`
    : '';

  return `
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
${rosterGuard}
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
  `;
}

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(invalidationFunction(true));
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(invalidationFunction(false));
}
