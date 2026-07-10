/** Attendance module public API (module pattern — see ../README.md). */
export { ingestOnce, findSilentDevices, alertSilentDevices } from './ingest.service.js';
export { MockKentConnector, type KentConnector, type RawSwipe } from './kent-connector.js';
export { runKentSync, KENT_SOURCE } from './kent-sync.job.js';
export { attendanceRouter } from './attendance.router.js';
