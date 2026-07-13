/**
 * Migration 0016 — preserve the parallel-branch policy feature after the merge:
 * a policy may be published as a short `body_summary` with NO document file
 * (a quick notice), in addition to our document-backed model. Additive only:
 * an optional summary column + relaxing document_id to nullable.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`
    ALTER TABLE core.policies ADD COLUMN IF NOT EXISTS body_summary TEXT;
    ALTER TABLE core.policies ALTER COLUMN document_id DROP NOT NULL;
    -- a policy must carry SOMETHING to read: a document or a summary
    ALTER TABLE core.policies ADD CONSTRAINT policies_has_content
      CHECK (document_id IS NOT NULL OR body_summary IS NOT NULL);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE core.policies DROP CONSTRAINT IF EXISTS policies_has_content;
    ALTER TABLE core.policies DROP COLUMN IF EXISTS body_summary;
  `);
}
