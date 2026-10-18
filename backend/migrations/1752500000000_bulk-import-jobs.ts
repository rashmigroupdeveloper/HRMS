/**
 * Bulk import jobs (CSV + Excel uploads for every bulk import).
 *
 * One row per uploaded file: the parsed rows and the row-level validation
 * report live here between PREVIEW and COMMIT so the commit applies exactly
 * what the user reviewed. Idempotency: the same file (sha256) committed into
 * the same importer + context is refused as a duplicate instead of being
 * applied twice. Large files commit in the background; progress is polled.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE core.bulk_jobs (
      id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      importer      text NOT NULL,
      context       jsonb NOT NULL DEFAULT '{}'::jsonb,
      context_key   text NOT NULL,
      company_id    bigint REFERENCES core.companies(id),
      filename      text NOT NULL,
      file_sha256   text NOT NULL,
      status        text NOT NULL DEFAULT 'previewed'
                    CHECK (status IN ('previewed', 'committing', 'committed', 'failed', 'discarded')),
      total_rows    integer NOT NULL DEFAULT 0,
      error_rows    integer NOT NULL DEFAULT 0,
      warning_rows  integer NOT NULL DEFAULT 0,
      processed_rows integer NOT NULL DEFAULT 0,
      rows          jsonb NOT NULL DEFAULT '[]'::jsonb,
      report        jsonb NOT NULL DEFAULT '[]'::jsonb,
      result        jsonb,
      error         text,
      created_by    bigint NOT NULL REFERENCES core.users(id),
      created_at    timestamptz NOT NULL DEFAULT now(),
      committed_by  bigint REFERENCES core.users(id),
      committed_at  timestamptz,
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX bulk_jobs_importer_created_idx ON core.bulk_jobs (importer, created_at DESC);
    CREATE INDEX bulk_jobs_created_by_idx ON core.bulk_jobs (created_by, created_at DESC);
    -- Idempotent re-upload: one committed (or committing) job per file + importer + context.
    CREATE UNIQUE INDEX bulk_jobs_idempotency_uq ON core.bulk_jobs (importer, context_key, file_sha256)
      WHERE status IN ('committing', 'committed');
    CREATE TRIGGER bulk_jobs_updated_at BEFORE UPDATE ON core.bulk_jobs
      FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS core.bulk_jobs;`);
}
