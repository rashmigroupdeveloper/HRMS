/** Attendance module public API (module pattern — see ../README.md). */
export { ingestOnce, findSilentDevices } from './ingest.service.js';
export { MockKentConnector, type KentConnector, type RawSwipe } from './kent-connector.js';
