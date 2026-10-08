/** NFR-04 / W1-T05: rollback rehearsal on an empty, explicitly disposable database. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { runner } from 'node-pg-migrate';
import { sql } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import { logger } from '../src/core/logger.js';

async function main(): Promise<void> {
  const url = process.env['MIGRATION_TEST_DATABASE_URL'];
  if (!url || !new URL(url).pathname.endsWith('_migration_test')) {
    throw new Error('MIGRATION_TEST_DATABASE_URL must name a disposable *_migration_test database');
  }
  const db = createDatabase(url);
  try {
    const existing = await sql<{ count: string }>`
      SELECT count(*)::text AS count FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
    `.execute(db);
    assert.equal(existing.rows[0]?.count, '0', 'Migration rehearsal requires an EMPTY database');
    const options = {
      databaseUrl: url,
      dir: 'migrations',
      ignorePattern: '.*\\.md',
      migrationsTable: 'pgmigrations',
      log: (message: string) => { logger.debug(message); },
    };
    const first = await runner({ ...options, direction: 'up' });
    assert.ok(first.length > 0, 'No migrations discovered');
    const second = await runner({ ...options, direction: 'up' });
    assert.equal(second.length, 0, 'Second up must apply no migrations');
    const down = await runner({ ...options, direction: 'down', count: first.length });
    assert.equal(down.length, first.length, 'Every migration must roll back');
    const restored = await runner({ ...options, direction: 'up' });
    assert.deepEqual(restored.map((m) => m.name), first.map((m) => m.name));
    logger.info({ migrations: first.length }, 'Migration up → up → down-all → up passed');
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  logger.error(error, 'Migration rehearsal failed');
  process.exitCode = 1;
});
