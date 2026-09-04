/**
 * Phase 3.5 — settlement against an advance already held.
 *
 * Ported from the live EMS `claimSettlement.calculateClaimSettlement()`
 * (recon: docs/recon/ems-claims-live-schema.md §4). The behaviour is small but
 * it decides what actually reaches someone's bank account, so it is pinned
 * rule-for-rule against the original — including both of its refusals.
 */
import { describe, expect, it } from 'vitest';
import { paise } from '../src/core/money/index.js';
import { calculateSettlement } from '../src/modules/claims/settlement.js';

const rupees = (n: number) => paise(n * 100);

describe('calculateSettlement — AUTO', () => {
  it('recovers the whole claim when the advance covers it', () => {
    const result = calculateSettlement({
      claimAmount: rupees(8_000),
      advanceHeld: rupees(20_000),
      mode: 'AUTO',
    });
    expect(result).toEqual({
      ok: true,
      settlementAmount: rupees(8_000),
      netPayable: rupees(0),
    });
  });

  it('recovers only what the advance holds, and pays the rest', () => {
    const result = calculateSettlement({
      claimAmount: rupees(30_000),
      advanceHeld: rupees(20_000),
      mode: 'AUTO',
    });
    expect(result).toEqual({
      ok: true,
      settlementAmount: rupees(20_000),
      netPayable: rupees(10_000),
    });
  });

  it('pays the whole claim when no advance is held', () => {
    const result = calculateSettlement({
      claimAmount: rupees(5_000),
      advanceHeld: rupees(0),
      mode: 'AUTO',
    });
    expect(result).toEqual({ ok: true, settlementAmount: rupees(0), netPayable: rupees(5_000) });
  });

  it('clamps negative inputs to zero rather than inverting the payment', () => {
    // The live code clamps both inputs with Math.max(x, 0). Reproduced: a
    // negative advance must never become money owed TO the company.
    const result = calculateSettlement({
      claimAmount: rupees(1_000),
      advanceHeld: paise(-50_000),
      mode: 'AUTO',
    });
    expect(result).toEqual({ ok: true, settlementAmount: rupees(0), netPayable: rupees(1_000) });
  });
});

describe('calculateSettlement — MANUAL', () => {
  it('recovers exactly the amount named', () => {
    const result = calculateSettlement({
      claimAmount: rupees(30_000),
      advanceHeld: rupees(20_000),
      mode: 'MANUAL',
      manualAmount: rupees(12_000),
    });
    expect(result).toEqual({
      ok: true,
      settlementAmount: rupees(12_000),
      netPayable: rupees(18_000),
    });
  });

  it('refuses a settlement larger than the claim', () => {
    const result = calculateSettlement({
      claimAmount: rupees(10_000),
      advanceHeld: rupees(50_000),
      mode: 'MANUAL',
      manualAmount: rupees(12_000),
    });
    expect(result).toEqual({ ok: false, reason: 'exceeds_claim' });
  });

  it('refuses a settlement larger than the advance held', () => {
    const result = calculateSettlement({
      claimAmount: rupees(30_000),
      advanceHeld: rupees(5_000),
      mode: 'MANUAL',
      manualAmount: rupees(12_000),
    });
    expect(result).toEqual({ ok: false, reason: 'exceeds_advance' });
  });

  it('treats a missing manual amount as zero, as the live code does', () => {
    const result = calculateSettlement({
      claimAmount: rupees(9_000),
      advanceHeld: rupees(9_000),
      mode: 'MANUAL',
    });
    expect(result).toEqual({ ok: true, settlementAmount: rupees(0), netPayable: rupees(9_000) });
  });

  it('checks the claim ceiling before the advance ceiling', () => {
    // Both are breached; the live code throws on the claim check first, so the
    // message a user sees stays the same after the port.
    const result = calculateSettlement({
      claimAmount: rupees(1_000),
      advanceHeld: rupees(500),
      mode: 'MANUAL',
      manualAmount: rupees(9_000),
    });
    expect(result).toEqual({ ok: false, reason: 'exceeds_claim' });
  });
});
