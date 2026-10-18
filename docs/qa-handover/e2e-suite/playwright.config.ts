import { defineConfig, devices } from '@playwright/test';

const chrome = { launchOptions: { executablePath: process.env.E2E_CHROME ?? '/usr/bin/google-chrome' } };
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, ...chrome };

export default defineConfig({
  testDir: './tests',
  globalSetup: './lib/global-setup.ts',
  outputDir: './reports/artifacts',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: Number(process.env.E2E_WORKERS ?? 3),
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5176',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    { name: 'api', testMatch: /api\/(?!concurrency).*\.spec\.ts/, use: { ...desktop } },
    // Parallel-request races on payroll/F&F/imports: after the stateful payroll project.
    { name: 'concurrency', testMatch: /api\/concurrency\.spec\.ts/, dependencies: ['payroll'], use: { ...desktop } },
    { name: 'auth', testMatch: /ui\/00-auth\.spec\.ts/, use: { ...desktop } },
    { name: 'roles', testMatch: /ui\/(?!00-auth|9\d-|40-payroll).*\.spec\.ts/, use: { ...desktop } },
    // Stateful June payroll run: one file, tests run in order in a single worker (in parallel with the read-only rest).
    { name: 'payroll', testMatch: /ui\/40-payroll-run\.spec\.ts/, use: { ...desktop } },
    { name: 'viewport-desktop', testMatch: /ui\/90-viewports\.spec\.ts/, use: { ...desktop } },
    { name: 'viewport-tablet', testMatch: /ui\/90-viewports\.spec\.ts/, use: { ...devices['iPad (gen 7)'], browserName: 'chromium', ...chrome } },
    { name: 'viewport-mobile', testMatch: /ui\/90-viewports\.spec\.ts/, use: { ...devices['Pixel 7'], ...chrome } },
    { name: 'a11y', testMatch: /ui\/91-a11y\.spec\.ts/, use: { ...desktop } },
  ],
});
