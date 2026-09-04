/** Attendance module public API (module pattern — see ../README.md). */
export { ingestOnce, findSilentDevices, alertSilentDevices, reingestQuarantined } from './ingest.service.js';
export { MockKentConnector, type KentConnector, type RawSwipe } from './kent-connector.js';
export { runKentSync, KENT_SOURCE } from './kent-sync.job.js';
export { attendanceRouter } from './attendance.router.js';
export { attendanceConfigRouter } from './attendance-config.router.js';
export { attendanceRequestsRouter } from './attendance-requests.router.js';
export { absenceRouter } from './absence.router.js';
export { runAbsenceScan, setAbsenceCaseStage, issueAbsenceCaseLetter, listAbsenceCases } from './absence.service.js';
export {
  getMonthLockChecklist,
  lockMonth,
  isMonthLocked,
  monthStart,
  nextMonthStart,
} from './month-lock.service.js';
export {
  getManagerApprovalLedger,
  approveManagerMonth,
  countPendingManagerApprovals,
  listManagersWithReports,
} from './manager-approval.service.js';
export { registerAttendanceWorkflowHooks } from './workflow-hooks.js';
export { applyRosterEntries, type RosterPersistenceEntry } from './roster.service.js';
export { RosterRuleError } from './shift-windows.js';
export { coverageView, rosterMeters } from './coverage.service.js';
export { schedulingRouter } from './scheduling.router.js';
export { createRegularization, listRegularizations } from './regularization.service.js';
export {
  recordDetectedOvertime,
  decideOvertime,
  lapseExpiredOvertime,
  sendOvertimeSummaries,
  listPendingOvertime,
  listMyOvertime,
} from './overtime.service.js';
export {
  computeDayStatus,
  resolveDay,
  recomputeDay,
  drainRecomputeQueue,
  setManualStatus,
  closeWeek,
  loadAttendancePolicy,
  getAbsenceFinalizationReadiness,
  listFinalizationHolds,
  type ResolvedShift,
  type AttendancePolicy,
  type AbsenceFinalizationReadiness,
  type FinalizationHold,
  type FinalizationHoldReason,
} from './day-status.service.js';
