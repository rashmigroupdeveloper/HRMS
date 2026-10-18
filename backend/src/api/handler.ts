/**
 * HTTP plumbing for the oRPC router:
 *  - an Express middleware that serves every procedure under the /api prefix
 *  - the OpenAPI document generator (served at /api/openapi.json)
 */
import type { NextFunction, Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { randomUUID } from 'node:crypto';
import { OpenAPIHandler } from '@orpc/openapi/node';
import { ORPCError, onError } from '@orpc/server';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodSmartCoercionPlugin, ZodToJsonSchemaConverter } from '@orpc/zod';
import { appRouter } from './router.js';
import type { RateLimits } from './rate-limits.js';
import type { Database } from '../core/db/types.js';
import { logger } from '../core/logger.js';

// Query and path params arrive as STRINGS. The smart-coercion plugin converts
// them to each procedure's zod input type (number, boolean, date) BEFORE
// validation — so `?companyId=1&limit=20` and `?open=false` parse correctly.
// Without it, a plain `z.number()`/`z.boolean()` query param 400s. (docs/14 §3)
const rpcHandler = new OpenAPIHandler(appRouter, {
  plugins: [new ZodSmartCoercionPlugin()],
  // Last line of defence: anything that still escapes as a 5xx (e.g. an output
  // schema mismatch) is logged with its stack — 500s were previously silent.
  interceptors: [
    onError((error, options) => {
      const status = error instanceof ORPCError ? error.status : 500;
      if (status >= 500) {
        const url = options.request.url.pathname;
        logger.error({ err: error, cause: error instanceof ORPCError ? error.cause : undefined, url }, 'unhandled API error');
      }
    }),
  ],
});

/** Correlation id for every request (echoed in the response header). */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  (req as Request & { id?: string }).id = id;
  res.setHeader('x-request-id', id);
  next();
}

export interface AppDeps {
  db: Kysely<Database> | null;
  jwtSecret: string;
  secureCookies: boolean;
  appBaseUrl?: string;
  rateLimits?: RateLimits;
}

/** Mounts the whole router under /api; falls through to Express otherwise. */
export function orpcMiddleware(deps: AppDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { matched } = await rpcHandler.handle(req, res, {
      prefix: '/api',
      context: {
        db: deps.db,
        jwtSecret: deps.jwtSecret,
        secureCookies: deps.secureCookies,
        appBaseUrl: deps.appBaseUrl ?? 'http://localhost:5173',
        req,
        res,
      },
    });
    if (!matched) next();
  };
}

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

let cachedSpec: unknown;

/** The contract document the frontend team generates its typed client from. */
export async function getOpenApiSpec(): Promise<unknown> {
  cachedSpec ??= await generator.generate(appRouter, {
    info: {
      title: 'Rashmi HRMS API',
      version: '0.1.0',
      description:
        'Internal HRMS API. Contract-first: frontend consumes a client generated from this spec (docs/14 §3).',
    },
    servers: [{ url: '/api' }],
  });
  return cachedSpec;
}
