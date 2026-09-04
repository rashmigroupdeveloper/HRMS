/**
 * DOC-03 — unit tests for the vault expiry helper.
 *
 * The state machine itself lives in compliance; this pins that the vault
 * wrapper preserves the same boundaries (valid → expiring → expired).
 */
import { describe, expect, it } from 'vitest';
import { documentExpiry, parseAlertStages } from '../src/modules/documents/index.js';

const STAGES = [90, 30, 15, 7];
const on = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const today = on('2026-09-03');

describe('documentExpiry (DOC-03)', () => {
  it('treats a missing expires_on as perpetual', () => {
    expect(documentExpiry(null, today, STAGES).state).toBe('perpetual');
  });

  it('is valid beyond the widest alert stage', () => {
    expect(documentExpiry(on('2026-12-31'), today, STAGES).state).toBe('valid');
  });

  it('crosses into expiring on the T-30 boundary', () => {
    const view = documentExpiry(on('2026-10-03'), today, STAGES);
    expect(view.daysRemaining).toBe(30);
    expect(view.state).toBe('expiring');
    expect(view.stage).toBe(30);
  });

  it('is still usable on its last day', () => {
    const view = documentExpiry(on('2026-09-03'), today, STAGES);
    expect(view.state).toBe('expiring');
    expect(view.daysRemaining).toBe(0);
  });

  it('is expired only once the day has passed', () => {
    expect(documentExpiry(on('2026-09-02'), today, STAGES).state).toBe('expired');
  });

  it('reuses the shared alert-ladder parser', () => {
    expect(parseAlertStages('30,15,7')).toEqual([30, 15, 7]);
  });
});
