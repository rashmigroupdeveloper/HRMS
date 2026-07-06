import { pino } from 'pino';

/**
 * Structured JSON logging (docs/14 §10 Tier-4). Trace correlation (OTel) is
 * wired in a later Stage 0.2 task; sensitive fields are never logged (NFR-03).
 */
export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    // Defense-in-depth: these keys never reach logs even if passed by mistake.
    paths: ['*.password', '*.aadhaar', '*.pan', '*.bank_account', 'req.headers.authorization'],
    censor: '[REDACTED]',
  },
});
