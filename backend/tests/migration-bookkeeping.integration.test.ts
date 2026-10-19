/** CORE-08: cleanup refuses unknown data/columns and preserves canonical history. */
import { describe, expect, it } from 'vitest';
import type { MigrationBuilder } from 'node-pg-migrate';
import { sql } from 'kysely';
import { createDatabase } from '../src/core/db/database.js';
import { up } from '../migrations/1753000000400_duplicate-migration-bookkeeping.js';
const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('duplicate migration bookkeeping guard', () => {
  it('removes only known duplicate tracking metadata, refusing other contents', async () => {
    const db = createDatabase(url ?? '');
    const statements: string[] = [];
    up({
      sql: (statement: string) => {
        statements.push(statement);
      },
    } as unknown as MigrationBuilder);
    const rollback = new Error('Intentional bookkeeping rollback');
    try {
      for (const fault of ['column', 'record', 'none'] as const) {
        const run = db.transaction().execute(async (tx) => {
          await sql`CREATE TABLE IF NOT EXISTS public.undefined (
            id SERIAL PRIMARY KEY, name varchar(255), run_on timestamp without time zone
          )`.execute(tx);
          if (fault === 'column')
            await sql`ALTER TABLE public.undefined ADD COLUMN unexpected_fixture_column text`.execute(
              tx,
            );
          if (fault === 'record')
            await sql`INSERT INTO public.undefined(name,run_on) VALUES ('unknown_fixture_migration',now())`.execute(
              tx,
            );
          if (fault === 'none') {
            await sql`INSERT INTO public.undefined(name,run_on) SELECT name,run_on FROM public.pgmigrations
              WHERE name='1753000000100_document-vault-permissions'`.execute(tx);
          }
          for (const statement of statements) await sql`${sql.raw(statement)}`.execute(tx);
          const remaining = await sql<{
            removed: boolean;
          }>`SELECT to_regclass('public.undefined') IS NULL AS removed`.execute(tx);
          expect(remaining.rows[0]?.removed).toBe(true);
          throw rollback;
        });
        if (fault === 'none') await expect(run).rejects.toBe(rollback);
        else
          await expect(run).rejects.toThrow(
            fault === 'column' ? /Unexpected.*columns/ : /not canonical duplicates/,
          );
      }
    } finally {
      await db.destroy();
    }
  });
});
