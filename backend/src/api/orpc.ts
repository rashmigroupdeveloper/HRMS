/**
 * oRPC base — docs/14 §3 (DECIDED 6 Jul 2026).
 *
 * Every internal endpoint is an oRPC procedure with zod INPUT AND OUTPUT
 * schemas — the output schema is the runtime firewall against a procedure
 * silently returning a malformed shape. The router emits an OpenAPI spec
 * (/api/openapi.json) — the neutral contract the frontend team generates its
 * typed client from. Frontend never imports backend source.
 */
import { os } from '@orpc/server';

/** Request context — auth/user lands here in Stage 0.4. */
export interface AppContext {
  requestId?: string;
}

export const base = os.$context<AppContext>();
