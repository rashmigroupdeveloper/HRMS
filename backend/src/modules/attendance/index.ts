/** Attendance module public API (module pattern — see ../README.md). */
export { ingestOnce, findSilentDevices, alertSilentDevices, reingestQuarantined } from './ingest.service.js';
export { MockKentConnector, type KentConnector, type RawSwipe } from './kent-connector.js';
export { runKentSync, KENT_SOURCE } from './kent-sync.job.js';
export { attendanceRouter } from './attendance.router.js';
export { attendanceConfigRouter } from './attendance-config.router.js';
export { attendanceRequestsRouter } from './attendance-requests.router.js';
export { absenceRouter } from './absence.router.js';
export {
  runAbsenteeScan,
  issueShowCauseLetter,
  listOpenAbsenceCases,
  consecutiveUabDays,
} from './absence.service.js';
export {
  getMonthLockChecklist,
  lockMonth,
  isMonthLocked,
  monthStart,
  nextMonthStart,
} from './month-lock.service.js';
export { registerAttendanceWorkflowHooks } from './workflow-hooks.js';
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
