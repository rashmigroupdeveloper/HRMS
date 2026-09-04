/**
 * Public API of the documents module (Phase 5 Stage 5.4 — DOC-01/02/03).
 *
 * Wire into `api/router.ts` as:
 *   import { documentsRouter } from '../modules/documents/index.js';
 *   ...
 *   documents: documentsRouter,
 */
export { documentsRouter } from './documents.router.js';
export { documentExpiry, parseAlertStages, type ExpiryState, type ExpiryView } from './expiry.js';
export type { ESignProvider, ESignEnvelope, ESignEnvelopeStatus } from './esign.js';
