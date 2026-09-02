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
      // The fallback is a literal: 30, 0.5, 'GEN', true.
      const literal = read.fallback.replace(/^'(.*)'$/, '$1');
      const seededAsText =
        typeof policy.value === 'string' ? policy.value : JSON.stringify(policy.value);
      if (seededAsText !== literal) {
        mismatched.push(`${read.key}: seed=${seededAsText} fallback=${literal}`);
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
