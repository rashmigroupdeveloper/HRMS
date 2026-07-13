/**
 * Stage 1.7 hardening — ATT-15 lock is irreversible and blocks late inserts.
 * The original day-record guard protects rows already marked is_locked; this
 * trigger closes the gap where a new row could otherwise be inserted later.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE att.month_locks
      ADD CONSTRAINT month_locks_first_day_check
      CHECK (month = date_trunc('month', month)::date);

    CREATE OR REPLACE FUNCTION att.month_locks_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'att.month_locks is append-only (ATT-15: locked months cannot be reopened)';
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER month_locks_immutable
      BEFORE UPDATE OR DELETE ON att.month_locks
      FOR EACH ROW EXECUTE FUNCTION att.month_locks_immutable();

    CREATE OR REPLACE FUNCTION att.day_records_month_lock_guard() RETURNS trigger AS $$
    DECLARE
      v_company_id BIGINT;
    BEGIN
      SELECT company_id INTO v_company_id
      FROM core.employees
      WHERE id = NEW.employee_id;

      IF EXISTS (
        SELECT 1
        FROM att.month_locks ml
        WHERE ml.company_id = v_company_id
          AND ml.month = date_trunc('month', NEW.work_date)::date
      ) THEN
        -- The lock transaction itself is the only permitted post-lock write:
        -- it flips an existing row from unlocked to locked without changing data.
        IF TG_OP = 'UPDATE'
           AND OLD.is_locked = false
           AND NEW.is_locked = true
           AND (to_jsonb(NEW) - 'is_locked' - 'updated_at')
               IS NOT DISTINCT FROM
               (to_jsonb(OLD) - 'is_locked' - 'updated_at')
        THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'attendance month is locked (ATT-15)';
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER day_records_month_lock_guard
      BEFORE INSERT OR UPDATE ON att.day_records
      FOR EACH ROW EXECUTE FUNCTION att.day_records_month_lock_guard();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS day_records_month_lock_guard ON att.day_records;
    DROP FUNCTION IF EXISTS att.day_records_month_lock_guard();
    DROP TRIGGER IF EXISTS month_locks_immutable ON att.month_locks;
    DROP FUNCTION IF EXISTS att.month_locks_immutable();
    ALTER TABLE att.month_locks DROP CONSTRAINT IF EXISTS month_locks_first_day_check;
  `);
}
