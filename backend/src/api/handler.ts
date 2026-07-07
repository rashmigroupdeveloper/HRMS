/**
 * HTTP plumbing for the oRPC router:
 *  - an Express middleware that serves every procedure under the /api prefix
 *  - the OpenAPI document generator (served at /api/openapi.json)
 */
import type { NextFunction, Request, Response } from 'express';
import type { Kysely } from 'kysely';
import { OpenAPIHandler } from '@orpc/openapi/node';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod';
import { appRouter } from './router.js';
import type { Database } from '../core/db/types.js';

const rpcHandler = new OpenAPIHandler(appRouter);

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
