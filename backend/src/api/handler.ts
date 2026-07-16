/**
 * HTTP plumbing for the oRPC router:
 *  - an Express middleware that serves every procedure under the /api prefix
 *  - the OpenAPI document generator (served at /api/openapi.json)
 */
import type { NextFunction, Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { OpenAPIHandler } from '@orpc/openapi/node';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodSmartCoercionPlugin, ZodToJsonSchemaConverter } from '@orpc/zod';
import { appRouter } from './router.js';
import type { Database } from '../core/db/types.js';

// Query and path params arrive as STRINGS. The smart-coercion plugin converts
// them to each procedure's zod input type (number, boolean, date) BEFORE
// validation — so `?companyId=1&limit=20` and `?open=false` parse correctly.
// Without it, a plain `z.number()`/`z.boolean()` query param 400s. (docs/14 §3)
const rpcHandler = new OpenAPIHandler(appRouter, {
  plugins: [new ZodSmartCoercionPlugin()],
});

export interface AppDeps {
  db: Kysely<Database> | null;
  jwtSecret: string;
  secureCookies: boolean;
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
