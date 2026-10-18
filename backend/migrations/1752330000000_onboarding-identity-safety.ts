/** LC-01/NFR-03/CORE-02: hash-only prejoin links and non-truncating entity sequences. No new fields. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE core.onboarding_candidates ADD CONSTRAINT prejoin_raw_token_forbidden
      CHECK (prejoin_link_token IS NULL) NOT VALID;
    -- Existing issued links continue to authorize through their independent hash.
    -- Never copy raw credentials into audit/history or attempt to restore them.
    UPDATE core.onboarding_candidates SET prejoin_link_token = NULL WHERE prejoin_link_token IS NOT NULL;
    ALTER TABLE core.onboarding_candidates VALIDATE CONSTRAINT prejoin_raw_token_forbidden;
    INSERT INTO core.settings (key,value,value_type,description)
      VALUES ('lifecycle.prejoin_token_hours','72'::jsonb,'number',
        'LC-01: prejoin link lifetime in hours; previous implementation value retained pending HR policy acceptance')
      ON CONFLICT (key) DO NOTHING;
    CREATE OR REPLACE FUNCTION core.next_ecode(p_company_id BIGINT) RETURNS TEXT AS $$
    DECLARE v_seq INTEGER; v_prefix TEXT;
    BEGIN
      UPDATE core.companies SET ecode_next_seq = ecode_next_seq + 1
      WHERE id = p_company_id AND ecode_next_seq > 0 AND btrim(ecode_prefix) <> ''
      RETURNING ecode_next_seq - 1, ecode_prefix INTO v_seq, v_prefix;
      IF NOT FOUND THEN RAISE EXCEPTION 'Missing entity or invalid employee code series configuration'; END IF;
      RETURN v_prefix || lpad(v_seq::text, greatest(6,length(v_seq::text)), '0');
    END $$ LANGUAGE plpgsql;
  `);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(
    `ALTER TABLE core.onboarding_candidates DROP CONSTRAINT IF EXISTS prejoin_raw_token_forbidden;`,
  );
  // The additive setting and compatible allocator safety fix remain for older
  // app versions. Redacted credentials cannot be restored. Base-schema down
  // drops both tables/function during an empty-database rollback rehearsal.
}
