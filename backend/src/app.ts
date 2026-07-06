import express, { type Express } from 'express';
import { getOpenApiSpec, orpcMiddleware } from './api/handler.js';

/**
 * Express app factory — pure, no I/O at import time, so tests can build it
 * without a database or environment.
 *
 * Routing model (docs/14 §3):
 *  - /api/*            → oRPC procedures (zod input+output; the internal API)
 *  - /api/openapi.json → the generated contract the frontend team consumes
 *  - /health           → plain envelope endpoint for load-balancer checks
 *    (the `{success,data,error,meta}` envelope survives only on such
 *     external/plain endpoints — docs/02 §1)
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // oRPC serves everything under /api; unmatched paths fall through.
  app.use(orpcMiddleware());

  app.get('/api/openapi.json', (_req, res, next) => {
    getOpenApiSpec()
      .then((spec) => res.json(spec))
      .catch(next);
  });

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
