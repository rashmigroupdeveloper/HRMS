/**
 * Stage 5.5 — POSH / grievance / whistleblower unit tests (skeleton).
 * IC must be empty by default; claim tokens hash correctly; rate-limit stub allows.
 */
import { describe, expect, it } from 'vitest';
import { mintClaimToken, whistleRateLimitOk } from '../src/modules/ird/index.js';
import { createHash } from 'node:crypto';

describe('Stage 5.5 — IRD skeleton units', () => {
  it('mints a claim token whose SHA-256 hex is what we would store', () => {
    const { token, hash } = mintClaimToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token, 'utf8').digest('hex'));
    expect(hash).toHaveLength(64);
  });

  it('whistle rate-limit stub always allows (real limits are Stage 5.5 follow-up)', () => {
    expect(whistleRateLimitOk(null)).toBe(true);
    expect(whistleRateLimitOk('127.0.0.1')).toBe(true);
  });
});
