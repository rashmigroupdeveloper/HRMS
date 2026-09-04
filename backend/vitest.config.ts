import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const testDatabaseUrl = process.env['TEST_DATABASE_URL'];
if (testDatabaseUrl === undefined || testDatabaseUrl === '') {
  throw new Error(
    'TEST_DATABASE_URL is required. Integration tests must never run against DATABASE_URL.',
  );
}

const testDatabaseName = new URL(testDatabaseUrl).pathname.slice(1);
if (!testDatabaseName.endsWith('_test')) {
  throw new Error(
    `Refusing to run tests against database "${testDatabaseName}"; TEST_DATABASE_URL must name a *_test database.`,
  );
}

// Tests still consume DATABASE_URL internally, but only after this process-level
// guard has replaced it with the explicitly isolated test database.
process.env['DATABASE_URL'] = testDatabaseUrl;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    hookTimeout: 120_000,
    // Integration suites share ONE isolated database (and one audit chain) —
    // parallel files would interleave trigger-off tamper windows and cleanups.
    fileParallelism: false,
  },
});
