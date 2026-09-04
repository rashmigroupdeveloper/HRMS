/**
 * Phase 3.5 Stage T1 — the commitment rule, as a pure function.
 *
 * This is the highest-risk behaviour in the phase. The live EMS reserves a
 * claim's amount from its budget **at submission** and refunds it on rejection
 * — not at approval. Reproduce that wrongly and budgets silently over-commit:
 * three people each submit ₹40k against a ₹50k budget, every one passes an
 * approval that checked the balance at approval time, and finance discovers it
 * afterwards.
 *
 * The decision is separated from the ledger so the arithmetic can be pinned
 * without a database.
 */
import { describe, expect, it } from 'vitest';
import {
  checkReservation,
  remainingOf,
  type ReservationInput,
} from '../src/modules/claims/reservation.js';

const base: ReservationInput = {
  allowanceMinor: 5_000_000, // ₹50,000 in paise
  reservedMinor: 0,
  requestedMinor: 1_000_000, // ₹10,000
  fundingApproved: true,
};

describe('remainingOf', () => {
  it('is allowance minus what is already committed', () => {
    expect(remainingOf(5_000_000, 1_500_000)).toBe(3_500_000);
  });

  it('never reports negative headroom, even if the ledger is over-committed', () => {
    // Over-commitment should surface as zero headroom, not a negative number
    // that a caller might accidentally treat as available.
    expect(remainingOf(1_000_000, 1_400_000)).toBe(0);
  });
});

describe('checkReservation', () => {
  it('allows a claim that fits', () => {
    expect(checkReservation(base)).toEqual({ allowed: true, remainingAfterMinor: 4_000_000 });
  });

  it('allows a claim that consumes the budget to exactly zero', () => {
    const result = checkReservation({ ...base, requestedMinor: 5_000_000 });
    expect(result).toEqual({ allowed: true, remainingAfterMinor: 0 });
  });

  it('refuses a claim against funding that is not approved yet', () => {
    const result = checkReservation({ ...base, fundingApproved: false });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toBe('funding_not_approved');
  });

  it('checks approval BEFORE amount — an unapproved budget is refused on its own terms', () => {
    // Otherwise the message would blame the amount for a problem that is
    // really about the budget's state, and the user would edit the wrong thing.
    const result = checkReservation({
      ...base,
      fundingApproved: false,
      requestedMinor: 99_000_000,
    });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toBe('funding_not_approved');
  });

  it('refuses a claim that exceeds the remaining headroom', () => {
    const result = checkReservation({ ...base, reservedMinor: 4_500_000, requestedMinor: 1_000_000 });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toBe('exceeds_remaining');
    expect(result.remainingMinor).toBe(500_000);
    expect(result.shortfallMinor).toBe(500_000);
  });

  it('names the numbers in the refusal — the UI must not have to recompute them', () => {
    const result = checkReservation({ ...base, reservedMinor: 4_800_000, requestedMinor: 900_000 });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result).toMatchObject({
      reason: 'exceeds_remaining',
      allowanceMinor: 5_000_000,
      reservedMinor: 4_800_000,
      remainingMinor: 200_000,
      shortfallMinor: 700_000,
    });
  });

  it('refuses EVERY over-budget claim — there is no escalation path', () => {
    // The live system throws on any breach. An earlier version of this file
    // invented an `overspendAllowed` escape hatch; it is removed, because it
    // changed who could commit money without anyone asking for the change.
    const result = checkReservation({
      ...base,
      reservedMinor: 4_800_000,
      requestedMinor: 900_000,
    });
    expect(result.allowed).toBe(false);
  });

  it('refuses a non-positive request', () => {
    for (const requestedMinor of [0, -1]) {
      const result = checkReservation({ ...base, requestedMinor });
      expect(result.allowed, String(requestedMinor)).toBe(false);
      if (result.allowed) continue;
      expect(result.reason).toBe('not_positive');
    }
  });

  it('works in integer paise only — no float can enter the decision', () => {
    // Money is integer paise (CLAUDE.md money discipline). A fractional input
    // is a programming error, not a rounding opportunity.
    const result = checkReservation({ ...base, requestedMinor: 1_000_000.5 });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toBe('not_integer');
  });
});
