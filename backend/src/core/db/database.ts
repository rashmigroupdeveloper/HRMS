import { Kysely, PostgresDialect, type Transaction } from 'kysely';
import pg from 'pg';
import { logger } from '../logger.js';
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
  // PAY-005: an idle client that loses its connection (DB restart, PgBouncer recycle) emits
  // 'error' on the pool; unhandled, that kills the process. Log it; the pool replaces the client.
  pool.on('error', (err) => { logger.error({ err }, 'postgres idle client error (connection dropped; pool will reconnect)'); });

  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });
}

/**
 * S-25: a DATE column is a calendar day, not an instant. pg's default parser
 * builds a LOCAL-midnight Date, so `toISOString().slice(0, 10)` shifts the day
 * back by one on any server east of UTC (IST). Parsing at UTC midnight makes
 * both `toISOString()` and the local getters used by `formatDbDate` return the
 * stored day for UTC and every UTC+ offset the product runs in.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => (v === 'infinity' || v === '-infinity' ? new Date(NaN) : new Date(`${v}T00:00:00Z`)));

/**
 * Runs `fn` in a transaction, or directly in the caller's transaction when
 * `db` already is one (services compose: a workflow request created inside a
 * domain transaction must not try to open a second, independent one).
 */
export async function inTransaction<T>(
  db: Kysely<Database> | Transaction<Database>,
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  if (db.isTransaction) return fn(db as Transaction<Database>);
  return db.transaction().execute(fn);
}
