/** LC-01/D4: one immutable receipt per accepted ATS offer; no employee creation. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';
    CREATE TABLE core.ats_acceptance_receipts (
      event_id UUID PRIMARY KEY, ats_offer_id BIGINT NOT NULL UNIQUE CHECK(ats_offer_id>0),
      candidate_id BIGINT NOT NULL UNIQUE REFERENCES core.onboarding_candidates(id),
      source_digest TEXT NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
      accepted_at TIMESTAMPTZ NOT NULL, accepted_by_subject TEXT NOT NULL CHECK(accepted_by_subject ~ '^[1-9][0-9]*$'),
      evidence_ref TEXT NOT NULL CHECK(length(btrim(evidence_ref)) BETWEEN 1 AND 2000),
      received_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK(accepted_at<=received_at)
    );
    CREATE FUNCTION core.ats_receipt_immutable() RETURNS trigger AS $$ BEGIN
      RAISE EXCEPTION 'ATS acceptance receipts are append-only (LC-01)';
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER ats_receipt_immutable BEFORE UPDATE OR DELETE ON core.ats_acceptance_receipts
      FOR EACH ROW EXECUTE FUNCTION core.ats_receipt_immutable();
    INSERT INTO core.settings(key,value,value_type,description) VALUES('integration.ats.assertion_max_seconds','120'::jsonb,'number','NFR-03: maximum lifetime of ATS onboarding signed client assertions') ON CONFLICT(key) DO NOTHING;
  `);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(
    `SET lock_timeout = '5s'; DROP TABLE core.ats_acceptance_receipts; DROP FUNCTION core.ats_receipt_immutable();`,
  );
}
