import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types.js';

// BIGINT (int8) comes back as string by default; our identity ids stay far
// below 2^53, so plain JS numbers are safe and far more ergonomic.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

/**
 * Database factory — connections are created explicitly by the entrypoint,
 * never as an import side effect (tests must be able to import anything
 * without touching a live database).
 *
 * Production connects through PgBouncer (docs/13 §0.1); this factory doesn't
 * care — it just takes a connection string.
 */
export function createDatabase(connectionString: string): Kysely<Database> {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
  });

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}
