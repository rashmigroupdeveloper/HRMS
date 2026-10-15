/** PAY-03, CORE-10: missing evidence must never authorize payroll approval. */
import { describe, expect, it } from 'vitest';
import { validateRunTransition } from '../src/modules/payroll-core/runs/run-state-machine.js';

describe('Payroll authorization and reconciliation fail closed', () => {
  it.each([undefined, null, 0, -1, Number.NaN])('requires a recorded maker (%s)', (makerUserId) => {
    expect(
      validateRunTransition({
        fromStatus: 'under_review',
        toStatus: 'approved',
        actorUserId: 20,
        makerUserId,
      }).valid,
    ).toBe(false);
  });
  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY, 0.5])(
    'requires an exact integer-paise reconciliation result (%s)',
    (reconciliationDiffPaise) => {
      expect(
        validateRunTransition({
          fromStatus: 'approved',
          toStatus: 'finalized',
          actorUserId: 20,
          reconciliationDiffPaise,
        }).valid,
      ).toBe(false);
    },
  );
  it('accepts an evidenced independent approval and exact zero reconciliation', () => {
    expect(
      validateRunTransition({
        fromStatus: 'under_review',
        toStatus: 'approved',
        makerUserId: 10,
        actorUserId: 20,
      }).valid,
    ).toBe(true);
    expect(
      validateRunTransition({
        fromStatus: 'approved',
        toStatus: 'finalized',
        actorUserId: 20,
        reconciliationDiffPaise: 0,
      }).valid,
    ).toBe(true);
  });
});
