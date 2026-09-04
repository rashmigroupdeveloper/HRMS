/**
 * SEC-01 — password policy. Every threshold is a `core.settings` value
 * (CLAUDE.md rule 2: zero hardcoded policy values), so the tests drive the
 * checker with explicit policies rather than relying on a default.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORD_POLICY,
  checkPassword,
  type PasswordPolicy,
} from '../src/core/auth/password-policy.js';

const policy: PasswordPolicy = {
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireDigit: true,
  requireSymbol: false,
  maxRepeatRun: 3,
  historyDepth: 5,
  blockCommon: true,
};

describe('checkPassword', () => {
  it('accepts a compliant password', () => {
    expect(checkPassword('Kharagpur2026', policy)).toEqual({ ok: true });
  });

  it('reports EVERY violation at once, not just the first', () => {
    const result = checkPassword('abc', policy);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations).toEqual(
      expect.arrayContaining(['min_length', 'require_upper', 'require_digit']),
    );
  });

  it('enforces minimum length from the policy, not a constant', () => {
    expect(checkPassword('Ab1cdefgh', policy).ok).toBe(false); // 9 chars
    expect(checkPassword('Ab1cdefghi', policy).ok).toBe(true); // 10 chars
    expect(checkPassword('Ab1cdefgh', { ...policy, minLength: 9 }).ok).toBe(true);
  });

  it('enforces character classes only when the policy asks for them', () => {
    expect(checkPassword('kharagpur2026', policy).ok).toBe(false);
    expect(checkPassword('kharagpur2026', { ...policy, requireUpper: false }).ok).toBe(true);
    expect(checkPassword('Kharagpur2026', { ...policy, requireSymbol: true }).ok).toBe(false);
    expect(checkPassword('Kharagpur2026!', { ...policy, requireSymbol: true }).ok).toBe(true);
  });

  it('rejects long runs of one character', () => {
    expect(checkPassword('Kaaaaharagpur1', policy).ok).toBe(false);
    expect(checkPassword('Kaaaharagpur1', policy).ok).toBe(true); // run of 3 == max
  });

  it('rejects common and obviously guessable passwords when enabled', () => {
    for (const weak of ['Password123', 'Welcome@123', 'Qwerty12345', 'Admin@12345']) {
      expect(checkPassword(weak, policy).ok, weak).toBe(false);
    }
    expect(checkPassword('Password123', { ...policy, blockCommon: false }).ok).toBe(true);
  });

  it('rejects a password containing the user identifier', () => {
    const result = checkPassword('RML035384aX', policy, { identifiers: ['RML035384'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations).toContain('contains_identifier');
  });

  it('is case-insensitive about identifier containment', () => {
    expect(checkPassword('rml035384aX', policy, { identifiers: ['RML035384'] }).ok).toBe(false);
  });

  it('ships a default policy that is itself compliant with the rules it states', () => {
    expect(DEFAULT_PASSWORD_POLICY.minLength).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_PASSWORD_POLICY.historyDepth).toBeGreaterThan(0);
  });
});
