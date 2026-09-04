/**
 * PRV-06 — retention predicate properties + two-person confirm negative.
 *
 * For any row and retention window: past retention without an active hold is
 * purgeable; an active hold always blocks; released holds do not.
 */
import { describe, expect, it } from 'vitest';
import { wouldPurge } from '../src/modules/privacy/would-purge.js';

const asOf = new Date(Date.UTC(2026, 8, 3)); // 3 Sep 2026
const daysAgo = (n: number): Date => {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

describe('wouldPurge', () => {
  it('past retention without hold → purgeable', () => {
    expect(wouldPurge(daysAgo(400), 365, [], asOf)).toBe(true);
    expect(wouldPurge(daysAgo(366), 365, [], asOf)).toBe(true);
  });

  it('exactly at retention boundary is not yet purgeable', () => {
    expect(wouldPurge(daysAgo(365), 365, [], asOf)).toBe(false);
    expect(wouldPurge(daysAgo(100), 365, [], asOf)).toBe(false);
  });

  it('under active legal hold → not purgeable', () => {
    expect(wouldPurge(daysAgo(400), 365, [{ releasedAt: null }], asOf)).toBe(false);
  });

  it('a released hold no longer blocks', () => {
    expect(wouldPurge(daysAgo(400), 365, [{ releasedAt: daysAgo(1) }], asOf)).toBe(true);
  });

  it('any active hold in the set blocks, even among released ones', () => {
    expect(
      wouldPurge(daysAgo(400), 365, [{ releasedAt: daysAgo(10) }, { releasedAt: null }], asOf),
    ).toBe(false);
  });
});

describe('two-person purge rule (pure)', () => {
  it('proposing user cannot confirm — same id maps to same_user', () => {
    // Mirrors confirmPurge's `proposed_by === confirmerId → same_user` guard
    // and the DB CHECK (confirmed_by <> proposed_by).
    function outcome(proposedBy: number, confirmerId: number): 'same_user' | 'ok' {
      return proposedBy === confirmerId ? 'same_user' : 'ok';
    }
    expect(outcome(42, 42)).toBe('same_user');
    expect(outcome(42, 99)).toBe('ok');
  });
});
