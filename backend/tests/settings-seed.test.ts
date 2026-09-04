/**
 * Guards CLAUDE.md §1.2 — "config over code: zero hardcoded policy values".
 *
 * Services read policy with `getTypedSetting(db, key, type, fallback)`. The
 * fallback is a safety net, not a home: a key with no seed row is invisible in
 * the settings console and cannot be changed without a deploy.
 *
 * S1 every key read anywhere in src/ has a seed entry, and
 * S2 the seeded value EQUALS the in-code fallback, so seeding never silently
 *    changes behaviour.
 *
 * This is a source-level check on purpose — it fails the moment someone adds a
 * new policy read without seeding it, which is when it is cheap to fix.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POLICY_SETTINGS } from '../src/modules/settings/seed.js';
import { DEFAULT_PASSWORD_POLICY } from '../src/core/auth/password-policy.js';

/**
 * A fallback may be a literal (`30`, `'GEN'`, `true`) OR a reference to a named
 * default object — which is BETTER practice, because it stops two copies of the
 * same number drifting apart. So the resolver below understands both; a named
 * constant that this test cannot resolve is reported rather than silently
 * skipped, so the guarantee never quietly weakens.
 */
const NAMED_DEFAULTS: Record<string, Record<string, unknown>> = {
  DEFAULT_PASSWORD_POLICY: DEFAULT_PASSWORD_POLICY as unknown as Record<string, unknown>,
};

function resolveFallback(expression: string): { text: string } | { unresolved: true } {
  const dotted = /^([A-Z][A-Z0-9_]*)\.([A-Za-z0-9_]+)$/.exec(expression);
  if (dotted) {
    const object = NAMED_DEFAULTS[dotted[1] ?? ''];
    const value = object?.[dotted[2] ?? ''];
    if (object === undefined || value === undefined) return { unresolved: true };
    return { text: typeof value === 'string' ? value : JSON.stringify(value) };
  }
  return { text: expression.replace(/^'(.*)'$/, '$1') };
}

const SRC = new URL('../src', import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

interface Read {
  key: string;
  type: string;
  fallback: string;
  file: string;
}

/** Every `getTypedSetting(db, 'key', 'type', fallback)` call in the source. */
function collectPolicyReads(): Read[] {
  const pattern = /getTypedSetting\(\s*[^,]+,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([^)]+)\)/g;
  return walk(SRC).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(pattern)].map((m) => ({
      key: m[1] ?? '',
      type: m[2] ?? '',
      // Multi-line calls leave a trailing comma on the captured argument.
      fallback: (m[3] ?? '').trim().replace(/,$/, '').trim(),
      file,
    }));
  });
}

describe('policy settings seed', () => {
  const reads = collectPolicyReads();
  const seeded = new Map(POLICY_SETTINGS.map((p) => [p.key, p]));

  it('S0 actually finds the policy reads (guards the regex itself)', () => {
    expect(reads.length).toBeGreaterThan(10);
  });

  it('S1 every policy key read in src/ is seeded into core.settings', () => {
    const unseeded = [...new Set(reads.map((r) => r.key))]
      .filter((key) => !seeded.has(key))
      .sort();
    expect(
      unseeded,
      `These policy keys are read but never seeded, so HR cannot see or change them: ${unseeded.join(', ')}`,
    ).toEqual([]);
  });

  it('S2 each seeded value equals the in-code fallback (seeding changes nothing)', () => {
    const mismatched: string[] = [];
    for (const read of reads) {
      const policy = seeded.get(read.key);
      if (!policy) continue;
      const resolved = resolveFallback(read.fallback);
      if ('unresolved' in resolved) {
        mismatched.push(`${read.key}: fallback ${read.fallback} could not be resolved by this test`);
        continue;
      }
      const seededAsText =
        typeof policy.value === 'string' ? policy.value : JSON.stringify(policy.value);
      if (seededAsText !== resolved.text) {
        mismatched.push(`${read.key}: seed=${seededAsText} fallback=${resolved.text}`);
      }
      expect(policy.valueType).toBe(read.type);
    }
    expect(mismatched, `Seed drifted from the code fallback: ${mismatched.join(' | ')}`).toEqual([]);
  });

  it('S3 the seed has no duplicate keys', () => {
    const keys = POLICY_SETTINGS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
