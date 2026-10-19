/** DOC-03: expiry is a calendar fact, independent of the server time zone. */
import { describe, expect, it } from 'vitest';
import { documentExpiry, parseAlertStages } from '../src/modules/documents/expiry.js';
describe('document expiry', () => {
  const stages = [90, 30, 15, 7];
  it('switches business days at midnight IST and keeps the expiry day valid', () => {
    const expires = new Date('2026-10-19T00:00:00Z');
    expect(documentExpiry(expires, new Date('2026-10-18T18:29:59Z'), stages)).toEqual({
      state: 'expiring',
      daysRemaining: 1,
      stage: 7,
    });
    expect(documentExpiry(expires, new Date('2026-10-18T18:30:00Z'), stages)).toEqual({
      state: 'expiring',
      daysRemaining: 0,
      stage: 7,
    });
    expect(documentExpiry(expires, new Date('2026-10-19T18:30:00Z'), stages)).toEqual({
      state: 'expired',
      daysRemaining: -1,
      stage: null,
    });
  });
  it('handles no expiry, outside the ladder and duplicate settings', () => {
    expect(documentExpiry(null, new Date(), stages).state).toBe('perpetual');
    expect(
      documentExpiry(new Date('2027-10-19T00:00:00Z'), new Date('2026-10-19T00:00:00Z'), stages)
        .state,
    ).toBe('valid');
    expect(parseAlertStages('7,30,7,90')).toEqual([90, 30, 7]);
    expect(() => parseAlertStages('7junk,30')).toThrow();
  });
});
