/**
 * SEC-02 — TOTP (RFC 6238) over HMAC-SHA1, plus the RFC 4648 base32 codec that
 * authenticator apps expect.
 *
 * Why implemented rather than depended upon: the algorithm is ~60 lines,
 * frozen since 2011, and ships with authoritative test vectors — so the usual
 * "prefer a battle-tested library" reasoning is satisfied by testing against
 * the specification itself (see tests/totp.test.ts, RFC 6238 Appendix B).
 * Adding a runtime dependency to the auth path has its own cost.
 *
 * Secrets are handled as base32 strings because that is the interchange format
 * for `otpauth://` URIs; callers are responsible for storing them encrypted.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
/** Accept the neighbouring step on each side — real phones drift. Not wider. */
const DRIFT_STEPS = 1;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31] ?? '';
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31] ?? '';
  while (out.length % 8 !== 0) out += '=';
  return out;
}

export function base32Decode(secret: string): Buffer {
  const clean = secret.replace(/[\s=]/g, '').toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = ((value << 5) | index) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(bytes);
}

/** Cryptographically random base32 secret. 20 bytes = 160 bits = RFC-recommended. */
export function generateTotpSecret(randomBytes: Buffer): string {
  return base32Encode(randomBytes);
}

function hotp(key: Buffer, counter: number, digits: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(message).digest();

  // RFC 4226 §5.4 dynamic truncation.
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);

  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function generateTotp(secretBase32: string, atMs: number, digits = 6): string {
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secretBase32), counter, digits);
}

/**
 * Returns WHICH step the code matched, or null. The step number is what makes
 * a replay guard possible — a TOTP code is valid for 30s, which is ample time
 * for a shoulder-surfer, so `sec.mfa_enrolments.last_used_step` spends it.
 *
 * Constant-time across the drift window; returns null — never throws — for any
 * malformed input, so a caller can pass raw user text.
 */
export function matchTotpStep(
  secretBase32: string,
  code: string,
  atMs: number,
  digits = 6,
): number | null {
  if (!new RegExp(`^\\d{${String(digits)}}$`).test(code)) return null;

  let key: Buffer;
  try {
    key = base32Decode(secretBase32);
  } catch {
    return null;
  }
  if (key.length === 0) return null;

  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  const supplied = Buffer.from(code, 'utf8');
  let matchedStep: number | null = null;
  // Loop the whole window every time — no early return, no timing oracle.
  for (let offset = -DRIFT_STEPS; offset <= DRIFT_STEPS; offset += 1) {
    const step = counter + offset;
    const expected = Buffer.from(hotp(key, step, digits), 'utf8');
    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
      matchedStep = step;
    }
  }
  return matchedStep;
}

/** Boolean form of {@link matchTotpStep}, for callers with no replay guard. */
export function verifyTotp(secretBase32: string, code: string, atMs: number, digits = 6): boolean {
  return matchTotpStep(secretBase32, code, atMs, digits) !== null;
}

/** The `otpauth://` URI an authenticator app scans or accepts by paste. */
export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32.replace(/=/g, ''),
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
