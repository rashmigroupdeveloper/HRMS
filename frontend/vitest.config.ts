/**
 * Frontend test configuration — the Stage 0.3 exit criterion.
 *
 * Three things this harness has to make possible, because docs/05 §7 states
 * them as the quality bar and nothing was verifying them:
 *   1. component behaviour across all interactive states,
 *   2. accessibility assertions (axe) on real rendered output,
 *   3. both THEMES, since contrast and tokens differ between them.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/ui/**', 'src/lib/**', 'src/app/nav-config.ts'],
    },
  },
});
