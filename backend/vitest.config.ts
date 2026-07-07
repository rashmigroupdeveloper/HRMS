import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration suites share ONE live database (and one audit chain) —
    // parallel files would interleave trigger-off tamper windows and cleanups.
    fileParallelism: false,
  },
});
