/** Test migration DDL on a TEMP table only; never alter the application table. */
import 'dotenv/config';
import { describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import type { MigrationBuilder } from 'node-pg-migrate';
import { up, down } from '../migrations/1752210000000_attendance-session-off.js';
import { createDatabase } from '../src/core/db/database.js';

const url = process.env['DATABASE_URL'];
describe.skipIf(!url)('ATT-05 database session constraint (temporary table)', () => {
  it('accepts supported pairs, rejects malformed sessions and refuses a lossy downgrade', async () => {
    const db = createDatabase(url ?? '');
    try {
      await db.transaction().execute(async (trx) => {
        await sql`CREATE TEMP TABLE session_constraint_fixture (session_statuses JSONB) ON COMMIT DROP`.execute(trx);
        const statements: string[] = [];
        const builder = { sql: (statement: string) => { statements.push(statement); } } as MigrationBuilder;
        up(builder);
        for (const statement of statements) {
          await sql.raw(statement.replaceAll('att.day_records', 'pg_temp.session_constraint_fixture')).execute(trx);
        }
        for (const [first, second] of [['P', 'P'], ['A', 'P'], ['P', 'A'], ['A', 'A'], ['P', 'O']]) {
          const value = JSON.stringify([{ session: 1, status: first }, { session: 2, status: second }]);
          await sql`INSERT INTO pg_temp.session_constraint_fixture VALUES (${value}::jsonb)`.execute(trx);
        }
        for (const value of [
          {}, [], [{ session: 1, status: 'P' }],
          [{ session: 1, status: 'P' }, { session: 1, status: 'A' }],
          [{ session: 2, status: 'A' }, { session: 1, status: 'P' }],
          [{ session: 1, status: 'X' }, { session: 2, status: 'A' }],
          [{ session: 1 }, { session: 2, status: 'A' }],
        ]) {
          await sql`SAVEPOINT invalid_fixture`.execute(trx);
          await expect(sql`INSERT INTO pg_temp.session_constraint_fixture VALUES (${JSON.stringify(value)}::jsonb)`
            .execute(trx)).rejects.toMatchObject({ code: '23514' });
          await sql`ROLLBACK TO SAVEPOINT invalid_fixture`.execute(trx);
        }
        statements.length = 0;
        down(builder);
        await sql`SAVEPOINT downgrade_fixture`.execute(trx);
        await sql.raw(statements[0] ?? '').execute(trx);
        await expect(sql.raw((statements[1] ?? '').replaceAll('att.day_records', 'pg_temp.session_constraint_fixture'))
          .execute(trx)).rejects.toThrow('Cannot remove off-session support');
        await sql`ROLLBACK TO SAVEPOINT downgrade_fixture`.execute(trx);
        await sql`DELETE FROM pg_temp.session_constraint_fixture WHERE session_statuses->1->>'status' = 'O'`.execute(trx);
        for (const statement of statements) {
          await sql.raw(statement.replaceAll('att.day_records', 'pg_temp.session_constraint_fixture')).execute(trx);
        }
      });
    } finally {
      await db.destroy();
    }
  });
});
