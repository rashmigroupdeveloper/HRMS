/**
 * Stage 2.0 integrity follow-up (ORG-01..08).
 *
 * 175209 added the org spine after employee data already existed.  Simple
 * id-only foreign keys allowed a plant/location/cost-centre from another
 * company to be attached to an employee.  This forward-only migration keeps
 * the populated data and makes company consistency a database invariant.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);

  pgm.sql(`
    -- Composite unique keys are the referenced keys for company-aware FKs.
    ALTER TABLE core.locations
      ADD CONSTRAINT locations_id_company_uk UNIQUE (id, company_id);
    ALTER TABLE core.plants
      ADD CONSTRAINT plants_id_company_uk UNIQUE (id, company_id);
    ALTER TABLE core.cost_centers
      ADD CONSTRAINT cost_centers_id_company_uk UNIQUE (id, company_id);
    ALTER TABLE core.org_units
      ADD CONSTRAINT org_units_id_company_uk UNIQUE (id, company_id);
    ALTER TABLE core.mis_codes
      ADD CONSTRAINT mis_codes_id_company_uk UNIQUE (id, company_id);

    -- A plant's optional location must belong to that plant's company.
    ALTER TABLE core.plants
      ADD CONSTRAINT plants_location_company_fk
      FOREIGN KEY (location_id, company_id)
      REFERENCES core.locations (id, company_id)
      NOT VALID;

    -- A MIS hierarchy can never cross a legal entity boundary.
    ALTER TABLE core.mis_codes
      ADD CONSTRAINT mis_codes_parent_company_fk
      FOREIGN KEY (parent_id, company_id)
      REFERENCES core.mis_codes (id, company_id)
      NOT VALID;

    -- A cost centre rolls into a plant owned by the same company.
    ALTER TABLE core.cost_centers
      ADD CONSTRAINT cost_centers_plant_company_fk
      FOREIGN KEY (plant_id, company_id)
      REFERENCES core.plants (id, company_id)
      NOT VALID;

    -- The employee org tuple is one company-consistent slice.
    ALTER TABLE core.employees
      ADD CONSTRAINT employees_location_company_fk
      FOREIGN KEY (location_id, company_id)
      REFERENCES core.locations (id, company_id)
      NOT VALID,
      ADD CONSTRAINT employees_cost_center_company_fk
      FOREIGN KEY (cost_center_id, company_id)
      REFERENCES core.cost_centers (id, company_id)
      NOT VALID,
      ADD CONSTRAINT employees_org_unit_company_fk
      FOREIGN KEY (org_unit_id, company_id)
      REFERENCES core.org_units (id, company_id)
      NOT VALID,
      ADD CONSTRAINT employees_plant_company_fk
      FOREIGN KEY (plant_id, company_id)
      REFERENCES core.plants (id, company_id)
      NOT VALID;

    ALTER TABLE core.plants VALIDATE CONSTRAINT plants_location_company_fk;
    ALTER TABLE core.mis_codes VALIDATE CONSTRAINT mis_codes_parent_company_fk;
    ALTER TABLE core.cost_centers VALIDATE CONSTRAINT cost_centers_plant_company_fk;
    ALTER TABLE core.employees VALIDATE CONSTRAINT employees_location_company_fk;
    ALTER TABLE core.employees VALIDATE CONSTRAINT employees_cost_center_company_fk;
    ALTER TABLE core.employees VALIDATE CONSTRAINT employees_org_unit_company_fk;
    ALTER TABLE core.employees VALIDATE CONSTRAINT employees_plant_company_fk;

    -- Keep the expand/contract-compatible text contract until salary
    -- components exist in Stage 2.1, but reject fictional or cross-company
    -- GL combinations at the database boundary.
    CREATE OR REPLACE FUNCTION pay.validate_gl_account_org_codes()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    DECLARE
      v_company_id BIGINT;
      v_plant_id BIGINT;
      v_cost_center_plant_id BIGINT;
    BEGIN
      SELECT id INTO v_company_id
      FROM core.companies
      WHERE code = NEW.company_code;
      IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Unknown company_code: %', NEW.company_code
          USING ERRCODE = '23503';
      END IF;

      SELECT id INTO v_plant_id
      FROM core.plants
      WHERE company_id = v_company_id
        AND plant_code = NEW.plant_code;
      IF v_plant_id IS NULL THEN
        RAISE EXCEPTION 'Unknown plant_code % for company %', NEW.plant_code, NEW.company_code
          USING ERRCODE = '23503';
      END IF;

      SELECT plant_id INTO v_cost_center_plant_id
      FROM core.cost_centers
      WHERE company_id = v_company_id
        AND code = NEW.cost_center_code;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown cost_center_code % for company %', NEW.cost_center_code, NEW.company_code
          USING ERRCODE = '23503';
      END IF;
      IF v_cost_center_plant_id IS NULL OR v_cost_center_plant_id <> v_plant_id THEN
        RAISE EXCEPTION 'Cost centre % is not assigned to plant % for company %',
          NEW.cost_center_code, NEW.plant_code, NEW.company_code
          USING ERRCODE = '23514';
      END IF;

      IF length(btrim(NEW.component_code)) = 0 THEN
        RAISE EXCEPTION 'component_code is required' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $fn$;

    CREATE TRIGGER gl_accounts_org_codes_guard
      BEFORE INSERT OR UPDATE OF company_code, plant_code, cost_center_code, component_code
      ON pay.gl_accounts
      FOR EACH ROW EXECUTE FUNCTION pay.validate_gl_account_org_codes();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS gl_accounts_org_codes_guard ON pay.gl_accounts;
    DROP FUNCTION IF EXISTS pay.validate_gl_account_org_codes();

    ALTER TABLE core.employees
      DROP CONSTRAINT IF EXISTS employees_plant_company_fk,
      DROP CONSTRAINT IF EXISTS employees_org_unit_company_fk,
      DROP CONSTRAINT IF EXISTS employees_cost_center_company_fk,
      DROP CONSTRAINT IF EXISTS employees_location_company_fk;
    ALTER TABLE core.cost_centers
      DROP CONSTRAINT IF EXISTS cost_centers_plant_company_fk;
    ALTER TABLE core.mis_codes
      DROP CONSTRAINT IF EXISTS mis_codes_parent_company_fk;
    ALTER TABLE core.plants
      DROP CONSTRAINT IF EXISTS plants_location_company_fk;

    ALTER TABLE core.mis_codes DROP CONSTRAINT IF EXISTS mis_codes_id_company_uk;
    ALTER TABLE core.org_units DROP CONSTRAINT IF EXISTS org_units_id_company_uk;
    ALTER TABLE core.cost_centers DROP CONSTRAINT IF EXISTS cost_centers_id_company_uk;
    ALTER TABLE core.plants DROP CONSTRAINT IF EXISTS plants_id_company_uk;
    ALTER TABLE core.locations DROP CONSTRAINT IF EXISTS locations_id_company_uk;
  `);
}
