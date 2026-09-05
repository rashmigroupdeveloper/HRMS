/**
 * The refusals that only matter in production.
 *
 * Each of these guards a mistake that is either irreversible or silent, and
 * each was reachable before the audit:
 *   · the MOCK biometric feed would have fabricated attendance into the
 *     append-only att.swipe_events, driving OT and pay ([A1]);
 *   · a production box with no SMTP host queued notifications and delivered
 *     nothing, with nothing complaining — how PP-14 happened ([A2]).
 *
 * They are asserted here rather than trusted, because by definition nobody
 * exercises them in development.
 */
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/core/config/env.js';

const BASE = {
  DATABASE_URL: 'postgres://u@localhost:5432/db',
  JWT_SECRET: 'a-sufficiently-long-development-secret-value',
};

/** Drop one key — clearer than destructuring into a variable nobody reads. */
function without<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => k !== key),
  ) as Omit<T, K>;
}

const PROD_OK = {
  ...BASE,
  NODE_ENV: 'production',
  ATT_CONNECTOR: 'kent',
  SMTP_HOST: 'smtp.example.test',
  SMTP_FROM: 'hrms@example.test',
  CORS_ORIGIN: 'https://hrms.example.test',
};

describe('production environment guards', () => {
  it('refuses to boot production with the MOCK biometric feed (A1)', () => {
    expect(() => loadEnv({ ...PROD_OK, ATT_CONNECTOR: 'mock' }))
      .toThrow(/MOCK biometric feed in production/);
  });

  it('refuses to boot production with the connector left at its default', () => {
    expect(() => loadEnv(without(PROD_OK, 'ATT_CONNECTOR'))).toThrow(/MOCK biometric feed in production/);
  });

  it('refuses to boot production without SMTP — silent no-mail is how PP-14 happened (A2)', () => {
    expect(() => loadEnv(without(PROD_OK, 'SMTP_HOST')))
      .toThrow(/SMTP_HOST is required when NODE_ENV=production/);
    expect(() => loadEnv(without(PROD_OK, 'SMTP_FROM')))
      .toThrow(/SMTP_FROM is required when NODE_ENV=production/);
  });

  it('refuses to boot production without an explicit CORS origin', () => {
    expect(() => loadEnv(without(PROD_OK, 'CORS_ORIGIN')))
      .toThrow(/CORS_ORIGIN is required when NODE_ENV=production/);
  });

  it('accepts a fully configured production environment', () => {
    const env = loadEnv(PROD_OK);
    expect(env.NODE_ENV).toBe('production');
    expect(env.ATT_CONNECTOR).toBe('kent');
  });

  it('leaves development alone — the mock is the point of a dev box', () => {
    const env = loadEnv({ ...BASE, NODE_ENV: 'development' });
    expect(env.ATT_CONNECTOR).toBe('mock');
  });

  it('still enforces the JWT secret floor', () => {
    expect(() => loadEnv({ ...BASE, JWT_SECRET: 'too-short' } ))
      .toThrow(/at least 32 characters/);
  });
});
