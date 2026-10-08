/** A non-loginable baseline administrator keeps suite cleanup independent. */
import pg from 'pg';

export default async function setup(): Promise<void> {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) return;
  if (!/^\/[a-zA-Z0-9_]+_test$/.test(new URL(url).pathname)) {
    throw new Error('TEST_DATABASE_URL must name a dedicated *_test database');
  }
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
  } finally {
    await pool.end();
  }
}
