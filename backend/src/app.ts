import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { getOpenApiSpec, orpcMiddleware, type AppDeps } from './api/handler.js';
import { registerAttendanceWorkflowHooks } from './modules/attendance/index.js';

/**
 * Express app factory — pure, no I/O at import time; tests inject their own
 * deps (or none, for DB-less surface tests).
 *
 * Routing model (docs/14 §3):
 *  - /api/*            → oRPC procedures (zod input+output; the internal API)
 *  - /api/openapi.json → the generated contract the frontend team consumes
 *  - /health           → plain envelope endpoint for load-balancer checks
 */
export function createApp(deps?: Partial<AppDeps>): Express {
  const resolved: AppDeps = {
    db: deps?.db ?? null,
    jwtSecret: deps?.jwtSecret ?? 'insecure-test-only-secret-never-in-production!',
    secureCookies: deps?.secureCookies ?? false,
  };

  // Domain reactions to workflow finals (approve → write-back) must be live
  // in every process that can finalize a request.
  registerAttendanceWorkflowHooks();

  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // oRPC serves everything under /api; unmatched paths fall through.
  app.use(orpcMiddleware(resolved));

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
