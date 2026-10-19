/**
 * Public API of the IRD module (Phase 5 Stage 5.5 — POSH / grievance / whistleblower).
 */
export { irdRouter } from './ird.router.js';
export {
  assignPoshCase,
  fileGrievance,
  filePoshAnonymous,
  filePoshAuthenticated,
  fileWhistleblower,
  getPoshClaimStatus,
  getWhistleClaimStatus,
  isCaseAssigned,
  isPresidingOfficer,
  listGrievances,
  listIcMembers,
  listMyGrievances,
  listMyPoshCases,
  listPoshCases,
  listWhistleblowerReports,
  mintClaimToken,
  openPoshCase,
  sha256Hex,
  type GrievanceListItem,
  type IcMemberView,
  type PoshCaseDetail,
  type PoshCaseListItem,
} from './ird.service.js';
