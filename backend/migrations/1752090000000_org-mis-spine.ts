/**
 * Stage 2.0 — company / plant / MIS spine (ORG-01..08).
 * Spec: plans/phase-2-payroll-statutory.md Stage 2.0.
 *
 * MIS codes and plant codes are NOT seeded with invented Finance values.
 * Admins fill them via /admin/masters. plant_id stays nullable until the
 * live recon backfill (P0-T30) — a NOT NULL on active India staff would lock
 * the 1,066-row master before the mapping exists.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    ALTER TABLE core.companies
      ADD COLUMN sap_company_code TEXT UNIQUE;

    CREATE TABLE core.plants (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      plant_code TEXT NOT NULL,
      name TEXT NOT NULL,
      location_id BIGINT REFERENCES core.locations(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, plant_code),
      CHECK (length(btrim(plant_code)) > 0)
    );
    CREATE TRIGGER plants_updated_at BEFORE UPDATE ON core.plants
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    CREATE TABLE core.mis_codes (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES core.companies(id),
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id BIGINT REFERENCES core.mis_codes(id),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, code),
      CHECK (length(btrim(code)) > 0)
    );
    CREATE TRIGGER mis_codes_updated_at BEFORE UPDATE ON core.mis_codes
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

    ALTER TABLE core.cost_centers
      ADD COLUMN plant_id BIGINT REFERENCES core.plants(id);

    ALTER TABLE core.departments
      ADD COLUMN mis_code_id BIGINT REFERENCES core.mis_codes(id);

    ALTER TABLE core.employees
      ADD COLUMN plant_id BIGINT REFERENCES core.plants(id);

    CREATE SCHEMA IF NOT EXISTS pay;
    CREATE TABLE pay.gl_accounts (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      company_code TEXT NOT NULL,
      plant_code TEXT NOT NULL,
      cost_center_code TEXT NOT NULL,
      component_code TEXT NOT NULL,
      gl_code TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_code, plant_code, cost_center_code, component_code),
      CHECK (length(btrim(gl_code)) > 0)
    );
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS pay.gl_accounts;
    ALTER TABLE core.employees DROP COLUMN IF EXISTS plant_id;
    ALTER TABLE core.departments DROP COLUMN IF EXISTS mis_code_id;
    ALTER TABLE core.cost_centers DROP COLUMN IF EXISTS plant_id;
    DROP TABLE IF EXISTS core.mis_codes;
    DROP TABLE IF EXISTS core.plants;
    ALTER TABLE core.companies DROP COLUMN IF EXISTS sap_company_code;
  `);
}
