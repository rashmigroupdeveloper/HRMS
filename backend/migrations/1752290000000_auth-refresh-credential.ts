/** NFR-03: sponsor-approved single-use refresh, existing session identity. */
import type { MigrationBuilder } from 'node-pg-migrate';
export function up(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`ALTER TABLE sec.sessions ADD COLUMN refresh_token_hash TEXT
    CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$');`);
}
export function down(pgm: MigrationBuilder): void {
  pgm.sql(`SET lock_timeout = '5s';`);
  pgm.sql(`ALTER TABLE sec.sessions DROP COLUMN refresh_token_hash;`);
}
