import express, { type Express } from 'express';

/**
 * Express app factory — pure, no I/O at import time, so tests can build it
 * without a database or environment.
 *
 * Response envelope `{ success, data, error, meta }` applies to external/plain
 * endpoints (docs/02 §1); internal app traffic will use the typed RPC layer
 * (docs/14 §3) mounted here in a later stage.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      data: { status: 'ok', service: 'hrms-api' },
      error: null,
      meta: { ts: new Date().toISOString() },
    });
  });

  return app;
}
