import { expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  loadEnv: vi.fn(() => { throw new Error('A definition import must not read runtime configuration'); }),
  createDatabase: vi.fn(() => { throw new Error('A definition import must not open a database'); }),
}));
vi.mock('../src/core/config/env.js', () => ({ loadEnv: boundary.loadEnv }));
vi.mock('../src/core/db/database.js', () => ({ createDatabase: boundary.createDatabase }));

it('CORE-13 / NFR-04: importing settings seed definitions cannot execute the seed', async () => {
  const exitCode = process.exitCode;
  const seed = await import('../src/modules/settings/seed.js');
  await Promise.resolve();
  expect(seed.POLICY_SETTINGS.length).toBeGreaterThan(0);
  expect(boundary.loadEnv).not.toHaveBeenCalled();
  expect(boundary.createDatabase).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(exitCode);
});
