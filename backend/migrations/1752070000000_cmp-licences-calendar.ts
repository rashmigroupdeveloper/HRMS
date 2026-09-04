/**
 * Migration — `cmp` schema: statutory registrations, licences and the
 * compliance calendar (Phase 5, Stage 5.7 · CMP-15..CMP-20).
 * Spec: plans/phase-5-compliance-and-trust.md · docs/15 GAP-A05/A24/A25.
 *
 * The problem this solves: fourteen legal entities across several plants, each
 * holding PF/ESIC/PT/LWF codes, a Factory licence, a CLRA licence and a Shops
 * registration — every one with its own expiry, its own renewal owner and its
 * own filing rhythm. Today that lives in spreadsheets and individual memory,
 * which is why a lapse is discovered by an inspector rather than by us.
 *
 * Two design decisions worth stating, because they are easy to get wrong:
 *
 *  1. `overdue` is NOT a stored status. It is derived from `due_on` against
 *     today, every time it is read. A stored overdue flag needs a nightly job
 *     to stay true, and the day that job fails is precisely the day the board
 *     shows green while a filing is late.
 *  2. Marking an obligation `filed` requires EVIDENCE — an append-only row in
 *     `cmp.filing_evidence` — or an explicit, reasoned waiver. A tick box with
 *     nothing behind it is what an audit finds unconvincing, and rightly so.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    CREATE SCHEMA IF NOT EXISTS cmp;

    ------------------------------------------------------------------
    -- Registrations & licences (CMP-15)
    -- location_id NULL = the registration is held at entity level (a PF code);
    -- NOT NULL = it belongs to one plant (a Factory or CLRA licence).
    ------------------------------------------------------------------
    CREATE TABLE cmp.registrations (
      id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id            BIGINT NOT NULL REFERENCES core.companies(id),
      location_id           BIGINT REFERENCES core.locations(id),
      kind                  TEXT NOT NULL
                              CHECK (kind IN ('pf','esic','pt','lwf','factory_licence',
                                              'clra_licence','shops','single_registration','other')),
      registration_no       TEXT NOT NULL,
      issuing_authority     TEXT,
      valid_from            DATE NOT NULL,
      -- NULL = perpetual. A PF code does not expire; a Factory licence does.
      -- Conflating the two would make every PF code look permanently valid
      -- against a threshold it should never be measured by.
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
    -- One live registration of a kind per entity/plant. COALESCE because a NULL
    -- location must still collide with another NULL location in a unique index.
    CREATE UNIQUE INDEX registrations_unique_live
      ON cmp.registrations (company_id, COALESCE(location_id, 0), kind, registration_no)
      WHERE is_active;
    CREATE INDEX registrations_expiry_idx ON cmp.registrations (valid_to)
      WHERE is_active AND valid_to IS NOT NULL;
    CREATE TRIGGER registrations_updated_at BEFORE UPDATE ON cmp.registrations
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ------------------------------------------------------------------
    -- Compliance calendar (CMP-17)
    ------------------------------------------------------------------
    CREATE TABLE cmp.calendar_items (
      id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id         BIGINT NOT NULL REFERENCES core.companies(id),
      obligation_code    TEXT NOT NULL,          -- 'pf_ecr' | 'esic' | 'pt' | 'tds_24q' | 'posh_annual' | ...
      title              TEXT NOT NULL,
      frequency          TEXT NOT NULL
                           CHECK (frequency IN ('monthly','quarterly','half_yearly','annual','one_off')),
      period_label       TEXT NOT NULL,          -- 'Aug 2026' | 'FY 2026-27 Q2' | 'CY 2026'
      due_on             DATE NOT NULL,
      owner_user_id      BIGINT REFERENCES core.users(id),
      -- 'overdue' is deliberately absent: it is derived from due_on (see header).
      status             TEXT NOT NULL DEFAULT 'due'
                           CHECK (status IN ('due','filed','waived')),
      registration_id    BIGINT REFERENCES cmp.registrations(id),  -- licence-renewal items
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
      -- A waiver without a stated reason is the loophole that makes the whole
      -- calendar meaningless, so the database refuses it.
      CONSTRAINT calendar_waived_pairs CHECK (
        (status <> 'waived')
        OR (waived_at IS NOT NULL AND waived_by_user_id IS NOT NULL
            AND waived_reason IS NOT NULL AND length(btrim(waived_reason)) >= 3)
      )
    );
    CREATE UNIQUE INDEX calendar_period_unique
      ON cmp.calendar_items (company_id, obligation_code, period_label);
    CREATE INDEX calendar_due_idx ON cmp.calendar_items (due_on, status);
    CREATE TRIGGER calendar_items_updated_at BEFORE UPDATE ON cmp.calendar_items
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ------------------------------------------------------------------
    -- Filing evidence (CMP-18) — append-only, like sec.access_events.
    -- This is the artefact an inspector asks for; it must not be editable
    -- after the fact by the same people whose filing it evidences.
    ------------------------------------------------------------------
    CREATE TABLE cmp.filing_evidence (
      id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      calendar_item_id BIGINT NOT NULL REFERENCES cmp.calendar_items(id),
      reference        TEXT NOT NULL,          -- challan / acknowledgement number
      document_path    TEXT,
      remark           TEXT,
      filed_by_user_id BIGINT NOT NULL REFERENCES core.users(id),
      recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT evidence_reference_present CHECK (length(btrim(reference)) >= 2)
    );
    CREATE INDEX evidence_item_idx ON cmp.filing_evidence (calendar_item_id, recorded_at DESC);

    CREATE OR REPLACE FUNCTION cmp.filing_evidence_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'cmp.filing_evidence is append-only (CMP-18 / audit evidence)';
    END $$ LANGUAGE plpgsql;

    CREATE TRIGGER filing_evidence_immutable BEFORE UPDATE OR DELETE ON cmp.filing_evidence
      FOR EACH ROW EXECUTE FUNCTION cmp.filing_evidence_immutable();
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
