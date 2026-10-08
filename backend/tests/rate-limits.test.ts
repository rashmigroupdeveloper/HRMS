import { describe, expect, it } from 'vitest';
import { rateLimitsFromEnv } from '../src/api/rate-limits.js';

describe('NFR-03 limiter configuration', () => {
  it('uses the documented auth and general defaults', () => {
    expect(rateLimitsFromEnv({})).toEqual({ authPerIdentifier: 5, authPerAddress: 300, globalPerAddress: 100 });
  });
  it('reads positive integer overrides', () => {
    expect(rateLimitsFromEnv({ RATE_LIMIT_AUTH_PER_IDENTIFIER: '7', RATE_LIMIT_AUTH_PER_ADDRESS: '900', RATE_LIMIT_GLOBAL_PER_ADDRESS: '200' }))
      .toEqual({ authPerIdentifier: 7, authPerAddress: 900, globalPerAddress: 200 });
  });
  it.each(['0', '-1', '0.5', 'abc', '', 'Infinity', '9007199254740992'])('refuses unsafe configuration %s', (value) => {
    expect(() => rateLimitsFromEnv({ RATE_LIMIT_AUTH_PER_IDENTIFIER: value })).toThrow('positive integer');
  });
});
