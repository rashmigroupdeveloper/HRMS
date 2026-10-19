/**
 * Public API of the privacy module (Phase 5 Stage 5.3 — PRV-01..08).
 *
 * Deep imports into this module are CI-blocked (dependency-cruiser), so
 * everything the API layer needs is re-exported here — and nothing else is.
 */
export { privacyRouter } from './privacy.router.js';
