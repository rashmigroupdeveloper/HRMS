/**
 * Phase 3.5 — settlement of an approved claim against an advance already held.
 *
 * A faithful port of the live EMS `calculateClaimSettlement()`
 * (docs/recon/ems-claims-live-schema.md §4), with two deliberate changes:
 *
 *  · **Returns a result, does not throw.** The original throws on both refusals.
 *    A thrown error in a money path tends to surface to the user as "something
 *    went wrong"; a typed refusal lets the caller say which ceiling was hit.
 *  · **Integer paise, not floats** (CLAUDE.md money discipline).
 *
 * The arithmetic itself — including clamping both inputs at zero, and checking
 * the claim ceiling before the advance ceiling — is unchanged, so a settlement
 * computed here matches one computed by the system it replaces.
 */
import { paise, type Paise } from '../../core/money/index.js';

export type SettlementMode = 'AUTO' | 'MANUAL';

export interface SettlementInput {
  claimAmount: Paise;
  /** The advance this employee already holds against the claim. */
  advanceHeld: Paise;
  mode: SettlementMode;
  /** MANUAL only. Absent is treated as zero, as in the original. */
  manualAmount?: Paise;
}

export type SettlementResult =
  | { ok: true; settlementAmount: Paise; netPayable: Paise }
  | { ok: false; reason: 'exceeds_claim' | 'exceeds_advance' };

export function calculateSettlement(input: SettlementInput): SettlementResult {
  // Both clamped first: a negative advance must never become money owed TO the
  // company, and a negative claim must never pay out.
  const claimAmount = paise(Math.max(input.claimAmount, 0));
  const advanceHeld = paise(Math.max(input.advanceHeld, 0));

  if (input.mode === 'AUTO') {
    const settlementAmount = paise(Math.min(advanceHeld, claimAmount));
    return {
      ok: true,
      settlementAmount,
      netPayable: paise(claimAmount - settlementAmount),
    };
  }

  const settlementAmount = paise(Math.max(input.manualAmount ?? 0, 0));

  // Order matters: the original checks the claim ceiling first, so the refusal
  // a user sees for a doubly-invalid amount is the same before and after.
  if (settlementAmount > claimAmount) return { ok: false, reason: 'exceeds_claim' };
  if (settlementAmount > advanceHeld) return { ok: false, reason: 'exceeds_advance' };

  return {
    ok: true,
    settlementAmount,
    netPayable: paise(claimAmount - settlementAmount),
  };
}

/** Human sentences — the refusal names the ceiling that was hit. */
export function settlementRefusal(reason: 'exceeds_claim' | 'exceeds_advance'): string {
  return reason === 'exceeds_claim'
    ? 'The amount recovered cannot be more than the claim itself.'
    : 'The amount recovered cannot be more than the advance this person holds.';
}
