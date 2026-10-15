/**
 * Migration — document vault spine (Phase 5 Stage 5.4 · DOC-01/02/03).
 * Spec: plans/phase-5-compliance-and-trust.md · docs/15 GAP-B09/B10.
 *
 * Reuses `core.documents` as the single file registry (letters, policies and
 * vault uploads already land there). We only add the columns a vault needs that
 * letters never did: an expiry date and a lifecycle status. The type catalog
 * lives in `doc.types` so mandatory/expiry rules stay data, not code.
 *
 * DOC-06 e-sign and PLT-01 sandbox are deliberately NOT in this migration.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ------------------------------------------------------------------
    -- Vault columns on the existing file registry
    ------------------------------------------------------------------
    ALTER TABLE core.documents
      ADD COLUMN IF NOT EXISTS expires_on DATE,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

    -- Backfill-safe: only constrain once the column exists for every row.
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'documents_status_check'
      ) THEN
        ALTER TABLE core.documents
          ADD CONSTRAINT documents_status_check
          CHECK (status IN ('active', 'superseded', 'withdrawn'));
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS documents_owner_kind_idx
      ON core.documents (owner_employee_id, kind)
      WHERE owner_employee_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS documents_expires_idx
      ON core.documents (expires_on)
      WHERE expires_on IS NOT NULL AND status = 'active';

    ------------------------------------------------------------------
    -- DOC-01 type catalog
    ------------------------------------------------------------------
    CREATE SCHEMA IF NOT EXISTS doc;

    CREATE TABLE IF NOT EXISTS doc.types (
      code                TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      -- NULL = never expires (PAN). Set = medical fitness, licences, etc.
      typically_expires   BOOLEAN NOT NULL DEFAULT false,
      -- Retention class code — links later to prv.retention_rules (Stage 5.3).
      retention_class     TEXT,
      -- Comma-separated employment categories for which this type is mandatory
      -- (e.g. 'blue_collar,trainee'). Empty = never mandatory by category.
      mandatory_for       TEXT NOT NULL DEFAULT '',
      sort_order          SMALLINT NOT NULL DEFAULT 100,
      is_active           BOOLEAN NOT NULL DEFAULT true,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT types_code_present CHECK (length(btrim(code)) > 0),
      CONSTRAINT types_name_present CHECK (length(btrim(name)) > 0)
    );
    CREATE TRIGGER doc_types_updated_at BEFORE UPDATE ON doc.types
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    INSERT INTO doc.types (code, name, typically_expires, retention_class, mandatory_for, sort_order)
    VALUES
      ('pan',              'PAN card',              false, 'statutory_id', '',                          10),
      ('aadhaar',          'Aadhaar',               false, 'statutory_id', '',                          20),
      ('appointment',      'Appointment letter',    false, 'employment',   'white_collar,blue_collar',  30),
      ('medical_fitness',  'Medical fitness',       true,  'health',       'blue_collar',               40)
    ON CONFLICT (code) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS doc.types;
    DROP SCHEMA IF EXISTS doc;
    DROP INDEX IF EXISTS core.documents_expires_idx;
    DROP INDEX IF EXISTS core.documents_owner_kind_idx;
    ALTER TABLE core.documents DROP CONSTRAINT IF EXISTS documents_status_check;
    ALTER TABLE core.documents DROP COLUMN IF EXISTS status;
    ALTER TABLE core.documents DROP COLUMN IF EXISTS expires_on;
  `);
}
