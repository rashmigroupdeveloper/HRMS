import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup-database.ts'],
    globalSetup: ['tests/global-database.ts'],
    include: ['tests/**/*.test.ts'],
    // Integration suites share ONE live database (and one audit chain) —
    // parallel files would interleave trigger-off tamper windows and cleanups.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'json-summary', 'html'],
      reportOnFailure: true,
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
