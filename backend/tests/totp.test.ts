/**
 * SEC-02 — TOTP (RFC 6238) verified against the RFC's OWN published test
 * vectors. We implement rather than add a dependency because the algorithm is
 * small, precisely specified, and comes with authoritative vectors — but that
 * choice is only defensible if those vectors are the test, which they are.
 *
 * RFC 6238 Appendix B: shared secret "12345678901234567890" (ASCII), T0 = 0,
 * X = 30s, SHA-1. The RFC prints 8-digit codes; a 6-digit code is the last 6.
 */
import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateTotp, verifyTotp } from '../src/core/auth/totp.js';

const RFC_SECRET_ASCII = '12345678901234567890';
const RFC_SECRET_BASE32 = base32Encode(Buffer.from(RFC_SECRET_ASCII, 'ascii'));

/** [unix seconds, RFC 8-digit code] — RFC 6238 Appendix B, SHA-1 rows. */
const VECTORS: readonly [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('base32', () => {
  it('round-trips the RFC secret', () => {
    expect(base32Decode(RFC_SECRET_BASE32).toString('ascii')).toBe(RFC_SECRET_ASCII);
  });

  it('encodes the RFC secret to the canonical value', () => {
    expect(RFC_SECRET_BASE32).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('ignores padding, spaces and case when decoding', () => {
    const spaced = 'gezd gnbv gy3t qojq gezd gnbv gy3t qojq====';
    expect(base32Decode(spaced).toString('ascii')).toBe(RFC_SECRET_ASCII);
  });
});

describe('generateTotp — RFC 6238 vectors', () => {
  for (const [seconds, eightDigit] of VECTORS) {
    it(`t=${String(seconds)} produces ${eightDigit}`, () => {
      expect(generateTotp(RFC_SECRET_BASE32, seconds * 1000, 8)).toBe(eightDigit);
      expect(generateTotp(RFC_SECRET_BASE32, seconds * 1000, 6)).toBe(eightDigit.slice(-6));
    });
  }
});

describe('verifyTotp', () => {
  const at = 1111111111 * 1000;

  it('accepts the code for the current step', () => {
    expect(verifyTotp(RFC_SECRET_BASE32, '050471', at)).toBe(true);
  });

  it('accepts the immediately previous and next step (clock drift window)', () => {
    const prev = generateTotp(RFC_SECRET_BASE32, at - 30_000, 6);
    const next = generateTotp(RFC_SECRET_BASE32, at + 30_000, 6);
    expect(verifyTotp(RFC_SECRET_BASE32, prev, at)).toBe(true);
    expect(verifyTotp(RFC_SECRET_BASE32, next, at)).toBe(true);
  });

  it('rejects a code two steps away — the window is ±1, not open-ended', () => {
    const stale = generateTotp(RFC_SECRET_BASE32, at - 90_000, 6);
    expect(verifyTotp(RFC_SECRET_BASE32, stale, at)).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '  050471  ', '05047a']) {
      expect(verifyTotp(RFC_SECRET_BASE32, bad, at)).toBe(false);
    }
  });

  it('rejects a valid-looking code for a different secret', () => {
    const other = base32Encode(Buffer.from('09876543210987654321', 'ascii'));
    expect(verifyTotp(other, '050471', at)).toBe(false);
  });
});
