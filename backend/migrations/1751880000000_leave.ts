/**
 * Migration 0010 — Stage 1.5: the Leave module (docs/03 §5, LV-01..09).
 *
 * Ledger discipline (LV-05 / CLAUDE.md rule 3): balances are ALWAYS
 * SUM(ledger.delta) — the ledger is append-only at the DB layer, same
 * guarantee as the audit log and raw swipes. Every movement (accrual, grant,
 * application debit, cancel reversal, lapse, encashment, comp-off earn,
 * audited manual adjustment) is one immutable row.
 *
 * Seed rates/caps are DEFAULTS pending the P0-T06 policy sign-off — every
 * value is a row edited at runtime via the leave.admin API, never code.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS lv;

    -- LV-01: the six live RML types + ML in catalog (docs/09 §1)
    CREATE TABLE lv.leave_types (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      is_paid BOOLEAN NOT NULL DEFAULT true,             -- LWP=false → LOP feed to payroll
      accrual_per_month NUMERIC(5,2) NOT NULL DEFAULT 0, -- 0 = granted, not accrued (LV-02)
      accrual_requires_service_months SMALLINT NOT NULL DEFAULT 0, -- EL after 12 months
      max_carry_forward NUMERIC(5,2),                    -- year-end cap; NULL = unlimited
      encashable BOOLEAN NOT NULL DEFAULT false,         -- EL encashment (LV-06)
      max_per_request NUMERIC(4,1),
      allow_half_day BOOLEAN NOT NULL DEFAULT true,
      sandwich_rule TEXT NOT NULL DEFAULT 'exclude' CHECK (sandwich_rule IN ('include','exclude')),
      applicable_categories core.employment_category[],  -- NULL = all categories
      applicable_gender TEXT,                            -- 'F' → Maternity
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TRIGGER leave_types_updated_at BEFORE UPDATE ON lv.leave_types
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    -- LV-05: immutable transactions; balance = SUM(delta), never a counter
    CREATE TABLE lv.ledger (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      leave_type_id BIGINT NOT NULL REFERENCES lv.leave_types(id),
      txn_type TEXT NOT NULL CHECK (txn_type IN
        ('accrual','grant','application','cancel','lapse','encash','comp_off_earn','adjustment')),
      delta NUMERIC(5,2) NOT NULL CHECK (delta <> 0),    -- + credit / − debit
      effective_date DATE NOT NULL,
      expiry_date DATE,                                  -- comp-off validity window (LV-04)
      reference_id BIGINT,                               -- application / OT entry / run id
      note TEXT,
      created_by BIGINT REFERENCES core.users(id),       -- NULL = system job
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (txn_type <> 'adjustment' OR note IS NOT NULL) -- manual corrections explain themselves
    );
    CREATE INDEX lv_ledger_emp_type_idx ON lv.ledger (employee_id, leave_type_id, effective_date);
    -- LV-02 idempotency: one accrual per employee × type × month, enforced by the DB
    CREATE UNIQUE INDEX lv_ledger_accrual_once ON lv.ledger (employee_id, leave_type_id, effective_date)
      WHERE txn_type = 'accrual';

    CREATE OR REPLACE FUNCTION lv.ledger_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'lv.ledger is append-only (LV-05: balances are sums of immutable rows)';
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON lv.ledger
      FOR EACH ROW EXECUTE FUNCTION lv.ledger_immutable();

    -- LV-03: applications; the debit/reversal txns are linked, never inlined
    CREATE TABLE lv.applications (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      leave_type_id BIGINT NOT NULL REFERENCES lv.leave_types(id),
      from_date DATE NOT NULL,
      to_date DATE NOT NULL,
      from_half BOOLEAN NOT NULL DEFAULT false,          -- first day = second half only
      to_half BOOLEAN NOT NULL DEFAULT false,            -- last day = first half only
      days NUMERIC(4,1) NOT NULL CHECK (days > 0),       -- net of sandwich rule; payroll snapshot
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','cancelled')),
      workflow_request_id BIGINT NOT NULL REFERENCES wf.requests(id),
      cancel_workflow_request_id BIGINT REFERENCES wf.requests(id), -- LV-08 re-approval
      ledger_txn_id BIGINT REFERENCES lv.ledger(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (from_date <= to_date)
    );
    CREATE TRIGGER applications_updated_at BEFORE UPDATE ON lv.applications
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE INDEX lv_applications_emp_idx ON lv.applications (employee_id, from_date);
    CREATE UNIQUE INDEX lv_applications_wf_idx ON lv.applications (workflow_request_id);
    CREATE UNIQUE INDEX lv_applications_cancel_wf_idx ON lv.applications (cancel_workflow_request_id)
      WHERE cancel_workflow_request_id IS NOT NULL;

    -- LV-09: Restricted Holidays — HR publishes, employees pick up to N/year
    CREATE TABLE lv.restricted_holidays (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      holiday_date DATE NOT NULL,
      name TEXT NOT NULL,
      location_id BIGINT REFERENCES core.locations(id),  -- NULL = all locations
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (holiday_date, name)
    );
    CREATE TABLE lv.rh_selections (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES core.employees(id),
      restricted_holiday_id BIGINT NOT NULL REFERENCES lv.restricted_holidays(id),
      workflow_request_id BIGINT NOT NULL REFERENCES wf.requests(id),
      applied BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_id, restricted_holiday_id)
    );
    CREATE TRIGGER rh_selections_updated_at BEFORE UPDATE ON lv.rh_selections
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
    CREATE UNIQUE INDEX lv_rh_selections_wf_idx ON lv.rh_selections (workflow_request_id);

    -- Stage-1.4 deferred FKs now that lv exists (docs/03 §4/§10.6)
    ALTER TABLE att.overtime_entries
      ADD CONSTRAINT overtime_entries_comp_off_credit_fk
      FOREIGN KEY (comp_off_credit_id) REFERENCES lv.ledger(id);
    ALTER TABLE att.day_records
      ADD CONSTRAINT day_records_leave_type_fk
      FOREIGN KEY (leave_type_id) REFERENCES lv.leave_types(id);

    -- LV-01 seed (docs/09 §1 live types). Rates/caps = DEFAULTS pending P0-T06
    -- sign-off; every number is runtime-editable via PUT /leave/types/{code}.
    INSERT INTO lv.leave_types
      (code, name, is_paid, accrual_per_month, accrual_requires_service_months,
       max_carry_forward, encashable, max_per_request, allow_half_day, sandwich_rule, applicable_gender)
    VALUES
      ('CL',      'Casual Leave',      true,  0.75, 0,  0,    false, 3,    true,  'exclude', NULL),
      ('SL',      'Sick Leave',        true,  0.58, 0,  NULL, false, NULL, true,  'exclude', NULL),
      ('EL',      'Earned Leave',      true,  1.25, 12, 30,   true,  NULL, true,  'include', NULL),
      ('EL_VOTE', 'Election Leave',    true,  0,    0,  0,    false, 1,    false, 'exclude', NULL),
      ('CO',      'Compensatory Off',  true,  0,    0,  NULL, false, NULL, true,  'exclude', NULL),
      ('LWP',     'Loss Of Pay',       false, 0,    0,  NULL, false, NULL, true,  'exclude', NULL),
      ('ML',      'Maternity Leave',   true,  0,    0,  NULL, false, 182,  false, 'include', 'F');
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE att.overtime_entries DROP CONSTRAINT IF EXISTS overtime_entries_comp_off_credit_fk;
    ALTER TABLE att.day_records DROP CONSTRAINT IF EXISTS day_records_leave_type_fk;
    DROP TABLE IF EXISTS lv.rh_selections;
    DROP TABLE IF EXISTS lv.restricted_holidays;
    DROP TABLE IF EXISTS lv.applications;
    DROP TABLE IF EXISTS lv.ledger;
    DROP TABLE IF EXISTS lv.leave_types;
    DROP SCHEMA IF EXISTS lv;
  `);
}
