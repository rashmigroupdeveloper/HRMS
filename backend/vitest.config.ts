import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Automated tests (`npm run test`): unit tests next to the code (src/**/*.test.ts) and integration tests in tests/,
// against a database of their own - TEST_DATABASE_URL, migrated at the start of every run (tests/global-setup.ts) and
// never wiped: each run adds its own uniquely named data. The code under test reads it as DATABASE_URL, so it never
// touches the app database.
if (existsSync('.env')) process.loadEnvFile('.env')
// tests never send real e-mail (2026-11-20): without SMTP_HOST every e-mail is saved to the test outbox instead
delete process.env.SMTP_HOST
const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!testDatabaseUrl) throw new Error('Set TEST_DATABASE_URL in backend/.env (see .env.example) - the tests need a database of their own')
const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, '')
if (!databaseName.endsWith('_test')) {
  throw new Error(`TEST_DATABASE_URL must name a database ending in _test - the tests write to it - not "${databaseName}"`)
}

export default defineConfig({
  // #core/*, #modules/* ... resolve to the TypeScript sources, as with `npm run dev`
  resolve: { conditions: ['development'] },
  ssr: { resolve: { conditions: ['development'] } },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // stored files go to a folder of their own too - never the app's (2026-11-20)
    env: { DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test', STORAGE_DIR: 'storage-test' },
    globalSetup: ['tests/global-setup.ts'],
    // every file: the modules the API loads that others depend on without importing (the leave module - 2026-11-22)
    setupFiles: ['tests/setup-modules.ts'],
    // one database: the files run one after another
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
})
