/**
 * Stage 5.5 — POSH / grievance / whistleblower unit tests.
 * Asserts claim tokens hash correctly, SHA-256 integrity, and IC empty contracts.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mintClaimToken, sha256Hex } from '../src/modules/ird/index.js';

describe('Stage 5.5 — IRD unit tests', () => {
  it('mints a claim token whose SHA-256 hex is 64 characters', () => {
    const { token, hash } = mintClaimToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token, 'utf8').digest('hex'));
  });

  it('sha256Hex produces reproducible digests', () => {
    const sample = 'confidential-whistleblower-claim-code-123';
    const digest1 = sha256Hex(sample);
    const digest2 = sha256Hex(sample);
    expect(digest1).toBe(digest2);
    expect(digest1).toHaveLength(64);
  });
});
