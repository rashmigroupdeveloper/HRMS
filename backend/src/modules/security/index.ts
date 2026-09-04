/**
 * Public API of the security module (Phase 5 Stage 5.2 — SEC-01..11).
 *
 * Deep imports into this module are CI-blocked (dependency-cruiser), so
 * everything another module or the API layer legitimately needs is re-exported
 * here — and nothing else is.
 */
export { securityRouter } from './security.router.js';

// Second factor — auth reports enrolment status on /auth/me.
export { getMfaStatus } from './mfa.service.js';

// NOTE: session primitives and policy reads deliberately live in `core/auth`
// (session.ts / security-policy.ts) — the API layer needs them on every
// request, and reaching them through this module's public API would route
// `api/orpc.ts` back through this module's router. Import them from core.

// Access log — every module that reveals a masked column calls this (SEC-10).
export { recordAccess, type SensitiveFieldClass } from './access-log.service.js';
