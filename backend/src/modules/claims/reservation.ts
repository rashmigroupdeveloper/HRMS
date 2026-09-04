/**
 * Phase 3.5 Stage T1 — the commitment rule.
 *
 * The live EMS reserves a claim's amount from its funding source at
 * SUBMISSION and refunds it on rejection. That timing is the whole point: a
 * check performed at approval time cannot stop three people each submitting
 * ₹40,000 against the same ₹50,000 budget, because each one is individually
 * affordable at the moment it is approved.
 *
 * Kept pure and free of the database so the arithmetic is pinned exactly and
 * the boundary cases are testable without fixtures.
 *
 * All amounts are integer paise (CLAUDE.md money discipline). Floats never
 * touch money, so a fractional input is rejected as a programming error rather
 * than quietly rounded.
 */

export interface ReservationInput {
  /** The funding source's total allowance, in paise. */
  allowanceMinor: number;
  /** Sum of the live reservation ledger for that source, in paise. */
  reservedMinor: number;
  /** What this claim wants to commit, in paise. */
  requestedMinor: number;
  /** A budget must be approved before anything can draw on it. */
  fundingApproved: boolean;
}

export type ReservationRefusal =
  | 'not_positive'
  | 'not_integer'
  | 'funding_not_approved'
  | 'exceeds_remaining';

export type ReservationDecision =
  | { allowed: true; remainingAfterMinor: number }
  | {
      allowed: false;
      reason: ReservationRefusal;
      allowanceMinor: number;
      reservedMinor: number;
      remainingMinor: number;
      shortfallMinor: number;
    };

/**
 * Headroom, floored at zero. An over-committed source reports no headroom
 * rather than a negative number a caller might treat as available.
 */
export function remainingOf(allowanceMinor: number, reservedMinor: number): number {
  return Math.max(0, allowanceMinor - reservedMinor);
}

export function checkReservation(input: ReservationInput): ReservationDecision {
  const remainingMinor = remainingOf(input.allowanceMinor, input.reservedMinor);

  const refuse = (reason: ReservationRefusal, shortfallMinor: number): ReservationDecision => ({
    allowed: false,
    reason,
    allowanceMinor: input.allowanceMinor,
    reservedMinor: input.reservedMinor,
    remainingMinor,
    shortfallMinor,
  });

  if (!Number.isInteger(input.requestedMinor)) return refuse('not_integer', 0);
  if (input.requestedMinor <= 0) return refuse('not_positive', 0);

  // Checked before the amount, deliberately: an unapproved budget is refused on
  // its own terms, so the message does not blame the amount for a problem that
  // is really about the budget's state and send the user to edit the wrong thing.
  if (!input.fundingApproved) return refuse('funding_not_approved', 0);

  // The live system THROWS on any over-budget claim; there is no escalation
  // path. An earlier version of this file invented one — removed, because it
  // changed who could spend money without anyone asking for the change.
  const shortfallMinor = Math.max(0, input.requestedMinor - remainingMinor);
  if (shortfallMinor > 0) return refuse('exceeds_remaining', shortfallMinor);

  return { allowed: true, remainingAfterMinor: remainingMinor - input.requestedMinor };
}

/** Human sentences for the UI — the refusal names the numbers, never just "no". */
export function refusalMessage(decision: Extract<ReservationDecision, { allowed: false }>): string {
  const rupees = (minor: number): string =>
    `₹${(minor / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  switch (decision.reason) {
    case 'funding_not_approved':
      return 'That budget has not been approved yet, so nothing can be claimed against it.';
    case 'exceeds_remaining':
      return `${rupees(decision.remainingMinor)} is left on this budget, which is ${rupees(
        decision.shortfallMinor,
      )} short. Reduce the claim or ask for the budget to be increased.`;
    case 'not_positive':
      return 'A claim has to be for more than zero.';
    case 'not_integer':
      return 'Amounts are held in paise and must be whole numbers.';
  }
}
