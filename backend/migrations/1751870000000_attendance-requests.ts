/**
 * Migration 0009 — Stage 1.4: AR/OD/Permission requests + overtime entries.
 * Spec: docs/03 §4 (att.regularizations, att.overtime_entries) · ATT-06/07/08.
 *
 * OT integrity (docs/03 §10.6): an OT minute lands in exactly ONE place —
 * money or comp-off, never both — enforced by CHECK, not convention.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    -- AR (past-only) | OD (future allowed) | PERMISSION (time-bounded hours)
    CREATE TABLE att.regularizations (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      kind TEXT NOT NULL CHECK (kind IN ('AR','OD','PERMISSION')),
      from_date DATE NOT NULL,
      to_date DATE NOT NULL,
      from_time TIME,                        -- partial-day OD; REQUIRED for PERMISSION
      to_time TIME,
      reason TEXT NOT NULL,
      requested_status att.day_status NOT NULL, -- 'P' for AR, 'OD' for OD
      workflow_request_id BIGINT NOT NULL REFERENCES wf.requests(id),
      applied BOOLEAN NOT NULL DEFAULT false,   -- set when approved AND day_records updated
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (from_date <= to_date),
      CHECK (kind <> 'PERMISSION' OR (from_time IS NOT NULL AND to_time IS NOT NULL AND from_date = to_date))
    );
    CREATE TRIGGER regularizations_updated_at BEFORE UPDATE ON att.regularizations
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX regularizations_emp_idx ON att.regularizations (employee_id, from_date);
    CREATE UNIQUE INDEX regularizations_wf_idx ON att.regularizations (workflow_request_id);

    -- ATT-08: the 48-hour rule
    CREATE TABLE att.overtime_entries (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      work_date DATE NOT NULL,
      detected_minutes SMALLINT NOT NULL,     -- from swipes beyond shift / WO-H work
      claimed_minutes SMALLINT NOT NULL,      -- ≤ detected; what goes for approval
      approved_minutes SMALLINT,              -- manager decision (may be partial)
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','lapsed','converted_comp_off')),
      manager_id BIGINT REFERENCES core.employees(id),
      decided_at TIMESTAMPTZ,
      deadline_at TIMESTAMPTZ NOT NULL,       -- intimation + 48h; lapse flips status
      workflow_request_id BIGINT REFERENCES wf.requests(id), -- the 'overtime' chain instance
      comp_off_credit_id BIGINT,              -- FK → lv.ledger added in Stage 1.5
      payroll_item_id BIGINT,                 -- set when paid (Phase 2)
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_id, work_date),
      CHECK (claimed_minutes <= detected_minutes),
      CHECK (approved_minutes IS NULL OR approved_minutes <= claimed_minutes),
      -- paid once, as money or comp-off, never both (docs/03 §10.6)
      CHECK (comp_off_credit_id IS NULL OR payroll_item_id IS NULL)
    );
    CREATE TRIGGER overtime_entries_updated_at BEFORE UPDATE ON att.overtime_entries
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX overtime_pending_idx ON att.overtime_entries (manager_id, status)
      WHERE status = 'pending';
    CREATE UNIQUE INDEX overtime_wf_idx ON att.overtime_entries (workflow_request_id)
      WHERE workflow_request_id IS NOT NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS att.overtime_entries;
    DROP TABLE IF EXISTS att.regularizations;
  `);
}
