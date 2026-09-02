/**
 * M8 — Asset registry (AST-01…AST-06), schema per docs/03 §9.
 *
 * Two requirements are load-bearing and encoded as constraints, not as app
 * conventions, because the app is not the only thing that will ever write here:
 *
 *   AST-02 — warranty dates accept PAST dates. greytHR blocked them, which
 *            forced staff to enter a wrong date for kit registered after issue.
 *            There is deliberately NO check constraint on warranty_till.
 *   AST-03 — a holder is an employee OR a third party, never both and never
 *            neither. A CHECK enforces the XOR so an orphaned assignment
 *            cannot exist (it would silently disappear from exit clearance).
 *
 * AST-04/05 depend on being able to ask "what is still out?", so the partial
 * unique index guarantees one open assignment per asset — an asset cannot be
 * in two people's hands at once.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS ast;

    CREATE TABLE ast.assets (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      asset_no TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      serial_no TEXT,
      purchase_date DATE,
      -- AST-02: past dates are VALID. No constraint here on purpose.
      warranty_till DATE,
      status TEXT NOT NULL DEFAULT 'in_stock'
        CHECK (status IN ('in_stock','assigned','maintenance','lost','scrapped')),
      location_id BIGINT REFERENCES core.locations(id),
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      created_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX assets_search_idx ON ast.assets (company_id, status, category);
    CREATE INDEX assets_serial_idx ON ast.assets (serial_no) WHERE serial_no IS NOT NULL;

    CREATE TABLE ast.assignments (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES ast.assets(id),
      holder_kind TEXT NOT NULL CHECK (holder_kind IN ('employee','third_party')),
      employee_id BIGINT REFERENCES core.employees(id),
      third_party_name TEXT,
      third_party_org TEXT,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      returned_at TIMESTAMPTZ,
      return_condition TEXT CHECK (return_condition IN ('ok','damaged','not_returned')),
      notes TEXT,
      assigned_by BIGINT NOT NULL REFERENCES core.users(id),
      returned_by BIGINT REFERENCES core.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

      -- AST-03: exactly one kind of holder, always identifiable.
      CONSTRAINT assignments_holder_xor CHECK (
        (holder_kind = 'employee'    AND employee_id IS NOT NULL AND third_party_name IS NULL)
        OR
        (holder_kind = 'third_party' AND employee_id IS NULL     AND third_party_name IS NOT NULL)
      ),
      -- A return needs both a timestamp and a condition, or neither.
      CONSTRAINT assignments_return_complete CHECK (
        (returned_at IS NULL AND return_condition IS NULL)
        OR
        (returned_at IS NOT NULL AND return_condition IS NOT NULL)
      )
    );
    -- An asset can be out with only one holder at a time (AST-04/05 depend on it).
    CREATE UNIQUE INDEX assignments_one_open_per_asset
      ON ast.assignments (asset_id) WHERE returned_at IS NULL;
    CREATE INDEX assignments_employee_idx
      ON ast.assignments (employee_id) WHERE employee_id IS NOT NULL;

    CREATE TABLE ast.maintenance (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES ast.assets(id),
      kind TEXT NOT NULL CHECK (kind IN ('scheduled','incident','damage','lost')),
      scheduled_for DATE,
      reported_by BIGINT REFERENCES core.users(id),
      description TEXT NOT NULL,
      resolved_at TIMESTAMPTZ,
      resolution TEXT,
      cost NUMERIC(12,2) CHECK (cost IS NULL OR cost >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX maintenance_asset_idx ON ast.maintenance (asset_id, created_at DESC);
    CREATE INDEX maintenance_open_idx
      ON ast.maintenance (scheduled_for) WHERE resolved_at IS NULL;

    COMMENT ON TABLE ast.assets IS 'AST-01 asset registry; warranty_till accepts past dates (AST-02)';
    COMMENT ON TABLE ast.assignments IS 'AST-03 employee/third-party allocation; open row = still held (AST-04/05)';
    COMMENT ON TABLE ast.maintenance IS 'AST-06 maintenance, incident, damage and loss trail';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS ast.maintenance;
    DROP TABLE IF EXISTS ast.assignments;
    DROP TABLE IF EXISTS ast.assets;
    DROP SCHEMA IF EXISTS ast;
  `);
}
