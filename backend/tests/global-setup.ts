import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

// Runs once before the test files: brings the test database up to date (prisma migrate deploy - creates it if it does
// not exist, never deletes data). Nothing is wiped: every run adds its own uniquely named test data
// (tests/helpers), so runs never clash. vitest.config.ts has already refused a database whose name does not end in
// _test; checked again here before anything runs against it.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('The test database name must end in _test - the tests write to it')
  execFileSync(process.execPath, [installedPrisma(), 'migrate', 'deploy'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, DATABASE_URL: url },
  })
}

// The Prisma CLI installed with the packages (package.json), run with this Node - never `npx prisma`, which downloads
// the newest Prisma (a pre-release) when the packages are not installed (2026-11-23, the review)
function installedPrisma() {
  let packageJson: string
  try {
    packageJson = createRequire(import.meta.url).resolve('prisma/package.json')
  } catch {
    throw new Error('The Prisma CLI is not installed - run `npm install` in the project folder first')
  }
  const { bin } = createRequire(import.meta.url)(packageJson) as { bin: { prisma: string } }
  return join(dirname(packageJson), bin.prisma)
}
