/**
 * Public API of the claims module (Phase 3.5 — TE-05/06/10).
 * Ported from the live EMS; the specification is
 * docs/recon/ems-claims-live-schema.md, and nothing enters this path that is
 * not in it.
 */
export { claimsRouter } from './claims.router.js';
export { registerClaimsWorkflowHooks } from './workflow-hooks.js';
export {
  applyClaimOnFinal,
  approveClaim,
  budgetPosition,
  releaseClaim,
  routeClaimForApproval,
  submitClaim,
} from './claims.service.js';
export { calculateSettlement, settlementRefusal, type SettlementMode } from './settlement.js';
export { checkReservation, refusalMessage } from './reservation.js';
export { buildApprovalChain, type ChainInput, type ChainPerson } from './approval-chain.js';
export {
  assertCategoryCaps,
  normalizeExpenseType,
  sumByCategory,
  type CategoryTotals,
} from './category-caps.js';
