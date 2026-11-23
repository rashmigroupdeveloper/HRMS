import { execFileSync } from 'node:child_process'

// Runs once before the test files: brings the test database up to date (prisma migrate deploy - creates it if it does
// not exist, never deletes data). Nothing is wiped: every run adds its own uniquely named test data
// (tests/helpers), so runs never clash. vitest.config.ts has already refused a database whose name does not end in
// _test; checked again here before anything runs against it.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('The test database name must end in _test')
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, DATABASE_URL: url },
    shell: true,
  })
}
