/**
 * System module — liveness/metadata procedures (no business logic).
 * First real oRPC procedures; the pattern every module copies.
 */
import { z } from 'zod';
import { base } from '../../api/orpc.js';

const healthOutput = z.object({
  status: z.literal('ok'),
  service: z.literal('hrms-api'),
  ts: z.string().datetime(),
});

const health = base
  .route({ method: 'GET', path: '/system/health', summary: 'Service liveness' })
  .output(healthOutput)
  .handler(() => ({
    status: 'ok' as const,
    service: 'hrms-api' as const,
    ts: new Date().toISOString(),
  }));

export const systemRouter = {
  health,
};
