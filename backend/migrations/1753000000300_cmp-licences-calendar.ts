/**
 * Migration — `cmp` schema: statutory registrations, licences and compliance
 * calendar with filing evidence & RBAC permissions (Phase 5, Stage 5.7 · CMP-15..20).
 *
 * Implements:
 *  1. `cmp.registrations` for entity/plant licences, perpetual vs expiring validity,
 *     unique live registrations per kind.
 *  2. `cmp.calendar_items` for recurring statutory obligations (overdue is derived,
 *     never stored).
 *  3. `cmp.filing_evidence` append-only audit trail (immutable via database trigger).
 *  4. Core RBAC permissions: cmp.licence.manage, cmp.calendar.manage, cmp.evidence.upload.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';

    CREATE SCHEMA IF NOT EXISTS cmp;

    ------------------------------------------------------------------
    -- Registrations & licences (CMP-15)
    ------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS cmp.registrations (
      id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id            BIGINT NOT NULL REFERENCES core.companies(id),
      location_id           BIGINT REFERENCES core.locations(id),
      kind                  TEXT NOT NULL
                              CHECK (kind IN ('pf','esic','pt','lwf','factory_licence',
                                              'clra_licence','shops','single_registration','other')),
      registration_no       TEXT NOT NULL,
      issuing_authority     TEXT,
      valid_from            DATE NOT NULL,
      valid_to              DATE,
      renewal_owner_user_id BIGINT REFERENCES core.users(id),
      document_path         TEXT,
      notes                 TEXT,
      is_active             BOOLEAN NOT NULL DEFAULT true,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT registrations_validity_ordered
        CHECK (valid_to IS NULL OR valid_to > valid_from),
      CONSTRAINT registrations_number_present
        CHECK (length(btrim(registration_no)) > 0)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS registrations_unique_live
      ON cmp.registrations (company_id, COALESCE(location_id, 0), kind, registration_no)
      WHERE is_active;
    CREATE INDEX IF NOT EXISTS registrations_expiry_idx ON cmp.registrations (valid_to)
      WHERE is_active AND valid_to IS NOT NULL;

    DROP TRIGGER IF EXISTS registrations_updated_at ON cmp.registrations;
    CREATE TRIGGER registrations_updated_at BEFORE UPDATE ON cmp.registrations
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ------------------------------------------------------------------
    -- Compliance calendar (CMP-17)
    ------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS cmp.calendar_items (
      id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id         BIGINT NOT NULL REFERENCES core.companies(id),
      obligation_code    TEXT NOT NULL,
      title              TEXT NOT NULL,
      frequency          TEXT NOT NULL
                           CHECK (frequency IN ('monthly','quarterly','half_yearly','annual','one_off')),
      period_label       TEXT NOT NULL,
      due_on             DATE NOT NULL,
      owner_user_id      BIGINT REFERENCES core.users(id),
      status             TEXT NOT NULL DEFAULT 'due'
                           CHECK (status IN ('due','filed','waived')),
      registration_id    BIGINT REFERENCES cmp.registrations(id),
      filed_at           TIMESTAMPTZ,
      filed_by_user_id   BIGINT REFERENCES core.users(id),
      waived_reason      TEXT,
      waived_by_user_id  BIGINT REFERENCES core.users(id),
      waived_at          TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT calendar_filed_pairs CHECK (
        (status <> 'filed') OR (filed_at IS NOT NULL AND filed_by_user_id IS NOT NULL)
      ),
      CONSTRAINT calendar_waived_pairs CHECK (
        (status <> 'waived')
        OR (waived_at IS NOT NULL AND waived_by_user_id IS NOT NULL
            AND waived_reason IS NOT NULL AND length(btrim(waived_reason)) >= 3)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS calendar_period_unique
      ON cmp.calendar_items (company_id, obligation_code, period_label);
    CREATE INDEX IF NOT EXISTS calendar_due_idx ON cmp.calendar_items (due_on, status);

    DROP TRIGGER IF EXISTS calendar_items_updated_at ON cmp.calendar_items;
    CREATE TRIGGER calendar_items_updated_at BEFORE UPDATE ON cmp.calendar_items
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ------------------------------------------------------------------
    -- Filing evidence (CMP-18) — append-only
    ------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS cmp.filing_evidence (
      id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      calendar_item_id BIGINT NOT NULL REFERENCES cmp.calendar_items(id),
      reference        TEXT NOT NULL,
      document_path    TEXT,
      remark           TEXT,
      filed_by_user_id BIGINT NOT NULL REFERENCES core.users(id),
      recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT evidence_reference_present CHECK (length(btrim(reference)) >= 2)
    );
    CREATE INDEX IF NOT EXISTS evidence_item_idx ON cmp.filing_evidence (calendar_item_id, recorded_at DESC);

    CREATE OR REPLACE FUNCTION cmp.filing_evidence_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'cmp.filing_evidence is append-only (CMP-18 / audit evidence)';
    END $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS filing_evidence_immutable ON cmp.filing_evidence;
    CREATE TRIGGER filing_evidence_immutable BEFORE UPDATE OR DELETE ON cmp.filing_evidence
      FOR EACH ROW EXECUTE FUNCTION cmp.filing_evidence_immutable();

    ------------------------------------------------------------------
    -- Permissions (CMP-15..20)
    ------------------------------------------------------------------
    INSERT INTO core.permissions (code)
    VALUES
      ('cmp.licence.manage'),
      ('cmp.calendar.manage'),
      ('cmp.evidence.upload')
    ON CONFLICT (code) DO NOTHING;

    -- Grant to hr_head (all scope)
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
    SELECT r.id, p.id, 'all'
    FROM core.roles r
    CROSS JOIN core.permissions p
    WHERE r.code = 'hr_head'
      AND p.code IN ('cmp.licence.manage', 'cmp.calendar.manage', 'cmp.evidence.upload')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Grant to hr_ops (org_unit scope for calendar and evidence)
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
    SELECT r.id, p.id, 'org_unit'
    FROM core.roles r
    CROSS JOIN core.permissions p
    WHERE r.code = 'hr_ops'
      AND p.code IN ('cmp.calendar.manage', 'cmp.evidence.upload')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Grant to super_admin (all scope)
    INSERT INTO core.role_permissions (role_id, permission_id, scope)
    SELECT r.id, p.id, 'all'
    FROM core.roles r
    CROSS JOIN core.permissions p
    WHERE r.code = 'super_admin'
      AND p.code IN ('cmp.licence.manage', 'cmp.calendar.manage', 'cmp.evidence.upload')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS cmp.filing_evidence;
    DROP FUNCTION IF EXISTS cmp.filing_evidence_immutable();
    DROP TABLE IF EXISTS cmp.calendar_items;
    DROP TABLE IF EXISTS cmp.registrations;
    DROP SCHEMA IF EXISTS cmp;
  `);
}
