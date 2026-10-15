/** A non-loginable baseline administrator keeps suite cleanup independent. */
import pg from 'pg';
import { config } from 'dotenv';
import { testDatabaseTarget } from './test-database-target.js';

export default async function setup(): Promise<void> {
  config();
  const url = testDatabaseTarget(process.env);
  if (!url) return;
  const pool = new pg.Pool({ connectionString: url });
  try {
    await pool.query(`
      INSERT INTO core.users (email, password_hash)
      VALUES ('test-baseline-admin@hrms.invalid', '!disabled-test-account!')
      ON CONFLICT (email) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO core.user_roles (user_id, role_id, scope_org_unit_id)
      SELECT u.id, r.id, NULL FROM core.users u CROSS JOIN core.roles r
      WHERE u.email = 'test-baseline-admin@hrms.invalid' AND r.code = 'super_admin'
        AND NOT EXISTS (SELECT 1 FROM core.user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id)
    `);
  } catch (err: unknown) {
    // If DB is unreachable (e.g. running unit tests in sandbox), log and proceed
    console.warn('Global database baseline setup skipped:', err instanceof Error ? err.message : String(err));
  } finally {
    await pool.end().catch((err: unknown) => {
      void err;
    });
  }
}
