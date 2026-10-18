/** Read-mostly DB access for assertions the UI cannot expose (e.g. the e-mail outbox). Test DB only. */
import pg from 'pg';
import { DATABASE_URL } from './env';

let pool: pg.Pool | undefined;
export function db(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
  return pool;
}
export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db().query(sql, params);
  return r.rows as T[];
}
export async function closeDb(): Promise<void> { await pool?.end(); pool = undefined; }
