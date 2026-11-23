import type { IncomingHttpHeaders } from 'node:http'
import { ORPCError, type Router } from '@orpc/server'
import { BodyLimitPlugin, RPCHandler } from '@orpc/server/node'
import { ResponseHeadersPlugin } from '@orpc/server/plugins'
import type { RequestHandler } from 'express'
import { runWithAuditRequest } from '../audit/request.js'
import { toApiError } from './errors.js'
import type { Context, CurrentCandidate, CurrentUser } from './procedures.js'

const PREFIX = '/api/rpc'

// Largest request accepted (a 5 MB document upload + form overhead). Bigger requests get 413 before being read.
const MAX_REQUEST_BYTES = 6 * 1024 * 1024

type Options = {
  // Finds the logged-in user from the request headers (session cookie), or null
  resolveUser: (headers: IncomingHttpHeaders) => Promise<CurrentUser | null>
  // Finds the signed-in candidate (candidate cookie), or null
  resolveCandidate: (headers: IncomingHttpHeaders) => Promise<CurrentCandidate | null>
}

// Express middleware that serves every procedure of `router` under /api/rpc
// (e.g. POST /api/rpc/employees/getByCode). The router and the user lookup are passed in, so core never imports modules.
export function createRpcMiddleware(router: Router<any, Context>, { resolveUser, resolveCandidate }: Options): RequestHandler {
  const handler = new RPCHandler(router, {
    // ResponseHeadersPlugin gives procedures `context.resHeaders` (used to set the session cookie)
    plugins: [new BodyLimitPlugin({ maxBodySize: MAX_REQUEST_BYTES }), new ResponseHeadersPlugin()],
    clientInterceptors: [
      async ({ next }) => {
        try {
          return await next()
        } catch (error) {
          const apiError = toApiError(error)
          // Expected errors (4xx) are part of normal use; log only real failures.
          if (!(apiError instanceof ORPCError) || apiError.status >= 500) console.error(error)
          throw apiError
        }
      },
    ],
  })

  return async (req, res, next) => {
    // Too big: BodyLimitPlugin answers 413 without reading the body. Close the connection afterwards, otherwise the
    // client reuses a socket still holding the unread body and its next request fails.
    if (Number(req.headers['content-length']) > MAX_REQUEST_BYTES) res.setHeader('Connection', 'close')
    let user: Promise<CurrentUser | null> | undefined
    let candidate: Promise<CurrentCandidate | null> | undefined
    // "::ffff:192.168.1.20" (an IPv4 address in IPv6 form) is kept as "192.168.1.20"
    const clientIp = req.ip?.replace(/^::ffff:/, '') ?? null
    // what the change history records about this call: the API (employees/update -> "employees.update"), IP, browser
    const auditRequest = {
      source: req.path.replace(/^.*?\/api\/rpc\//, '').split('/').filter(Boolean).join('.') || 'api',
      ip: clientIp,
      userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
    }
    const { matched } = await runWithAuditRequest(auditRequest, () =>
      handler.handle(req, res, {
        prefix: PREFIX,
        context: {
          headers: req.headers,
          clientIp,
          getCurrentUser: () => (user ??= resolveUser(req.headers)),
          getCurrentCandidate: () => (candidate ??= resolveCandidate(req.headers)),
        },
      }),
    )
    if (!matched) next()
  }
}
