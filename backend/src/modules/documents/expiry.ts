/**
 * DOC-03 — document expiry colour language.
 *
 * Same ladder as licences and registrations: import the shared machine from the
 * compliance module's public API only (dependency-cruiser blocks deep imports).
 * "Expiring" must mean the same thing on the vault card as on the plant board.
 */
import {
  expiryState,
  parseAlertStages,
  type ExpiryState,
  type ExpiryView,
} from '../compliance/index.js';

export type { ExpiryState, ExpiryView };

export { parseAlertStages };

/** Map a vault row's `expires_on` through the shared CMP-16 state machine. */
export function documentExpiry(
  expiresOn: Date | null,
  today: Date,
  stages: readonly number[],
): ExpiryView {
  return expiryState(expiresOn, today, stages);
}
