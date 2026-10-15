/**
 * @module modules/claims — Reimbursements, grade entitlements, verification and payouts (M12, CLM-01..07).
 */
export {
  EntitlementService,
  type EntitlementSummary,
} from './entitlement.service.js';

export {
  ClaimsService,
  type SubmitBillInput,
  type SubmitClaimParams,
  type VerifyBillInput,
  type DecideClaimParams,
  type RoutePayoutParams,
  type ClaimWithBills,
} from './claims.service.js';

export { claimsRouter } from './claims.router.js';
