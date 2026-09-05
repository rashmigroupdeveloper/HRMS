/** Public API of the IRD module (Phase 5 Stage 5.5 — POSH / grievance / whistle). */
export { irdRouter } from './ird.router.js';
export {
  listIcMembers,
  mintClaimToken,
  type IcMemberView,
} from './ird.service.js';
